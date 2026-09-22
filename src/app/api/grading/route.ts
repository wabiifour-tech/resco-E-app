import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { DEFAULT_GRADE_BOUNDARIES } from '@/lib/results'

export const dynamic = 'force-dynamic'

/** GET — return all grade boundaries ordered by `order` asc, fall back to defaults. */
export async function GET() {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const rows = await db.gradeBoundary.findMany({ orderBy: { order: 'asc' } })
  const items = rows.length > 0 ? rows : DEFAULT_GRADE_BOUNDARIES.map((b, i) => ({ ...b, id: `default-${i}` }))

  return Response.json({ items })
}

/**
 * PUT — replace all boundaries with the provided array.
 * Body: { items: [{ min, max, grade, order }] } OR an array directly.
 * Strategy: delete all existing rows, then create new ones in a transaction.
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

  const rawItems: any[] = Array.isArray(body) ? body : body?.items
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return Response.json({ error: 'Provide a non-empty array of grade boundaries' }, { status: 400 })
  }

  // Validate each row
  const cleaned: { min: number; max: number; grade: string; order: number }[] = []
  const seen = new Set<string>()
  for (let i = 0; i < rawItems.length; i++) {
    const row = rawItems[i] || {}
    const min = Number(row.min)
    const max = Number(row.max)
    const grade = typeof row.grade === 'string' ? row.grade.trim() : ''
    const order = row.order !== undefined && row.order !== null ? Number(row.order) : i

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return Response.json({ error: `Row ${i + 1}: min and max must be numbers` }, { status: 400 })
    }
    if (min < 0 || max > 100 || min > max) {
      return Response.json(
        { error: `Row ${i + 1}: range invalid (must satisfy 0 ≤ min ≤ max ≤ 100)` },
        { status: 400 },
      )
    }
    if (!grade) {
      return Response.json({ error: `Row ${i + 1}: grade is required` }, { status: 400 })
    }
    if (grade.length > 4) {
      return Response.json({ error: `Row ${i + 1}: grade too long (max 4 chars)` }, { status: 400 })
    }
    const key = `${min}-${max}`
    if (seen.has(key)) {
      return Response.json({ error: `Row ${i + 1}: duplicate range ${min}-${max}` }, { status: 400 })
    }
    seen.add(key)
    cleaned.push({ min, max, grade, order })
  }

  // Detect overlaps (warn but DO NOT block — spec says allow with warning)
  const sorted = [...cleaned].sort((a, b) => a.min - b.min)
  const warnings: string[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (cur.min <= prev.max) {
      warnings.push(`Overlap: ${prev.grade} (${prev.min}-${prev.max}) and ${cur.grade} (${cur.min}-${cur.max})`)
    }
    if (cur.min > prev.max + 1) {
      warnings.push(`Gap between ${prev.grade} (max ${prev.max}) and ${cur.grade} (min ${cur.min})`)
    }
  }
  if (sorted[0]?.min > 0) warnings.push(`Scale does not start at 0 (starts at ${sorted[0].min})`)
  if (sorted[sorted.length - 1]?.max < 100) {
    warnings.push(`Scale does not reach 100 (ends at ${sorted[sorted.length - 1].max})`)
  }

  // Replace all rows in a transaction
  await db.$transaction([
    db.gradeBoundary.deleteMany({}),
    ...cleaned.map((b) =>
      db.gradeBoundary.create({
        data: { min: b.min, max: b.max, grade: b.grade, order: b.order },
      }),
    ),
  ])

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'GRADING_UPDATED',
    context: {
      boundaries: cleaned.map((b) => `${b.grade}:${b.min}-${b.max}`),
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  })

  return Response.json({ ok: true, items: cleaned, warnings })
}
