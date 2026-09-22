import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** PUT — edit category and/or text. */
export async function PUT(req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params

  const existing = await db.remark.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'Remark not found' }, { status: 404 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: { category?: string; text?: string; active?: boolean } = {}
  if (typeof body.category === 'string') {
    const c = body.category.trim()
    if (!c) return Response.json({ error: 'Category cannot be empty' }, { status: 400 })
    data.category = c
  }
  if (typeof body.text === 'string') {
    const t = body.text.trim()
    if (!t) return Response.json({ error: 'Remark text cannot be empty' }, { status: 400 })
    if (t.length > 500) return Response.json({ error: 'Remark text is too long (max 500 chars)' }, { status: 400 })
    data.text = t
  }
  if (typeof body.active === 'boolean') data.active = body.active

  const updated = await db.remark.update({ where: { id }, data })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'REMARK_EDITED',
    context: {
      id,
      before: { category: existing.category, text: existing.text, active: existing.active },
      after: { category: updated.category, text: updated.text, active: updated.active },
    },
  })

  return Response.json(updated)
}

/** PATCH — quick toggle of active state. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const existing = await db.remark.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'Remark not found' }, { status: 404 })

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // allow empty body — toggles to opposite
  }
  const nextActive = typeof body.active === 'boolean' ? body.active : !existing.active

  const updated = await db.remark.update({ where: { id }, data: { active: nextActive } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'REMARK_EDITED',
    context: { id, toggledActive: { from: existing.active, to: nextActive } },
  })

  return Response.json(updated)
}

/** DELETE — remove a remark. If it is referenced by results (FK restrict), block. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const existing = await db.remark.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'Remark not found' }, { status: 404 })

  const inUse = await db.result.count({ where: { remarkId: id } })
  if (inUse > 0) {
    return Response.json(
      {
        error: `Cannot delete: remark is referenced by ${inUse} result(s). Deactivate it instead.`,
      },
      { status: 400 },
    )
  }

  await db.remark.delete({ where: { id } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'REMARK_EDITED',
    context: { id, deleted: true, category: existing.category, text: existing.text },
  })

  return Response.json({ ok: true, id })
}
