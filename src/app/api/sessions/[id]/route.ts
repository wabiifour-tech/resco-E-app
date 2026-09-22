import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const editSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Session name is required')
    .max(40)
    .regex(/^[A-Za-z0-9/\- ]+$/, 'Use letters, numbers, slashes only'),
})

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const session = await db.academicSession.findUnique({ where: { id } })
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  const name = parsed.data.name.trim()
  if (name !== session.name) {
    const clash = await db.academicSession.findUnique({ where: { name } })
    if (clash) {
      return Response.json({ error: `Session "${name}" already exists` }, { status: 400 })
    }
  }

  const updated = await db.academicSession.update({ where: { id }, data: { name } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SESSION_CREATED',
    context: { sessionId: id, action: 'RENAME', before: session.name, after: name },
  })

  return Response.json({ session: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const session = await db.academicSession.findUnique({
    where: { id },
    include: { _count: { select: { results: true } } },
  })
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  if (session.isActive) {
    return Response.json(
      { error: 'Cannot delete the active session. Deactivate or switch first.' },
      { status: 400 },
    )
  }
  if (session._count.results > 0) {
    return Response.json(
      {
        error: `Cannot delete "${session.name}" — ${session._count.results} result(s) reference it. Remove results first.`,
      },
      { status: 400 },
    )
  }

  // Clear settings pointer if it pointed here
  const settings = await db.schoolSetting.findUnique({ where: { id: 'singleton' } })
  if (settings?.currentSessionId === id) {
    await db.schoolSetting.update({
      where: { id: 'singleton' },
      data: { currentSessionId: null, currentTermId: null },
    })
  }

  await db.academicSession.delete({ where: { id } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SESSION_CREATED',
    context: { sessionId: id, deleted: true, name: session.name },
  })

  return Response.json({ ok: true })
}
