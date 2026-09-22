import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { hashPassword } from '@/lib/password'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required (min 2 characters)'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  active: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const active = url.searchParams.get('active') // 'true' | 'false' | undefined

  const where: any = { role: 'TEACHER' }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
    ]
  }
  if (active === 'true') where.active = true
  if (active === 'false') where.active = false

  const teachers = await db.user.findMany({
    where,
    include: {
      teacher: { select: { id: true, _count: { select: { assignments: true } } } },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })

  const rows = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    role: t.role,
    active: t.active,
    teacherId: t.teacher?.id ?? null,
    assignmentCount: t.teacher?._count.assignments ?? 0,
    createdAt: t.createdAt,
  }))

  return Response.json({ teachers: rows, count: rows.length })
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
  const { name, email, password, active } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'A user with this email already exists' }, { status: 409 })
  }

  const passwordHash = hashPassword(password)

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'TEACHER',
        active,
      },
    })
    const teacher = await tx.teacher.create({
      data: { userId: user.id },
    })
    return { user, teacher }
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_CREATED',
    context: {
      teacherId: created.teacher.id,
      teacherName: created.user.name,
      email: created.user.email,
      active: created.user.active,
    },
  })

  return Response.json(
    {
      teacher: {
        id: created.user.id,
        teacherId: created.teacher.id,
        name: created.user.name,
        email: created.user.email,
        active: created.user.active,
      },
    },
    { status: 201 },
  )
}
