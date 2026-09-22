import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const editSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required (min 2 characters)').optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .optional(),
  active: z.boolean().optional(),
})

const toggleSchema = z.object({
  active: z.boolean(),
})

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })
  const { id } = await ctx.params

  const user = await db.user.findUnique({
    where: { id },
    include: {
      teacher: {
        select: {
          id: true,
          _count: { select: { assignments: true } },
        },
      },
    },
  })
  if (!user || user.role !== 'TEACHER') {
    return Response.json({ error: 'Teacher not found' }, { status: 404 })
  }

  return Response.json({
    teacher: {
      id: user.id,
      teacherId: user.teacher?.id ?? null,
      name: user.name,
      email: user.email,
      active: user.active,
      assignmentCount: user.teacher?._count.assignments ?? 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  })
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })
  const { id } = await ctx.params

  const existing = await db.user.findUnique({ where: { id } })
  if (!existing || existing.role !== 'TEACHER') {
    return Response.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const data = parsed.data

  // Email uniqueness check if email is changing
  if (data.email && data.email !== existing.email) {
    const conflict = await db.user.findUnique({ where: { email: data.email } })
    if (conflict && conflict.id !== id) {
      return Response.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_EDITED',
    context: {
      teacherId: id,
      teacherName: updated.name,
      changes: {
        ...(data.name !== undefined && data.name !== existing.name ? { name: `${existing.name} → ${data.name}` } : {}),
        ...(data.email !== undefined && data.email !== existing.email ? { email: `${existing.email} → ${data.email}` } : {}),
        ...(data.active !== undefined && data.active !== existing.active ? { active: `${existing.active} → ${data.active}` } : {}),
      },
    },
  })

  return Response.json({
    teacher: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      active: updated.active,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })
  const { id } = await ctx.params

  const existing = await db.user.findUnique({ where: { id } })
  if (!existing || existing.role !== 'TEACHER') {
    return Response.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = toggleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { active } = parsed.data

  if (active === existing.active) {
    return Response.json({
      teacher: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        active: existing.active,
      },
    })
  }

  const updated = await db.user.update({
    where: { id },
    data: { active },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: active ? 'TEACHER_ACTIVATED' : 'TEACHER_DEACTIVATED',
    context: {
      teacherId: id,
      teacherName: updated.name,
    },
  })

  return Response.json({
    teacher: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      active: updated.active,
    },
  })
}
