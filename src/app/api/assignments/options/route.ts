import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Returns the teachers, class arms, and subjects lists needed to populate
 * the teacher-assignment form. Principal-only.
 */
export async function GET(_req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const [teachers, classArms, subjects] = await Promise.all([
    db.teacher.findMany({
      where: { user: { active: true } },
      include: { user: { select: { name: true, email: true, active: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    db.classArm.findMany({
      include: { class: { select: { name: true, level: true } } },
      orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
    }),
    db.subject.findMany({ orderBy: { name: 'asc' } }),
  ])

  return Response.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.user.name,
      email: t.user.email,
    })),
    classArms: classArms.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      className: a.class.name,
      level: a.class.level,
    })),
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
  })
}
