import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// DELETE /api/class-subjects/[id] — remove a subject from a class's offerings.

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const row = await db.classSubject.findUnique({
    where: { id },
    include: { class: { select: { name: true } }, subject: { select: { name: true } } },
  })
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })

  await db.classSubject.delete({ where: { id } })
  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SUBJECT_REMOVED_FROM_CLASS',
    context: {
      classId: row.classId,
      className: row.class.name,
      subjectId: row.subjectId,
      subjectName: row.subject.name,
      action: 'UNOFFER',
    },
  })
  return Response.json({ ok: true })
}
