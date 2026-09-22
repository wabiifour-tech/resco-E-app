import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const assignment = await db.teacherAssignment.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      classArm: true,
      subject: true,
    },
  })
  if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 })

  await db.teacherAssignment.delete({ where: { id } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_ASSIGNMENT_CHANGED',
    context: {
      assignmentId: id,
      teacherId: assignment.teacherId,
      classArmId: assignment.classArmId,
      subjectId: assignment.subjectId,
      action: 'UNASSIGN',
      teacherName: assignment.teacher.user.name,
      classArmName: assignment.classArm.fullName,
      subjectName: assignment.subject.name,
    },
  })

  return Response.json({ ok: true })
}
