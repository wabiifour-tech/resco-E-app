import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'

// RESCO eCard — Assignment Options (FLAT structure, NO class arms).
// Returns the teachers, classes, and subjects lists needed to populate the
// teacher-assignment form. Principal-only.

export async function GET(_req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const [teachers, classes, subjects] = await Promise.all([
    db.teacher.findMany({
      where: { user: { active: true } },
      include: { user: { select: { name: true, email: true, active: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    db.class.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, level: true, category: true },
    }),
    db.subject.findMany({ orderBy: { name: 'asc' } }),
  ])

  return Response.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.user.name,
      email: t.user.email,
    })),
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      category: c.category ?? null,
    })),
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
  })
}
