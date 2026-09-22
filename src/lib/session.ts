import { db } from '@/lib/db'

/** Load active session/term from singleton settings, falling back to any active. */
export async function getActiveSessionAndTerm() {
  const settings = await db.schoolSetting.findUnique({ where: { id: 'singleton' } })
  let session = settings?.currentSessionId
    ? await db.academicSession.findUnique({ where: { id: settings.currentSessionId } })
    : null
  if (!session) session = (await db.academicSession.findFirst({ where: { isActive: true } })) ?? null
  if (!session) session = (await db.academicSession.findFirst({ orderBy: { createdAt: 'desc' } })) ?? null
  let term = settings?.currentTermId
    ? await db.term.findUnique({ where: { id: settings.currentTermId } })
    : null
  if (!term && session) term = (await db.term.findFirst({ where: { sessionId: session.id, isActive: true } })) ?? null
  if (!term && session) term = (await db.term.findFirst({ where: { sessionId: session.id }, orderBy: { order: 'asc' } })) ?? null
  return { session, term, settings }
}

export async function setCurrentSessionAndTerm(sessionId?: string, termId?: string) {
  await db.schoolSetting.upsert({
    where: { id: 'singleton' },
    update: {
      ...(sessionId !== undefined ? { currentSessionId: sessionId } : {}),
      ...(termId !== undefined ? { currentTermId: termId } : {}),
    },
    create: {
      id: 'singleton',
      ...(sessionId !== undefined ? { currentSessionId: sessionId } : {}),
      ...(termId !== undefined ? { currentTermId: termId } : {}),
    },
  })
}
