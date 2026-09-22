import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { setCurrentSessionAndTerm } from '@/lib/session'

export const dynamic = 'force-dynamic'

const DEFAULTS = {
  schoolName: "Redeemer's Schools and College",
  address: 'Owotoro, Oyo State, Nigeria',
  motto: 'Excellence, Knowledge, and Wisdom',
}

/** GET — return the singleton settings + available sessions/terms for dropdowns. */
export async function GET() {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const settings = await db.schoolSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      schoolName: DEFAULTS.schoolName,
      address: DEFAULTS.address,
      motto: DEFAULTS.motto,
    },
  })

  // Hydrate the current term too
  let currentTerm: { id: string; name: string; sessionId: string; order: number } | null = null
  if (settings.currentTermId) {
    currentTerm = await db.term.findUnique({
      where: { id: settings.currentTermId },
      select: { id: true, name: true, sessionId: true, order: true },
    })
  }

  const sessions = await db.academicSession.findMany({
    orderBy: { name: 'asc' },
    include: { terms: { orderBy: { order: 'asc' } } },
  })

  return Response.json({
    settings,
    currentTerm,
    sessions,
  })
}

/**
 * PUT — update school settings fields, including logo/signature data URLs
 * and currentSessionId/currentTermId.
 */
export async function PUT(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: {
    schoolName?: string
    address?: string
    phone?: string | null
    motto?: string
    logoDataUrl?: string | null
    principalName?: string | null
    principalSignatureDataUrl?: string | null
  } = {}

  if (typeof body.schoolName === 'string') {
    const v = body.schoolName.trim()
    if (!v) return Response.json({ error: 'School name cannot be empty' }, { status: 400 })
    data.schoolName = v
  }
  if (typeof body.address === 'string') {
    data.address = body.address.trim()
  }
  if (typeof body.phone === 'string') data.phone = body.phone.trim()
  if (typeof body.motto === 'string') data.motto = body.motto.trim()

  // Image data URLs (base64). Validate prefix and size.
  const MAX_DATA_URL_BYTES = 1.5 * 1024 * 1024 // ~1.5MB
  const VALID_PREFIXES = ['data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/jpg;base64,', 'data:image/svg+xml;base64,', 'data:image/webp;base64,']

  function validateDataUrl(label: string, value: string): string | null {
    const ok = VALID_PREFIXES.some((p) => value.startsWith(p))
    if (!ok) return `${label} must be a PNG, JPEG, SVG, or WebP image`
    if (Buffer.byteLength(value, 'utf8') > MAX_DATA_URL_BYTES) {
      return `${label} is too large (must be < 1MB after base64 encoding)`
    }
    return null
  }

  if (typeof body.logoDataUrl === 'string' && body.logoDataUrl) {
    const err = validateDataUrl('Logo', body.logoDataUrl)
    if (err) return Response.json({ error: err }, { status: 400 })
    data.logoDataUrl = body.logoDataUrl
  } else if (body.logoDataUrl === null) {
    data.logoDataUrl = null
  }

  if (typeof body.principalSignatureDataUrl === 'string' && body.principalSignatureDataUrl) {
    const err = validateDataUrl('Signature', body.principalSignatureDataUrl)
    if (err) return Response.json({ error: err }, { status: 400 })
    data.principalSignatureDataUrl = body.principalSignatureDataUrl
  } else if (body.principalSignatureDataUrl === null) {
    data.principalSignatureDataUrl = null
  }

  if (typeof body.principalName === 'string') {
    data.principalName = body.principalName.trim()
  }

  // Persist text/label/image updates first so the singleton row exists
  const updated = await db.schoolSetting.upsert({
    where: { id: 'singleton' },
    update: data,
    create: {
      id: 'singleton',
      schoolName: DEFAULTS.schoolName,
      address: DEFAULTS.address,
      motto: DEFAULTS.motto,
      ...data,
    },
  })

  // Current session/term (validate the references before linking)
  const sessionChanged = body.currentSessionId !== undefined
  const termChanged = body.currentTermId !== undefined

  let nextSessionId: string | undefined | null = undefined
  let nextTermId: string | undefined | null = undefined

  if (sessionChanged) {
    const sid = body.currentSessionId
    if (sid === null || sid === '') {
      nextSessionId = null
      nextTermId = null // also clear term if session cleared
    } else {
      const exists = await db.academicSession.findUnique({ where: { id: sid } })
      if (!exists) return Response.json({ error: 'Selected academic session not found' }, { status: 400 })
      nextSessionId = sid
      // If a previously-set term doesn't belong to the new session, clear it.
      if (updated.currentTermId && !termChanged) {
        const t = await db.term.findUnique({ where: { id: updated.currentTermId } })
        if (!t || t.sessionId !== sid) nextTermId = null
      }
    }
  }

  if (termChanged) {
    const tid = body.currentTermId
    if (tid === null || tid === '') {
      nextTermId = null
    } else {
      const term = await db.term.findUnique({ where: { id: tid } })
      if (!term) return Response.json({ error: 'Selected term not found' }, { status: 400 })
      // If a session is also being set in this same PUT, validate the term belongs to it.
      const targetSessionId = nextSessionId ?? updated.currentSessionId ?? undefined
      if (targetSessionId && term.sessionId !== targetSessionId) {
        return Response.json({ error: 'Selected term does not belong to the selected session' }, { status: 400 })
      }
      nextTermId = tid
      // Ensure session is set if only term was specified
      if (!sessionChanged && !updated.currentSessionId) {
        nextSessionId = term.sessionId
      }
    }
  }

  if (nextSessionId !== undefined || nextTermId !== undefined) {
    await setCurrentSessionAndTerm(
      nextSessionId === undefined ? undefined : nextSessionId,
      nextTermId === undefined ? undefined : nextTermId,
    )
  }

  const refreshed = await db.schoolSetting.findUnique({
    where: { id: 'singleton' },
  })

  let currentTerm: { id: string; name: string; sessionId: string; order: number } | null = null
  if (refreshed?.currentTermId) {
    currentTerm = await db.term.findUnique({
      where: { id: refreshed.currentTermId },
      select: { id: true, name: true, sessionId: true, order: true },
    })
  }

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SETTINGS_UPDATED',
    context: {
      fields: Object.keys(data),
      currentSessionId: refreshed?.currentSessionId ?? null,
      currentTermId: refreshed?.currentTermId ?? null,
    },
  })

  return Response.json({ settings: refreshed, currentTerm })
}
