import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'

// Returns all classes with their arms (used by the student form so the
// frontend can filter arms by class without an extra round-trip).
export async function GET(_req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const classes = await db.class.findMany({
    include: {
      arms: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, fullName: true },
      },
    },
    orderBy: { level: 'asc' },
  })

  return Response.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      arms: c.arms,
    })),
  })
}
