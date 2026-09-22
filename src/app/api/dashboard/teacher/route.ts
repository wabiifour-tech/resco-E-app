import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveSessionAndTerm } from '@/lib/session'

export const dynamic = 'force-dynamic'

// GET /api/dashboard/teacher
// Teacher-only dashboard summary: their identity, current session+term,
// their assignments (with distinct classes + subjects), and result
// status counts for their assigned (classId, subjectId) combos in the
// active session+term. Principals are forbidden (their dashboard lives
// at /api/dashboard/principal).
// The distinct-class list uses `class: { id, name }` (NOT classArm).
export async function GET() {
  const u = await getSession()
  if (!u) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (u.role !== 'TEACHER' || !u.teacherId) {
    return Response.json({ error: 'Teacher access required' }, { status: 403 })
  }

  const teacherId = u.teacherId
  const { session, term } = await getActiveSessionAndTerm()

  // ── Assignments + class-teacher responsibilities ───────────────────────
  const [assignments, classTeacherRows] = await Promise.all([
    db.teacherAssignment.findMany({
      where: { teacherId },
      include: {
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [
        { class: { level: 'asc' } },
        { class: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    }),
    db.classTeacher.findMany({
      where: { teacherId },
      include: { class: { select: { id: true, name: true, level: true, category: true } } },
      orderBy: { class: { level: 'asc' } },
    }),
  ])

  const ctClassIds = new Set(classTeacherRows.map((ct) => ct.classId))

  const assignmentRows = assignments.map((a) => ({
    classId: a.classId,
    className: a.class.name,
    classLevel: a.class.level,
    subjectId: a.subjectId,
    subjectName: a.subject.name,
    isClassTeacher: ctClassIds.has(a.classId),
  }))

  // Distinct classes + subjects (a teacher sees a class if they teach any
  // subject there OR are the class teacher of it).
  const seenClasses = new Map<string, { name: string; isClassTeacher: boolean }>()
  const seenSubs = new Map<string, string>()
  for (const a of assignmentRows) {
    if (!seenClasses.has(a.classId)) {
      seenClasses.set(a.classId, { name: a.className, isClassTeacher: a.isClassTeacher })
    }
    if (!seenSubs.has(a.subjectId)) seenSubs.set(a.subjectId, a.subjectName)
  }
  // Also include classes where the teacher is class teacher but teaches no subject
  for (const ct of classTeacherRows) {
    if (!seenClasses.has(ct.classId)) {
      seenClasses.set(ct.classId, { name: ct.class.name, isClassTeacher: true })
    }
  }
  const classes = Array.from(seenClasses.entries()).map(([id, { name, isClassTeacher }]) => ({
    id,
    name,
    isClassTeacher,
  }))
  const subjects = Array.from(seenSubs.entries()).map(([id, name]) => ({
    id,
    name,
  }))
  const classTeacherClasses = classTeacherRows.map((ct) => ({
    id: ct.class.id,
    name: ct.class.name,
    level: ct.class.level,
    category: ct.class.category,
  }))

  // ── Results by status for this teacher's assignments + active session/term ─
  let saved = 0
  let submitted = 0
  let approved = 0
  let needsCorrection = 0

  const subjectIds = Array.from(seenSubs.keys())
  const classIds = Array.from(seenClasses.keys())

  if (session && term && subjectIds.length > 0 && classIds.length > 0) {
    const baseWhere = {
      sessionId: session.id,
      termId: term.id,
      subjectId: { in: subjectIds },
      classId: { in: classIds },
    }
    ;[saved, submitted, approved, needsCorrection] = await Promise.all([
      db.result.count({ where: { ...baseWhere, status: 'SAVED' } }),
      db.result.count({ where: { ...baseWhere, status: 'SUBMITTED' } }),
      db.result.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      db.result.count({ where: { ...baseWhere, status: 'NEEDS_CORRECTION' } }),
    ])
  }

  return Response.json({
    teacher: { name: u.name, email: u.email },
    current: {
      sessionName: session?.name ?? null,
      termName: term?.name ?? null,
      sessionId: session?.id ?? null,
      termId: term?.id ?? null,
    },
    assignments: assignmentRows,
    classes,
    subjects,
    classTeacherClasses,
    results: { saved, submitted, approved, needsCorrection },
  })
}
