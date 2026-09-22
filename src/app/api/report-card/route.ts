import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { computeCumulative, ordinal } from '@/lib/results'

export const dynamic = 'force-dynamic'

// RESCO eCard — Report Card (FLAT structure, NO class arms).
// GET /api/report-card?studentId=&sessionId=&termId=
//
// Returns the full hydrated report card payload for a single student in a
// specific session+term. The student's class comes from `student.class.name`
// (NO classArmName). Teacher auth: must have ANY assignment in the student's
// classId. Position is per CLASS (not class arm). Class average is per CLASS.

// ─── Types ────────────────────────────────────────────────────────────────────

type TermResult = {
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
} | null

type SubjectRow = {
  subjectId: string
  subjectName: string
  firstTerm: TermResult
  secondTerm: TermResult
  thirdTerm: TermResult
  currentTerm: {
    ca: number | null
    exam: number | null
    total: number | null
    grade: string | null
    position: number | null
    remarkText: string | null
    remarkCategory: string | null
  }
  cumulative: number | null
  position: number | null
}

type ReportCardResponse = {
  settings: {
    schoolName: string
    address: string
    phone: string | null
    motto: string
    logoDataUrl: string | null
    principalName: string | null
    principalSignatureDataUrl: string | null
  }
  session: { id: string; name: string }
  term: { id: string; name: string; order: number }
  student: {
    id: string
    admissionNumber: string
    fullName: string
    className: string
    gender: string | null
  }
  subjects: SubjectRow[]
  classAverage: number | null
  // convenience flags
  termOrder: number
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auth check: principal sees any student. Teacher must have ANY assignment
 * for the student's class.
 */
async function authorize(
  u: { id: string; role: string; teacherId: string | null },
  studentId: string,
): Promise<{ ok: true; student: any } | { ok: false; status: number; error: string }> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { id: true, name: true } },
    },
  })
  if (!student) return { ok: false, status: 404, error: 'Student not found' }
  if (u.role === 'PRINCIPAL') return { ok: true, student }
  if (u.role !== 'TEACHER' || !u.teacherId) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  const studentClassId = student.classId
  if (!studentClassId) {
    return { ok: false, status: 400, error: 'Student has no class assigned' }
  }
  const assignment = await db.teacherAssignment.findFirst({
    where: { teacherId: u.teacherId, classId: studentClassId },
    select: { id: true },
  })
  if (!assignment) {
    return { ok: false, status: 403, error: 'You are not assigned to this student\'s class' }
  }
  return { ok: true, student }
}

/**
 * Get a single term's result for the (student, subject, session, term).
 */
async function getTermResult(opts: {
  studentId: string
  subjectId: string
  sessionId: string
  termId: string
}): Promise<{
  row: any
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
  remarkId: string | null
  remarkText: string | null
  remarkCategory: string | null
} | null> {
  const r = await db.result.findUnique({
    where: {
      studentId_subjectId_sessionId_termId: {
        studentId: opts.studentId,
        subjectId: opts.subjectId,
        sessionId: opts.sessionId,
        termId: opts.termId,
      },
    },
    include: {
      remark: { select: { id: true, category: true, text: true } },
    },
  })
  if (!r) return null
  return {
    row: r,
    ca: r.ca,
    exam: r.exam,
    total: r.total,
    grade: r.grade,
    position: r.position,
    remarkId: r.remarkId,
    remarkText: r.remark?.text ?? null,
    remarkCategory: r.remark?.category ?? null,
  }
}

function serializeTermResult(tr: Awaited<ReturnType<typeof getTermResult>>): TermResult {
  if (!tr) return null
  return {
    ca: tr.ca,
    exam: tr.exam,
    total: tr.total,
    grade: tr.grade,
    position: tr.position,
  }
}

// ─── GET /api/report-card?studentId=&sessionId=&termId= ──────────────────────

export async function GET(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const studentId = url.searchParams.get('studentId')
  const sessionId = url.searchParams.get('sessionId')
  const termId = url.searchParams.get('termId')

  if (!studentId || !sessionId || !termId) {
    return Response.json(
      { error: 'studentId, sessionId, and termId are required' },
      { status: 400 },
    )
  }

  // Validate session + term
  const [session, term] = await Promise.all([
    db.academicSession.findUnique({ where: { id: sessionId }, select: { id: true, name: true } }),
    db.term.findUnique({ where: { id: termId }, select: { id: true, name: true, order: true, sessionId: true } }),
  ])
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (!term) return Response.json({ error: 'Term not found' }, { status: 404 })
  if (term.sessionId !== session.id) {
    return Response.json({ error: 'Term does not belong to the selected session' }, { status: 400 })
  }

  // Authorize + load student
  const auth = await authorize(u, studentId)
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status })
  }
  const student: any = auth.student
  const termOrder = term.order // 1, 2, or 3

  // Get the school settings (singleton)
  const settings = await db.schoolSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      schoolName: "Redeemer's Schools and College",
      address: 'Owotoro, Oyo State, Nigeria',
      motto: 'Excellence, Knowledge, and Wisdom',
    },
  })

  // Get all three terms of this session so we can fetch the prior term totals
  const sessionTerms = await db.term.findMany({
    where: { sessionId: session.id },
    select: { id: true, name: true, order: true },
    orderBy: { order: 'asc' },
  })
  const firstTermRow = sessionTerms.find((t) => t.order === 1) ?? null
  const secondTermRow = sessionTerms.find((t) => t.order === 2) ?? null
  const thirdTermRow = sessionTerms.find((t) => t.order === 3) ?? null
  const currentTermRow =
    termOrder === 1 ? firstTermRow : termOrder === 2 ? secondTermRow : thirdTermRow
  if (!currentTermRow) {
    return Response.json({ error: 'Current term not found in session' }, { status: 400 })
  }

  // Find all subjects this student has results for in this session.
  // Additionally, we ALSO include any subjects where the student has a result in
  // ANY term of this session (so the prior-term columns aren't dropped).
  const subjectIdsSet = new Set<string>()
  const allResultsForStudentInSession = await db.result.findMany({
    where: { studentId: student.id, sessionId: session.id },
    select: { subjectId: true },
  })
  for (const r of allResultsForStudentInSession) subjectIdsSet.add(r.subjectId)

  // Also include any subjects that the student's class has a teacher assignment
  // for, so that subjects with no entered scores yet still appear (showing
  // dashes).
  if (student.classId) {
    const classAssignments = await db.teacherAssignment.findMany({
      where: { classId: student.classId },
      select: { subjectId: true },
    })
    for (const a of classAssignments) subjectIdsSet.add(a.subjectId)
  }

  // Fetch subject names + sort alphabetically
  const subjectIds = Array.from(subjectIdsSet)
  const subjectRows = subjectIds.length
    ? await db.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      })
    : []
  // Fallback for ids that may not exist in Subject anymore (shouldn't happen,
  // but defensively include them too with a placeholder name)
  const foundIds = new Set(subjectRows.map((s) => s.id))
  const allSubjects = [...subjectRows]
  for (const id of subjectIds) {
    if (!foundIds.has(id)) {
      allSubjects.push({ id, name: '(Unknown subject)', code: null })
    }
  }
  allSubjects.sort((a, b) => a.name.localeCompare(b.name))

  // For each subject: fetch each term's result, build the row.
  const subjects: SubjectRow[] = []
  const classIdForPositions = student.classId ?? ''
  let totalsSumForAverage = 0
  let totalsCountForAverage = 0

  for (const s of allSubjects) {
    const firstTR = firstTermRow
      ? await getTermResult({
          studentId: student.id,
          subjectId: s.id,
          sessionId: session.id,
          termId: firstTermRow.id,
        })
      : null
    const secondTR = secondTermRow
      ? await getTermResult({
          studentId: student.id,
          subjectId: s.id,
          sessionId: session.id,
          termId: secondTermRow.id,
        })
      : null
    const thirdTR = thirdTermRow
      ? await getTermResult({
          studentId: student.id,
          subjectId: s.id,
          sessionId: session.id,
          termId: thirdTermRow.id,
        })
      : null

    // Current term's row (matches termOrder)
    const currentTR =
      termOrder === 1 ? firstTR : termOrder === 2 ? secondTR : thirdTR

    // Build priorTotals for cumulative computation
    const priorTotals: number[] = []
    if (termOrder === 2) {
      if (firstTR?.total != null) priorTotals.push(firstTR.total)
    } else if (termOrder === 3) {
      if (firstTR?.total != null) priorTotals.push(firstTR.total)
      if (secondTR?.total != null) priorTotals.push(secondTR.total)
    }

    let cumulative: number | null = null
    if (currentTR?.total != null) {
      if (termOrder === 1) {
        cumulative = currentTR.total
      } else {
        cumulative = computeCumulative(termOrder, currentTR.total, priorTotals)
      }
    }

    // Position: prefer the current-term's stored position. The position is
    // computed per CLASS (via recomputePositions({ subjectId, classId, ... })).
    let position: number | null = currentTR?.position ?? null
    if (position == null && currentTR?.row && classIdForPositions) {
      position = currentTR.row.position ?? null
    }

    // For class average: take the current-term totals of ALL students in this
    // subject+class+session+term (computed in aggregate after the loop).
    if (currentTR?.total != null) {
      totalsSumForAverage += currentTR.total
      totalsCountForAverage += 1
    }

    subjects.push({
      subjectId: s.id,
      subjectName: s.name,
      firstTerm: serializeTermResult(firstTR),
      secondTerm: serializeTermResult(secondTR),
      thirdTerm: serializeTermResult(thirdTR),
      currentTerm: {
        ca: currentTR?.ca ?? null,
        exam: currentTR?.exam ?? null,
        total: currentTR?.total ?? null,
        grade: currentTR?.grade ?? null,
        position: currentTR?.position ?? null,
        remarkText: currentTR?.remarkText ?? null,
        remarkCategory: currentTR?.remarkCategory ?? null,
      },
      cumulative,
      position,
    })
  }

  // Class average: average of the current-term totals of all results for
  // this (class, session, term). This gives a meaningful "class average"
  // for the report card footer.
  let classAverage: number | null = null
  if (classIdForPositions) {
    const agg = await db.result.aggregate({
      where: {
        classId: classIdForPositions,
        sessionId: session.id,
        termId: term.id,
        total: { not: null },
      },
      _avg: { total: true },
      _count: { total: true },
    })
    if (agg._count.total > 0 && agg._avg.total != null) {
      classAverage = Math.round(agg._avg.total * 100) / 100
    }
  }
  // Fallback if no class snapshot — use just this student's totals
  if (classAverage == null && totalsCountForAverage > 0) {
    classAverage = Math.round((totalsSumForAverage / totalsCountForAverage) * 100) / 100
  }

  // Audit
  const fullName = [student.firstName, student.otherNames, student.lastName]
    .filter(Boolean)
    .join(' ')
  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'REPORT_CARD_GENERATED',
    context: {
      studentId: student.id,
      studentName: fullName,
      admissionNumber: student.admissionNumber,
      sessionId: session.id,
      sessionName: session.name,
      termId: term.id,
      termName: term.name,
      termOrder,
      subjectsCount: subjects.length,
    },
  })

  const payload: ReportCardResponse = {
    settings: {
      schoolName: settings.schoolName,
      address: settings.address,
      phone: settings.phone,
      motto: settings.motto,
      logoDataUrl: settings.logoDataUrl,
      principalName: settings.principalName,
      principalSignatureDataUrl: settings.principalSignatureDataUrl,
    },
    session: { id: session.id, name: session.name },
    term: { id: term.id, name: term.name, order: termOrder },
    student: {
      id: student.id,
      admissionNumber: student.admissionNumber,
      fullName,
      className: student.class?.name ?? '-',
      gender: student.gender ?? null,
    },
    subjects,
    classAverage,
    termOrder,
    generatedAt: new Date().toISOString(),
  }
  // ordinal is used downstream by the client (re-exported here for convenience)
  void ordinal

  return Response.json(payload)
}
