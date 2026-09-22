import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// RESCO eCard — Classes API (FLAT structure, NO class arms).
// A Class is a single flat entity { id, name (unique), level, category }.
// Students belong directly to a Class. TeacherAssignments are (Teacher, Class, Subject).

const createSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required').max(50),
  level: z.number().int().min(0).max(50).optional(),
  category: z
    .enum(['Early Years', 'Nursery', 'Primary', 'Junior Secondary', 'Senior Secondary'])
    .optional()
    .nullable(),
})

/**
 * GET /api/classes
 *   Principal only. Returns the flat list of classes (with student counts),
 *   optionally grouped by category when ?grouped=true.
 */
export async function GET(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const url = new URL(req.url)
  const grouped = url.searchParams.get('grouped') === 'true'

  const classes = await db.class.findMany({
    include: { _count: { select: { students: true } } },
    orderBy: { level: 'asc' },
  })

  const flat = classes.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    category: c.category ?? null,
    studentCount: c._count.students,
  }))

  if (!grouped) {
    return Response.json({ classes: flat })
  }

  // Group by category
  const groups: Record<string, typeof flat> = {}
  for (const c of flat) {
    const key = c.category ?? 'Uncategorized'
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  }
  return Response.json({ classes: flat, groups })
}

/**
 * POST /api/classes
 *   Principal only. Creates a new class. Name is unique.
 */
export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const name = parsed.data.name
  // Check for duplicate name (case-insensitive style: enforce exact unique)
  const clash = await db.class.findUnique({ where: { name } })
  if (clash) {
    return Response.json({ error: `Class "${name}" already exists` }, { status: 400 })
  }

  const cls = await db.class.create({
    data: {
      name,
      level: parsed.data.level ?? 0,
      category: parsed.data.category ?? null,
    },
    include: { _count: { select: { students: true } } },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'CLASS_CREATED',
    context: { classId: cls.id, name, level: cls.level, category: cls.category },
  })

  return Response.json(
    {
      class: {
        id: cls.id,
        name: cls.name,
        level: cls.level,
        category: cls.category ?? null,
        studentCount: cls._count.students,
      },
    },
    { status: 201 },
  )
}
