import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// DELETE /api/class-teachers/[id] — remove class-teacher responsibility.

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const row = await db.classTeacher.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      class: { select: { name: true } },
    },
  })
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })

  await db.classTeacher.delete({ where: { id } })
  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_ASSIGNMENT_CHANGED',
    context: {
      teacherId: row.teacherId,
      classId: row.classId,
      teacherName: row.teacher.user.name,
      className: row.class.name,
      action: 'REMOVE_CLASS_TEACHER',
    },
  })
  return Response.json({ ok: true })
}
