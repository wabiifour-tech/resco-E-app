import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { hashPassword } from '@/lib/password'
import { z } from 'zod'

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export async function POST(
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
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { password } = parsed.data

  const passwordHash = hashPassword(password)

  await db.user.update({
    where: { id },
    data: { passwordHash },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'PASSWORD_CHANGED',
    context: {
      teacherId: id,
      teacherName: existing.name,
      email: existing.email,
    },
  })

  return Response.json({ ok: true })
}
