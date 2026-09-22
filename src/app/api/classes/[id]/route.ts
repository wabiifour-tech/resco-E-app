import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// RESCO eCard — Class detail API (FLAT structure, NO class arms).

const editClassSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required').max(50).optional(),
  level: z.number().int().min(0).max(50).optional(),
  category: z
    .enum(['Early Years', 'Nursery', 'Primary', 'Junior Secondary', 'Senior Secondary'])
    .optional()
    .nullable(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const cls = await db.class.findUnique({
    where: { id },
    include: { _count: { select: { students: true, assignments: true, results: true } } },
  })
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 })

  return Response.json({
    class: {
      id: cls.id,
      name: cls.name,
      level: cls.level,
      category: cls.category ?? null,
      studentCount: cls._count.students,
      assignmentCount: cls._count.assignments,
      resultCount: cls._count.results,
    },
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = editClassSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const cls = await db.class.findUnique({ where: { id } })
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 })

  const data: { name?: string; level?: number; category?: string | null } = {}
  if (parsed.data.name !== undefined) {
    const newName = parsed.data.name
    if (newName !== cls.name) {
      const clash = await db.class.findUnique({ where: { name: newName } })
      if (clash) {
        return Response.json({ error: `Class "${newName}" already exists` }, { status: 400 })
      }
    }
    data.name = newName
  }
  if (parsed.data.level !== undefined) data.level = parsed.data.level
  if (parsed.data.category !== undefined) data.category = parsed.data.category

  const updated = await db.class.update({
    where: { id },
    data,
    include: { _count: { select: { students: true } } },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'CLASS_EDITED',
    context: {
      classId: id,
      before: { name: cls.name, level: cls.level, category: cls.category },
      after: data,
    },
  })

  return Response.json({
    class: {
      id: updated.id,
      name: updated.name,
      level: updated.level,
      category: updated.category ?? null,
      studentCount: updated._count.students,
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const cls = await db.class.findUnique({
    where: { id },
    include: { _count: { select: { students: true } } },
  })
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 })

  if (cls._count.students > 0) {
    return Response.json(
      {
        error: `Cannot delete "${cls.name}" — it has ${cls._count.students} student(s) assigned. Reassign or remove them first.`,
      },
      { status: 400 },
    )
  }

  // Cascade will remove teacher assignments + results that snapshot this class
  await db.class.delete({ where: { id } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'CLASS_EDITED',
    context: { classId: id, deleted: true, name: cls.name },
  })

  return Response.json({ ok: true })
}
