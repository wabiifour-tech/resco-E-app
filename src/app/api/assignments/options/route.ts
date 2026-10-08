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
//
// The `teachers` list contains all active teachers PLUS the principal's own
// Teacher record (if she has one) so she can be assigned to classes/subjects
// like any teacher. The principal is NOT returned by /api/teachers (the
// teacher-MANAGEMENT list) — only this assignments-options dropdown includes
// her, so she's assignable.

export async function GET(_req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const [teachers, classes, subjects, classSubjects, principalTeacher] =
    await Promise.all([
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
      // The principal's own Teacher record, so she can be assignable.
      u.teacherId
        ? db.teacher.findUnique({
            where: { id: u.teacherId },
            include: { user: { select: { name: true, email: true, active: true } } },
          })
        : Promise.resolve(null),
    ])

  // Map classId → offered subjectIds
  const offeredByClass: Record<string, string[]> = {}
  for (const cs of classSubjects) {
    if (!offeredByClass[cs.classId]) offeredByClass[cs.classId] = []
    offeredByClass[cs.classId].push(cs.subjectId)
  }

  // Build the teachers list: dedupe by id in case the principal's Teacher
  // record was already in the active-teachers query (it would not be, since
  // the teachers query filters `user.role` implicitly via the Teacher↔User
  // relation — but the principal's user role is PRINCIPAL, so her Teacher
  // row is only included if we add it explicitly).
  const teachersList: { id: string; name: string; email: string }[] = []
  const seenTeacherIds = new Set<string>()
  for (const t of teachers) {
    if (seenTeacherIds.has(t.id)) continue
    seenTeacherIds.add(t.id)
    teachersList.push({ id: t.id, name: t.user.name, email: t.user.email })
  }
  if (principalTeacher && !seenTeacherIds.has(principalTeacher.id)) {
    teachersList.push({
      id: principalTeacher.id,
      name: principalTeacher.user.name,
      email: principalTeacher.user.email,
    })
  }
  // Sort by name for a stable dropdown.
  teachersList.sort((a, b) => a.name.localeCompare(b.name))

  return Response.json({
    teachers: teachersList,
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
