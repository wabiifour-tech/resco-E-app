import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required').max(80),
  code: z.string().trim().max(20).optional().nullable(),
})

export async function GET() {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const subjects = await db.subject.findMany({
    include: { _count: { select: { assignments: true, results: true } } },
    orderBy: { name: 'asc' },
  })

  return Response.json({ subjects })
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

  const name = parsed.data.name
  const code =
    parsed.data.code && parsed.data.code.length > 0 ? parsed.data.code.toUpperCase() : null

  const existing = await db.subject.findUnique({ where: { name } })
  if (existing) {
    return Response.json({ error: `Subject "${name}" already exists` }, { status: 400 })
  }

  const subject = await db.subject.create({ data: { name, code } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SUBJECT_CREATED',
    context: { subjectId: subject.id, name, code },
  })

  return Response.json({ subject }, { status: 201 })
}
