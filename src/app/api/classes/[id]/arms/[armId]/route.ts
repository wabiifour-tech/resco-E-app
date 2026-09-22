import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

type Params = { params: Promise<{ id: string; armId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id, armId } = await params

  const arm = await db.classArm.findUnique({
    where: { id: armId },
    include: { _count: { select: { students: true, teacherAssignment: true } } },
  })
  if (!arm || arm.classId !== id) {
    return Response.json({ error: 'Arm not found' }, { status: 404 })
  }

  if (arm._count.students > 0) {
    return Response.json(
      { error: `Cannot remove "${arm.fullName}" — ${arm._count.students} student(s) are assigned to it. Reassign them first.` },
      { status: 400 },
    )
  }

  await db.classArm.delete({ where: { id: armId } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'CLASS_EDITED',
    context: { classId: id, action: 'REMOVE_ARM', armId, fullName: arm.fullName },
  })

  return Response.json({ ok: true })
}
