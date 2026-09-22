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

  // ── Assignments ──────────────────────────────────────────────────────────
  const assignments = await db.teacherAssignment.findMany({
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
  })

  const assignmentRows = assignments.map((a) => ({
    classId: a.classId,
    className: a.class.name,
    classLevel: a.class.level,
    subjectId: a.subjectId,
    subjectName: a.subject.name,
  }))

  // Distinct classes + subjects
  const seenClasses = new Map<string, { name: string }>()
  const seenSubs = new Map<string, string>()
  for (const a of assignmentRows) {
    if (!seenClasses.has(a.classId)) seenClasses.set(a.classId, { name: a.className })
    if (!seenSubs.has(a.subjectId)) seenSubs.set(a.subjectId, a.subjectName)
  }
  const classes = Array.from(seenClasses.entries()).map(([id, { name }]) => ({
    id,
    name,
  }))
  const subjects = Array.from(seenSubs.entries()).map(([id, name]) => ({
    id,
    name,
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
    results: { saved, submitted, approved, needsCorrection },
  })
}
