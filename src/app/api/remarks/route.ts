import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const remarks = await db.remark.findMany({
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  })

  // Group by category, preserve insertion order
  const groups: Record<string, typeof remarks> = {}
  for (const r of remarks) {
    if (!groups[r.category]) groups[r.category] = []
    groups[r.category].push(r)
  }

  // Return as ordered array of groups + a flat list for convenience
  const grouped = Object.entries(groups).map(([category, items]) => ({
    category,
    items,
  }))

  return Response.json({ grouped, items: remarks })
}

export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const active = body.active === undefined ? true : Boolean(body.active)

  if (!category) return Response.json({ error: 'Category is required' }, { status: 400 })
  if (!text) return Response.json({ error: 'Remark text is required' }, { status: 400 })
  if (text.length > 500) return Response.json({ error: 'Remark text is too long (max 500 chars)' }, { status: 400 })

  const remark = await db.remark.create({
    data: { category, text, active },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'REMARK_CREATED',
    context: { id: remark.id, category, text },
  })

  return Response.json(remark, { status: 201 })
}
