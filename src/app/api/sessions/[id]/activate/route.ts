import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { setCurrentSessionAndTerm } from '@/lib/session'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const session = await db.academicSession.findUnique({
    where: { id },
    include: { terms: { orderBy: { order: 'asc' } } },
  })
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  // Activate this session, deactivate all others
  await db.$transaction([
    db.academicSession.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    db.academicSession.update({
      where: { id },
      data: { isActive: true },
    }),
  ])

  // Make it the current session in the singleton; reset currentTerm (will pick a sensible default elsewhere)
  await setCurrentSessionAndTerm(id, null)

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SESSION_ACTIVATED',
    context: { sessionId: id, name: session.name },
  })

  // Re-fetch the updated session
  const updated = await db.academicSession.findUnique({
    where: { id },
    include: { terms: { orderBy: { order: 'asc' } } },
  })

  return Response.json({ session: updated })
}
