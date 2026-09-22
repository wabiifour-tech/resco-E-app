import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getSession, requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const createSchema = z.object({
  teacherId: z.string().min(1, 'Teacher is required'),
  classArmId: z.string().min(1, 'Class arm is required'),
  subjectId: z.string().min(1, 'Subject is required'),
})

export async function GET() {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  if (u.role === 'PRINCIPAL') {
    const assignments = await db.teacherAssignment.findMany({
      include: {
        teacher: { include: { user: { select: { name: true, email: true } } } },
        classArm: { include: { class: { select: { name: true, level: true } } } },
        subject: true,
      },
      orderBy: [
        { classArm: { fullName: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    })
    return Response.json({ assignments })
  }

  // Teacher — return only their own assignments
  if (!u.teacherId) return Response.json({ assignments: [] })

  const assignments = await db.teacherAssignment.findMany({
    where: { teacherId: u.teacherId },
    include: {
      classArm: { include: { class: { select: { name: true, level: true } } } },
      subject: true,
    },
    orderBy: [{ classArm: { fullName: 'asc' } }, { subject: { name: 'asc' } }],
  })

  // Strip to a teacher-facing shape
  const safe = assignments.map((a) => ({
    id: a.id,
    classArmId: a.classArmId,
    classArmName: a.classArm.fullName,
    className: a.classArm.class.name,
    subjectId: a.subjectId,
    subjectName: a.subject.name,
    subjectCode: a.subject.code,
    createdAt: a.createdAt,
  }))

  return Response.json({ assignments: safe })
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

  const { teacherId, classArmId, subjectId } = parsed.data

  // Validate FK existence
  const [teacher, classArm, subject] = await Promise.all([
    db.teacher.findUnique({ where: { id: teacherId }, include: { user: true } }),
    db.classArm.findUnique({ where: { id: classArmId }, include: { class: true } }),
    db.subject.findUnique({ where: { id: subjectId } }),
  ])
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 400 })
  if (!classArm) return Response.json({ error: 'Class arm not found' }, { status: 400 })
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 400 })

  // Check for duplicate
  const existing = await db.teacherAssignment.findUnique({
    where: {
      teacherId_classArmId_subjectId: { teacherId, classArmId, subjectId },
    },
  })
  if (existing) {
    return Response.json(
      {
        error: `${teacher.user.name} is already assigned to ${classArm.fullName} ${subject.name}`,
      },
      { status: 400 },
    )
  }

  const assignment = await db.teacherAssignment.create({
    data: { teacherId, classArmId, subjectId },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      classArm: true,
      subject: true,
    },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_ASSIGNMENT_CHANGED',
    context: {
      teacherId,
      classArmId,
      subjectId,
      action: 'ASSIGN',
      teacherName: teacher.user.name,
      classArmName: classArm.fullName,
      subjectName: subject.name,
    },
  })

  return Response.json({ assignment }, { status: 201 })
}
