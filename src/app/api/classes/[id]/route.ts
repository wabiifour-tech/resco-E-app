import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const editClassSchema = z.object({
  name: z.string().trim().min(1, 'Class name is required').max(50),
  level: z.number().int().min(0).max(20).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const cls = await db.class.findUnique({
    where: { id },
    include: { arms: { orderBy: { name: 'asc' } } },
  })
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 })

  return Response.json({ class: cls })
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

  const newName = parsed.data.name.toUpperCase()
  if (newName !== cls.name) {
    const clash = await db.class.findUnique({ where: { name: newName } })
    if (clash) {
      return Response.json({ error: `Class "${newName}" already exists` }, { status: 400 })
    }
  }

  const data: { name?: string; level?: number } = { name: newName }
  if (parsed.data.level !== undefined) data.level = parsed.data.level

  const updated = await db.class.update({
    where: { id },
    data,
    include: { arms: true },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'CLASS_EDITED',
    context: { classId: id, before: { name: cls.name, level: cls.level }, after: data },
  })

  return Response.json({ class: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const cls = await db.class.findUnique({
    where: { id },
    include: { arms: true, _count: { select: { students: true } } },
  })
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 })

  if (cls._count.students > 0) {
    return Response.json(
      { error: `Cannot delete "${cls.name}" — it has ${cls._count.students} student(s) assigned. Reassign or remove them first.` },
      { status: 400 },
    )
  }

  // Cascade delete will remove arms + their teacher assignments
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
