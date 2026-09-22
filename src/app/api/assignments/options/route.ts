import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'

// RESCO eCard — Assignment Options (FLAT structure, NO class arms).
// Returns teachers, classes, and (per-class) offered subjects needed to
// populate the multi-class multi-subject assignment form. Principal-only.
//
// `classSubjects` maps classId → [subjectId] that the class offers, so the
// form shows only offered subjects per class (principal can add more via
// the Subject Management → Class-Subjects config).

export async function GET(_req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const [teachers, classes, subjects, classSubjects] = await Promise.all([
    db.teacher.findMany({
      where: { user: { active: true } },
      include: { user: { select: { name: true, email: true, active: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    db.class.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, level: true, category: true },
    }),
    db.subject.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.classSubject.findMany({ select: { classId: true, subjectId: true } }),
  ])

  // Map classId → offered subjectIds
  const offeredByClass: Record<string, string[]> = {}
  for (const cs of classSubjects) {
    if (!offeredByClass[cs.classId]) offeredByClass[cs.classId] = []
    offeredByClass[cs.classId].push(cs.subjectId)
  }

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
    classSubjects: offeredByClass,
  })
}
