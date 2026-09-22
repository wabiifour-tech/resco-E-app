import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveSessionAndTerm } from '@/lib/session'

export const dynamic = 'force-dynamic'

// GET /api/dashboard/teacher
// Teacher-only dashboard summary: their identity, current session+term,
// their assignments (with distinct class arms + subjects), and result
// status counts for their assigned (classArmId, subjectId) combos in the
// active session+term. Principals are forbidden (their dashboard lives
// at /api/dashboard/principal).
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
      classArm: { select: { id: true, fullName: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: [{ classArm: { fullName: 'asc' } }, { subject: { name: 'asc' } }],
  })

  const assignmentRows = assignments.map((a) => ({
    classArmId: a.classArmId,
    classArmName: a.classArm.fullName,
    subjectId: a.subjectId,
    subjectName: a.subject.name,
  }))

  // Distinct class arms + subjects
  const seenArms = new Map<string, string>()
  const seenSubs = new Map<string, string>()
  for (const a of assignmentRows) {
    if (!seenArms.has(a.classArmId)) seenArms.set(a.classArmId, a.classArmName)
    if (!seenSubs.has(a.subjectId)) seenSubs.set(a.subjectId, a.subjectName)
  }
  const classArms = Array.from(seenArms.entries()).map(([id, fullName]) => ({
    id,
    fullName,
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
  const classArmIds = Array.from(seenArms.keys())

  if (session && term && subjectIds.length > 0 && classArmIds.length > 0) {
    const baseWhere = {
      sessionId: session.id,
      termId: term.id,
      subjectId: { in: subjectIds },
      classArmId: { in: classArmIds },
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
    classArms,
    subjects,
    results: { saved, submitted, approved, needsCorrection },
  })
}
