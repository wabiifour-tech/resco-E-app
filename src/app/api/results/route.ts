import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession, requireTeacherAuthorized } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  validateScore,
  computeTotal,
  gradeForTotal,
  loadGradeBoundaries,
  recomputePositions,
  computeCumulative,
  CA_MAX,
  EXAM_MAX,
} from '@/lib/results'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

type PriorTotals = {
  firstTerm: number | null
  secondTerm: number | null
}

type ResultRow = {
  id: string
  studentId: string
  subjectId: string
  sessionId: string
  termId: string
  classArmId: string
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
  remarkId: string | null
  remark: { id: string; category: string; text: string } | null
  status: string
  enteredByTeacherId: string | null
  enteredBy: { id: string; name: string } | null
  approvedById: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  student: {
    id: string
    admissionNumber: string
    firstName: string
    lastName: string
    otherNames: string | null
  }
  subject: { id: string; name: string; code: string | null }
  session: { id: string; name: string }
  term: { id: string; name: string; order: number; sessionId: string }
  classArm: { id: string; fullName: string }
  priorTotals: PriorTotals
  cumulative: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch a teacher's authorized (classArmId, subjectId) pairs as a Set
 * for fast filtering. Returns null for principals (no scoping).
 */
async function teacherScope(
  u: { role: string; teacherId: string | null },
): Promise<Set<string> | null> {
  if (u.role !== 'TEACHER' || !u.teacherId) return null
  const assignments = await db.teacherAssignment.findMany({
    where: { teacherId: u.teacherId },
    select: { classArmId: true, subjectId: true },
  })
  return new Set(assignments.map((a) => `${a.classArmId}|${a.subjectId}`))
}

/** Get prior term totals for a result (for carry-over display + cumulative). */
async function fetchPriorTotals(opts: {
  studentId: string
  subjectId: string
  sessionId: string
  termOrder: number
}): Promise<PriorTotals> {
  const result: PriorTotals = { firstTerm: null, secondTerm: null }
  if (opts.termOrder <= 1) return result

  const terms = await db.term.findMany({
    where: { sessionId: opts.sessionId, order: { lt: opts.termOrder } },
    select: { id: true, order: true },
  })

  for (const t of terms) {
    const r = await db.result.findUnique({
      where: {
        studentId_subjectId_sessionId_termId: {
          studentId: opts.studentId,
          subjectId: opts.subjectId,
          sessionId: opts.sessionId,
          termId: t.id,
        },
      },
      select: { total: true },
    })
    if (t.order === 1) result.firstTerm = r?.total ?? null
    if (t.order === 2) result.secondTerm = r?.total ?? null
  }
  return result
}

/** Compute cumulative for a term given the term total + prior totals. */
function computeCumulativeFor(
  termOrder: number,
  termTotal: number | null,
  priors: PriorTotals,
): number | null {
  if (termTotal == null || !Number.isFinite(termTotal)) return null
  if (termOrder === 1) return termTotal
  if (termOrder === 2) {
    if (priors.firstTerm == null) return null
    return computeCumulative(2, termTotal, [priors.firstTerm])
  }
  if (termOrder === 3) {
    if (priors.firstTerm == null || priors.secondTerm == null) return null
    return computeCumulative(3, termTotal, [priors.firstTerm, priors.secondTerm])
  }
  return null
}

async function serialize(row: any): Promise<ResultRow> {
  const termOrder = row.term?.order ?? 1
  const priors = await fetchPriorTotals({
    studentId: row.studentId,
    subjectId: row.subjectId,
    sessionId: row.sessionId,
    termOrder,
  })
  const cumulative = computeCumulativeFor(termOrder, row.total, priors)
  // Result has no classArm relation (only classArmId), so fetch separately.
  const classArm = row.classArmId
    ? await db.classArm.findUnique({
        where: { id: row.classArmId },
        select: { id: true, fullName: true },
      })
    : null
  return {
    id: row.id,
    studentId: row.studentId,
    subjectId: row.subjectId,
    sessionId: row.sessionId,
    termId: row.termId,
    classArmId: row.classArmId,
    ca: row.ca,
    exam: row.exam,
    total: row.total,
    grade: row.grade,
    position: row.position,
    remarkId: row.remarkId,
    remark: row.remark
      ? {
          id: row.remark.id,
          category: row.remark.category,
          text: row.remark.text,
        }
      : null,
    status: row.status,
    enteredByTeacherId: row.enteredByTeacherId,
    enteredBy: row.enteredBy
      ? { id: row.enteredBy.id, name: row.enteredBy.user?.name ?? '' }
      : null,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    student: {
      id: row.student.id,
      admissionNumber: row.student.admissionNumber,
      firstName: row.student.firstName,
      lastName: row.student.lastName,
      otherNames: row.student.otherNames ?? null,
    },
    subject: {
      id: row.subject.id,
      name: row.subject.name,
      code: row.subject.code ?? null,
    },
    session: { id: row.session.id, name: row.session.name },
    term: {
      id: row.term.id,
      name: row.term.name,
      order: row.term.order,
      sessionId: row.term.sessionId,
    },
    classArm: classArm
      ? { id: classArm.id, fullName: classArm.fullName }
      : { id: row.classArmId, fullName: row.classArmId },
    priorTotals: priors,
    cumulative,
  }
}

// ─── GET — list results with filters + carry-over prior totals ─────────────────

export async function GET(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId') ?? undefined
  const termId = url.searchParams.get('termId') ?? undefined
  const classArmId = url.searchParams.get('classArmId') ?? undefined
  const subjectId = url.searchParams.get('subjectId') ?? undefined
  const studentId = url.searchParams.get('studentId') ?? undefined
  const status = url.searchParams.get('status') ?? undefined

  const where: any = {}
  if (sessionId) where.sessionId = sessionId
  if (termId) where.termId = termId
  if (classArmId) where.classArmId = classArmId
  if (subjectId) where.subjectId = subjectId
  if (studentId) where.studentId = studentId
  if (status) where.status = status

  // Teacher scoping: only their assigned (classArmId, subjectId) pairs
  const scope = await teacherScope(u)
  if (scope) {
    if (scope.size === 0) return Response.json({ results: [], count: 0 })
    const orClauses = Array.from(scope).map((s) => {
      const [armId, subId] = s.split('|')
      return { classArmId: armId, subjectId: subId }
    })
    where.OR = orClauses
  }

  const rows = await db.result.findMany({
    where,
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          otherNames: true,
        },
      },
      subject: { select: { id: true, name: true, code: true } },
      session: { select: { id: true, name: true } },
      term: { select: { id: true, name: true, order: true, sessionId: true } },
      remark: { select: { id: true, category: true, text: true } },
      enteredBy: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: [
      { classArmId: 'asc' },
      { subject: { name: 'asc' } },
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
    ],
  })

  const results = await Promise.all(rows.map((r) => serialize(r)))
  return Response.json({ results, count: results.length })
}

// ─── POST — save (upsert) a single result row ─────────────────────────────────

const saveSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  sessionId: z.string().min(1, 'Session is required'),
  termId: z.string().min(1, 'Term is required'),
  classArmId: z.string().min(1, 'Class arm is required'),
  ca: z.number({ invalid_type_error: 'CA must be a number' }).min(0).max(CA_MAX),
  exam: z.number({ invalid_type_error: 'Examination must be a number' }).min(0).max(EXAM_MAX),
  remarkId: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { studentId, subjectId, sessionId, termId, classArmId, ca, exam, remarkId } =
    parsed.data

  // Authorization: teacher must own this (classArm, subject). Principal passes.
  const authU = await requireTeacherAuthorized(classArmId, subjectId)
  if (!authU) {
    return Response.json(
      { error: 'You are not assigned to this class arm and subject' },
      { status: 403 },
    )
  }

  // Validate scores (defensive — zod already ranged them but validateScore is canonical)
  const scoreErr = validateScore(ca, exam)
  if (scoreErr) return Response.json({ error: scoreErr }, { status: 400 })

  // Verify FK existence + student is in the class arm
  const [student, subject, session, term, classArm] = await Promise.all([
    db.student.findUnique({ where: { id: studentId } }),
    db.subject.findUnique({ where: { id: subjectId } }),
    db.academicSession.findUnique({ where: { id: sessionId } }),
    db.term.findUnique({ where: { id: termId } }),
    db.classArm.findUnique({ where: { id: classArmId } }),
  ])
  if (!student) return Response.json({ error: 'Student not found' }, { status: 400 })
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 400 })
  if (!session) return Response.json({ error: 'Session not found' }, { status: 400 })
  if (!term) return Response.json({ error: 'Term not found' }, { status: 400 })
  if (!classArm) return Response.json({ error: 'Class arm not found' }, { status: 400 })
  if (term.sessionId !== sessionId) {
    return Response.json(
      { error: 'Term does not belong to the selected session' },
      { status: 400 },
    )
  }
  if (student.classArmId !== classArmId) {
    return Response.json(
      { error: 'Student is not in the selected class arm' },
      { status: 400 },
    )
  }

  // Verify remark exists if provided
  if (remarkId) {
    const r = await db.remark.findUnique({ where: { id: remarkId } })
    if (!r) return Response.json({ error: 'Remark not found' }, { status: 400 })
  }

  // Existing row? (unique constraint: studentId+subjectId+sessionId+termId)
  const existing = await db.result.findUnique({
    where: {
      studentId_subjectId_sessionId_termId: {
        studentId,
        subjectId,
        sessionId,
        termId,
      },
    },
  })

  // Lock check — block edits once SUBMITTED or APPROVED
  if (existing && (existing.status === 'SUBMITTED' || existing.status === 'APPROVED')) {
    return Response.json(
      {
        error: `This result is already ${existing.status}. Editing is locked until the principal reopens it.`,
      },
      { status: 409 },
    )
  }

  const total = computeTotal(ca, exam)
  const boundaries = await loadGradeBoundaries()
  const grade = gradeForTotal(total, boundaries)

  const isCreate = !existing

  const row = await db.result.upsert({
    where: {
      studentId_subjectId_sessionId_termId: {
        studentId,
        subjectId,
        sessionId,
        termId,
      },
    },
    create: {
      studentId,
      subjectId,
      sessionId,
      termId,
      classArmId,
      ca,
      exam,
      total,
      grade,
      remarkId: remarkId ?? null,
      status: 'SAVED',
      enteredByTeacherId: authU.teacherId,
    },
    update: {
      classArmId, // snapshot might change if student reassigned
      ca,
      exam,
      total,
      grade,
      remarkId: remarkId ?? null,
      status: 'SAVED', // SAVED (or recover from NEEDS_CORRECTION)
      enteredByTeacherId: authU.teacherId,
    },
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          otherNames: true,
        },
      },
      subject: { select: { id: true, name: true, code: true } },
      session: { select: { id: true, name: true } },
      term: { select: { id: true, name: true, order: true, sessionId: true } },
      remark: { select: { id: true, category: true, text: true } },
      enteredBy: { select: { id: true, user: { select: { name: true } } } },
    },
  })

  // Recompute positions for the affected (subject, classArm, session, term) group
  await recomputePositions({ subjectId, classArmId, sessionId, termId })

  // Audit
  const ctx = {
    resultId: row.id,
    studentId,
    studentName: `${student.firstName} ${student.lastName}`,
    subjectId,
    subjectName: subject.name,
    sessionId,
    termId,
    classArmId,
    classArmName: classArm.fullName,
    ca,
    exam,
    total,
    grade,
  }
  await logAudit({
    userId: authU.id,
    userName: authU.name,
    userRole: authU.role,
    action: isCreate ? 'RESULT_CREATED' : 'RESULT_EDITED',
    context: ctx,
  })
  await logAudit({
    userId: authU.id,
    userName: authU.name,
    userRole: authU.role,
    action: 'RESULT_SAVED',
    context: ctx,
  })

  const serialized = await serialize(row)
  return Response.json({ result: serialized }, { status: isCreate ? 201 : 200 })
}
