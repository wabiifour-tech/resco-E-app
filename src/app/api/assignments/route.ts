import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getSession, requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// RESCO eCard — Teacher Assignments API (FLAT structure, NO class arms).
// An assignment is (Teacher, Class, Subject). All references use `classId`.

const createSchema = z.object({
  teacherId: z.string().min(1, 'Teacher is required'),
  classId: z.string().min(1, 'Class is required'),
  subjectId: z.string().min(1, 'Subject is required'),
})

function serializeForTeacher(a: any) {
  return {
    id: a.id,
    classId: a.classId,
    className: a.class.name,
    subjectId: a.subjectId,
    subjectName: a.subject.name,
    subjectCode: a.subject.code,
    createdAt: a.createdAt,
  }
}

export async function GET() {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  if (u.role === 'PRINCIPAL') {
    const assignments = await db.teacherAssignment.findMany({
      include: {
        teacher: { include: { user: { select: { name: true, email: true } } } },
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { class: { level: 'asc' } },
        { class: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    })
    return Response.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        teacherName: a.teacher.user.name,
        teacherEmail: a.teacher.user.email,
        classId: a.classId,
        className: a.class.name,
        classLevel: a.class.level,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        subjectCode: a.subject.code,
        createdAt: a.createdAt,
      })),
    })
  }

  // Teacher — return only their own assignments (teacher-facing shape)
  if (!u.teacherId) return Response.json({ assignments: [] })

  const assignments = await db.teacherAssignment.findMany({
    where: { teacherId: u.teacherId },
    include: {
      class: { select: { id: true, name: true, level: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: [
      { class: { level: 'asc' } },
      { class: { name: 'asc' } },
      { subject: { name: 'asc' } },
    ],
  })

  return Response.json({ assignments: assignments.map(serializeForTeacher) })
}

export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const { teacherId, classId, subjectId } = parsed.data

  // Validate FK existence
  const [teacher, klass, subject] = await Promise.all([
    db.teacher.findUnique({ where: { id: teacherId }, include: { user: true } }),
    db.class.findUnique({ where: { id: classId } }),
    db.subject.findUnique({ where: { id: subjectId } }),
  ])
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 400 })
  if (!klass) return Response.json({ error: 'Class not found' }, { status: 400 })
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 400 })

  // Check for duplicate (unique [teacherId, classId, subjectId])
  const existing = await db.teacherAssignment.findUnique({
    where: {
      teacherId_classId_subjectId: { teacherId, classId, subjectId },
    },
  })
  if (existing) {
    return Response.json(
      {
        error: `${teacher.user.name} is already assigned to ${klass.name} — ${subject.name}`,
      },
      { status: 400 },
    )
  }

  const assignment = await db.teacherAssignment.create({
    data: { teacherId, classId, subjectId },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      class: { select: { id: true, name: true, level: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_ASSIGNMENT_CHANGED',
    context: {
      teacherId,
      classId,
      subjectId,
      action: 'ASSIGN',
      teacherName: teacher.user.name,
      className: klass.name,
      subjectName: subject.name,
    },
  })

  return Response.json(
    {
      assignment: {
        id: assignment.id,
        teacherId: assignment.teacherId,
        teacherName: assignment.teacher.user.name,
        classId: assignment.classId,
        className: assignment.class.name,
        classLevel: assignment.class.level,
        subjectId: assignment.subjectId,
        subjectName: assignment.subject.name,
        subjectCode: assignment.subject.code,
        createdAt: assignment.createdAt,
      },
    },
    { status: 201 },
  )
}
