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

// ─── Shared serializer (mirror of /api/results/route.ts) ──────────────────────

type PriorTotals = { firstTerm: number | null; secondTerm: number | null }

async function fetchPriorTotals(opts: {
  studentId: string
  subjectId: string
  sessionId: string
  termOrder: number
}): Promise<PriorTotals> {
  const out: PriorTotals = { firstTerm: null, secondTerm: null }
  if (opts.termOrder <= 1) return out
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
    if (t.order === 1) out.firstTerm = r?.total ?? null
    if (t.order === 2) out.secondTerm = r?.total ?? null
  }
  return out
}

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

async function serialize(row: any) {
  const termOrder = row.term?.order ?? 1
  const priors = await fetchPriorTotals({
    studentId: row.studentId,
    subjectId: row.subjectId,
    sessionId: row.sessionId,
    termOrder,
  })
  const cumulative = computeCumulativeFor(termOrder, row.total, priors)
  // Result has no classArm relation — fetch separately.
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
      ? { id: row.remark.id, category: row.remark.category, text: row.remark.text }
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
    subject: { id: row.subject.id, name: row.subject.name, code: row.subject.code ?? null },
    session: { id: row.session.id, name: row.session.name },
    term: { id: row.term.id, name: row.term.name, order: row.term.order, sessionId: row.term.sessionId },
    classArm: classArm
      ? { id: classArm.id, fullName: classArm.fullName }
      : { id: row.classArmId, fullName: row.classArmId },
    priorTotals: priors,
    cumulative,
  }
}

const includeClause = {
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
}

// ─── GET — fetch a single result ──────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  const row = await db.result.findUnique({
    where: { id },
    include: includeClause,
  })
  if (!row) return Response.json({ error: 'Result not found' }, { status: 404 })

  // Authorization
  if (u.role === 'TEACHER') {
    const authU = await requireTeacherAuthorized(row.classArmId, row.subjectId)
    if (!authU) return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return Response.json({ result: await serialize(row) })
}

// ─── PUT — full update of a single result ─────────────────────────────────────

const putSchema = z.object({
  ca: z.number({ invalid_type_error: 'CA must be a number' }).min(0).max(CA_MAX),
  exam: z.number({ invalid_type_error: 'Examination must be a number' }).min(0).max(EXAM_MAX),
  remarkId: z.string().nullable().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  const existing = await db.result.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { id: true, name: true } },
    },
  })
  if (!existing) return Response.json({ error: 'Result not found' }, { status: 404 })

  // Authorization
  const authU = await requireTeacherAuthorized(existing.classArmId, existing.subjectId)
  if (!authU) {
    return Response.json(
      { error: 'You are not assigned to this class arm and subject' },
      { status: 403 },
    )
  }

  // Lock check
  if (existing.status === 'SUBMITTED' || existing.status === 'APPROVED') {
    return Response.json(
      {
        error: `This result is already ${existing.status}. Editing is locked until the principal reopens it.`,
      },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { ca, exam, remarkId } = parsed.data

  const scoreErr = validateScore(ca, exam)
  if (scoreErr) return Response.json({ error: scoreErr }, { status: 400 })

  if (remarkId) {
    const r = await db.remark.findUnique({ where: { id: remarkId } })
    if (!r) return Response.json({ error: 'Remark not found' }, { status: 400 })
  }

  const total = computeTotal(ca, exam)
  const boundaries = await loadGradeBoundaries()
  const grade = gradeForTotal(total, boundaries)

  const updated = await db.result.update({
    where: { id },
    data: {
      ca,
      exam,
      total,
      grade,
      remarkId: remarkId ?? null,
      status: 'SAVED',
      enteredByTeacherId: authU.teacherId,
    },
    include: includeClause,
  })

  await recomputePositions({
    subjectId: existing.subjectId,
    classArmId: existing.classArmId,
    sessionId: existing.sessionId,
    termId: existing.termId,
  })

  const ctx = {
    resultId: existing.id,
    studentId: existing.studentId,
    studentName: `${existing.student.firstName} ${existing.student.lastName}`,
    subjectId: existing.subjectId,
    subjectName: existing.subject.name,
    sessionId: existing.sessionId,
    termId: existing.termId,
    classArmId: existing.classArmId,
    ca,
    exam,
    total,
    grade,
  }
  await logAudit({
    userId: authU.id,
    userName: authU.name,
    userRole: authU.role,
    action: 'RESULT_EDITED',
    context: ctx,
  })
  await logAudit({
    userId: authU.id,
    userName: authU.name,
    userRole: authU.role,
    action: 'RESULT_SAVED',
    context: ctx,
  })

  return Response.json({ result: await serialize(updated) })
}

// ─── PATCH — partial update (e.g. set remark only) ───────────────────────────

const patchSchema = z.object({
  ca: z.number().min(0).max(CA_MAX).optional(),
  exam: z.number().min(0).max(EXAM_MAX).optional(),
  remarkId: z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  const existing = await db.result.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { id: true, name: true } },
    },
  })
  if (!existing) return Response.json({ error: 'Result not found' }, { status: 404 })

  const authU = await requireTeacherAuthorized(existing.classArmId, existing.subjectId)
  if (!authU) {
    return Response.json(
      { error: 'You are not assigned to this class arm and subject' },
      { status: 403 },
    )
  }

  if (existing.status === 'SUBMITTED' || existing.status === 'APPROVED') {
    return Response.json(
      { error: `This result is already ${existing.status}. Editing is locked.` },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { ca, exam, remarkId } = parsed.data

  // Merge with existing values to recompute total/grade
  const newCa = ca ?? existing.ca ?? 0
  const newExam = exam ?? existing.exam ?? 0
  // Only validate if either score was provided
  if (ca !== undefined || exam !== undefined) {
    const scoreErr = validateScore(newCa, newExam)
    if (scoreErr) return Response.json({ error: scoreErr }, { status: 400 })
  }

  if (remarkId) {
    const r = await db.remark.findUnique({ where: { id: remarkId } })
    if (!r) return Response.json({ error: 'Remark not found' }, { status: 400 })
  }

  const data: any = {}
  if (ca !== undefined) data.ca = newCa
  if (exam !== undefined) data.exam = newExam
  if (remarkId !== undefined) data.remarkId = remarkId ?? null

  // Recompute total + grade if any score changed
  if (ca !== undefined || exam !== undefined) {
    const total = computeTotal(newCa, newExam)
    const boundaries = await loadGradeBoundaries()
    data.total = total
    data.grade = gradeForTotal(total, boundaries)
    data.status = 'SAVED'
    data.enteredByTeacherId = authU.teacherId
  }

  const updated = await db.result.update({
    where: { id },
    data,
    include: includeClause,
  })

  if (ca !== undefined || exam !== undefined) {
    await recomputePositions({
      subjectId: existing.subjectId,
      classArmId: existing.classArmId,
      sessionId: existing.sessionId,
      termId: existing.termId,
    })
  }

  const ctx = {
    resultId: existing.id,
    studentId: existing.studentId,
    studentName: `${existing.student.firstName} ${existing.student.lastName}`,
    subjectId: existing.subjectId,
    subjectName: existing.subject.name,
    sessionId: existing.sessionId,
    termId: existing.termId,
    classArmId: existing.classArmId,
    patched: Object.keys(data),
  }
  await logAudit({
    userId: authU.id,
    userName: authU.name,
    userRole: authU.role,
    action: 'RESULT_EDITED',
    context: ctx,
  })

  return Response.json({ result: await serialize(updated) })
}
