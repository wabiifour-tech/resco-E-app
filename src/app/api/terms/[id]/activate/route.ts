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
  const term = await db.term.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!term) return Response.json({ error: 'Term not found' }, { status: 404 })

  // Activate this term, deactivate sibling terms within same session
  await db.$transaction([
    db.term.updateMany({
      where: { sessionId: term.sessionId, isActive: true },
      data: { isActive: false },
    }),
    db.term.update({
      where: { id },
      data: { isActive: true },
    }),
    // Ensure the parent session is also active
    db.academicSession.updateMany({
      where: { id: term.sessionId, isActive: false },
      data: { isActive: true },
    }),
  ])

  // Set as current term in the singleton
  await setCurrentSessionAndTerm(term.sessionId, id)

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TERM_ACTIVATED',
    context: { termId: id, name: term.name, sessionId: term.sessionId, sessionName: term.session.name },
  })

  const updated = await db.term.findUnique({
    where: { id },
    include: { session: true },
  })

  return Response.json({ term: updated })
}
