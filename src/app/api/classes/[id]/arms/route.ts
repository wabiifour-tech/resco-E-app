import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const addArmSchema = z.object({
  name: z.string().trim().min(1, 'Arm name is required').max(10),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = addArmSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const cls = await db.class.findUnique({ where: { id } })
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 })

  const armName = parsed.data.name.toUpperCase()
  const fullName = `${cls.name}${armName}`

  const existing = await db.classArm.findUnique({ where: { fullName } })
  if (existing) {
    return Response.json(
      { error: `Arm "${fullName}" already exists` },
      { status: 400 },
    )
  }

  // Ensure no duplicate arm name within this class
  const sameNameInClass = await db.classArm.findFirst({
    where: { classId: id, name: armName },
  })
  if (sameNameInClass) {
    return Response.json(
      { error: `Arm "${armName}" already exists for this class` },
      { status: 400 },
    )
  }

  const arm = await db.classArm.create({
    data: { classId: id, name: armName, fullName },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'CLASS_EDITED',
    context: { classId: id, action: 'ADD_ARM', armId: arm.id, fullName },
  })

  return Response.json({ arm }, { status: 201 })
}
