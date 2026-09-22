import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveSessionAndTerm } from '@/lib/session'

export async function GET(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const sessionId = req.nextUrl.searchParams.get('sessionId')

  // If a session is provided, return its terms; otherwise return terms for the current/active session
  let targetSessionId = sessionId || undefined

  if (!targetSessionId) {
    const { session } = await getActiveSessionAndTerm()
    targetSessionId = session?.id
  }

  if (!targetSessionId) {
    return Response.json({ terms: [], session: null, currentTermId: null })
  }

  const session = await db.academicSession.findUnique({
    where: { id: targetSessionId },
    include: { terms: { orderBy: { order: 'asc' } } },
  })
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  const settings = await db.schoolSetting.findUnique({ where: { id: 'singleton' } })

  return Response.json({
    session,
    terms: session.terms,
    currentSessionId: settings?.currentSessionId ?? null,
    currentTermId: settings?.currentTermId ?? null,
  })
}
