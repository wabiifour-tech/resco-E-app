import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal, getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// Class-Teachers: the class-teacher (form-tutor) responsibility, distinct from
// subject teaching. A teacher may be class teacher of a class AND/OR teach
// subjects there.
// GET  /api/class-teachers?teacherId=  → classes a teacher is class-teacher of
// GET  /api/class-teachers              → all ClassTeacher rows (principal)
// POST /api/class-teachers  {teacherId, classId}
// DELETE /api/class-teachers/[id]

export async function GET(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const teacherId = req.nextUrl.searchParams.get('teacherId')
  if (teacherId) {
    // A teacher may look up their own class-teacher classes; principal may query any.
    if (u.role === 'TEACHER' && u.teacherId !== teacherId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rows = await db.classTeacher.findMany({
      where: { teacherId },
      include: { class: { select: { id: true, name: true, level: true, category: true } } },
      orderBy: { class: { level: 'asc' } },
    })
    return Response.json({
      teacherId,
      classes: rows.map((r) => ({
        id: r.class.id,
        name: r.class.name,
        level: r.class.level,
        category: r.class.category,
        classTeacherId: r.id,
      })),
    })
  }

  // Principal: all class-teacher assignments
  const principal = await requirePrincipal()
  if (!principal) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const rows = await db.classTeacher.findMany({
    include: {
      teacher: { include: { user: { select: { name: true, email: true } } } },
      class: { select: { id: true, name: true, level: true } },
    },
    orderBy: [{ class: { level: 'asc' } }, { teacher: { user: { name: 'asc' } } }],
  })
  return Response.json({
    classTeachers: rows.map((r) => ({
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacher.user.name,
      teacherEmail: r.teacher.user.email,
      classId: r.classId,
      className: r.class.name,
      classLevel: r.class.level,
      createdAt: r.createdAt,
    })),
  })
}

const createSchema = z.object({
  teacherId: z.string().min(1, 'Teacher is required'),
  classId: z.string().min(1, 'Class is required'),
})

export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const { teacherId, classId } = parsed.data

  const [teacher, klass] = await Promise.all([
    db.teacher.findUnique({ where: { id: teacherId }, include: { user: true } }),
    db.class.findUnique({ where: { id: classId } }),
  ])
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 400 })
  if (!klass) return Response.json({ error: 'Class not found' }, { status: 400 })

  const existing = await db.classTeacher.findUnique({
    where: { teacherId_classId: { teacherId, classId } },
  })
  if (existing) {
    return Response.json(
      { error: `${teacher.user.name} is already the class teacher of ${klass.name}` },
      { status: 400 },
    )
  }

  const row = await db.classTeacher.create({ data: { teacherId, classId } })
  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_ASSIGNMENT_CHANGED',
    context: {
      teacherId,
      classId,
      teacherName: teacher.user.name,
      className: klass.name,
      action: 'MAKE_CLASS_TEACHER',
    },
  })
  return Response.json({ id: row.id, teacherId, classId }, { status: 201 })
}
