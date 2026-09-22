import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Session name is required')
    .max(40)
    .regex(/^[A-Za-z0-9/\- ]+$/, 'Use letters, numbers, slashes only'),
})

export async function GET() {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const settings = await db.schoolSetting.findUnique({ where: { id: 'singleton' } })

  const sessions = await db.academicSession.findMany({
    include: {
      terms: { orderBy: { order: 'asc' } },
      _count: { select: { results: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json({
    sessions,
    currentSessionId: settings?.currentSessionId ?? null,
    currentTermId: settings?.currentTermId ?? null,
  })
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

  const name = parsed.data.name.trim()

  const existing = await db.academicSession.findUnique({ where: { name } })
  if (existing) {
    return Response.json({ error: `Session "${name}" already exists` }, { status: 400 })
  }

  // Create session + the three terms in one transaction
  const session = await db.$transaction(async (tx) => {
    const s = await tx.academicSession.create({ data: { name } })

    const termDefs = [
      { name: 'First Term', order: 1 },
      { name: 'Second Term', order: 2 },
      { name: 'Third Term', order: 3 },
    ]

    await tx.term.createMany({
      data: termDefs.map((t) => ({ sessionId: s.id, name: t.name, order: t.order })),
    })

    return tx.academicSession.findUnique({
      where: { id: s.id },
      include: { terms: { orderBy: { order: 'asc' } } },
    })
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SESSION_CREATED',
    context: { sessionId: session!.id, name, autoCreatedTerms: 3 },
  })

  return Response.json({ session }, { status: 201 })
}
