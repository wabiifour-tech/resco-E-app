import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveSessionAndTerm } from '@/lib/session'
import { computeCumulative } from '@/lib/results'

/**
 * GET /api/approvals
 *   Principal only. Returns a list of results to review with the principal's
 *   filters (sessionId, termId, classArmId, subjectId, status). Defaults to
 *   status=SUBMITTED and the active session/term. Also returns a summary of
 *   counts (pending/approved/needsCorrection) for the filtered session+term
 *   so the principal can see at-a-glance how the term is progressing.
 *
 * Each row carries: student, subject, classArm (with class), term, session,
 * remark, entered-by teacher name, status, scores, grade, position,
 * cumulative + priorTotals array (for the principal to spot mistakes).
 */
export async function GET(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) {
    return Response.json({ error: 'Principal access required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId') || undefined
  const termId = url.searchParams.get('termId') || undefined
  const classArmId = url.searchParams.get('classArmId') || undefined
  const subjectId = url.searchParams.get('subjectId') || undefined
  const status = url.searchParams.get('status') || 'SUBMITTED'

  // Default to active session/term if not supplied
  const { session, term } = await getActiveSessionAndTerm()
  const effSessionId = sessionId ?? session?.id ?? undefined
  const effTermId = termId ?? term?.id ?? undefined

  const where: any = {}
  if (effSessionId) where.sessionId = effSessionId
  if (effTermId) where.termId = effTermId
  if (classArmId) where.classArmId = classArmId
  if (subjectId) where.subjectId = subjectId
  if (status && status !== 'ALL') where.status = status

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
          gender: true,
          classId: true,
          classArmId: true,
          class: { select: { id: true, name: true, level: true } },
          classArm: {
            select: { id: true, name: true, fullName: true, classId: true },
          },
        },
      },
      subject: { select: { id: true, name: true, code: true } },
      term: { select: { id: true, name: true, order: true } },
      session: { select: { id: true, name: true } },
      remark: { select: { id: true, category: true, text: true } },
      enteredBy: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: [{ classArmId: 'asc' }, { subjectId: 'asc' }, { total: 'desc' }],
  })

  // Result.classArmId is a snapshot field (no relation defined on Result),
  // so we resolve the class-arm display name by loading every distinct
  // classArmId referenced in the rows, in one query, and join them here.
  const classArmIds = Array.from(
    new Set(rows.map((r) => r.classArmId).filter(Boolean)),
  )
  const classArms = await db.classArm.findMany({
    where: { id: { in: classArmIds } },
    include: { class: { select: { id: true, name: true, level: true } } },
  })
  const classArmMap = new Map(classArms.map((c) => [c.id, c]))

  // For cumulative: gather prior-term totals per (studentId, subjectId).
  // We look up terms with order < current term order in the same session.
  const termOrder = rows[0]?.term?.order ?? null
  let priorTotalsMap: Record<string, number[]> = {}
  if (effSessionId && termOrder && termOrder > 1) {
    const priorTerms = await db.term.findMany({
      where: { sessionId: effSessionId, order: { lt: termOrder } },
      orderBy: { order: 'asc' },
      select: { id: true, order: true },
    })
    const studentIds = Array.from(new Set(rows.map((r) => r.studentId)))
    const subjectIds = Array.from(new Set(rows.map((r) => r.subjectId)))
    if (studentIds.length && subjectIds.length && priorTerms.length) {
      const priorResults = await db.result.findMany({
        where: {
          sessionId: effSessionId,
          termId: { in: priorTerms.map((t) => t.id) },
          studentId: { in: studentIds },
          subjectId: { in: subjectIds },
          total: { not: null },
        },
        select: {
          studentId: true,
          subjectId: true,
          termId: true,
          total: true,
        },
      })
      // Bucket by student+subject, ordered by term order
      const bucket: Record<string, Record<number, number | null>> = {}
      for (const r of priorResults) {
        const k = `${r.studentId}|${r.subjectId}`
        const tOrder = priorTerms.find((t) => t.id === r.termId)?.order ?? 0
        if (!bucket[k]) bucket[k] = {}
        bucket[k][tOrder] = r.total
      }
      for (const [k, byOrder] of Object.entries(bucket)) {
        const arr: number[] = []
        for (let o = 1; o < termOrder; o++) {
          const v = byOrder[o]
          if (typeof v === 'number') arr.push(v)
        }
        priorTotalsMap[k] = arr
      }
    }
  }

  const results = rows.map((r) => {
    const priorTotals = priorTotalsMap[`${r.studentId}|${r.subjectId}`] ?? []
    let cumulative: number | null = null
    if (r.total != null && termOrder) {
      cumulative = computeCumulative(termOrder, r.total, priorTotals)
    }
    const ca = r.classArmId ? classArmMap.get(r.classArmId) : undefined
    return {
      id: r.id,
      status: r.status,
      ca: r.ca,
      exam: r.exam,
      total: r.total,
      grade: r.grade,
      position: r.position,
      remarkId: r.remarkId,
      remarkText: r.remark?.text ?? null,
      remarkCategory: r.remark?.category ?? null,
      cumulative,
      priorTotals,
      student: r.student,
      subject: r.subject,
      classArm: {
        id: ca?.id ?? r.classArmId,
        name: ca?.name ?? '—',
        fullName: ca?.fullName ?? '—',
        classId: ca?.classId ?? '',
        class: ca?.class ?? { id: '', name: '—', level: 0 },
      },
      term: r.term,
      session: r.session,
      enteredByTeacherId: r.enteredByTeacherId,
      enteredByTeacherName: r.enteredBy?.user?.name ?? null,
      enteredByTeacherEmail: r.enteredBy?.user?.email ?? null,
      approvedById: r.approvedById,
      approvedAt: r.approvedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  })

  // Summary counts for the filtered session+term (regardless of status filter,
  // so the principal always sees pending/approved/needsCorrection totals).
  const summaryWhere: any = {}
  if (effSessionId) summaryWhere.sessionId = effSessionId
  if (effTermId) summaryWhere.termId = effTermId
  if (classArmId) summaryWhere.classArmId = classArmId
  if (subjectId) summaryWhere.subjectId = subjectId

  const grouped = await db.result.groupBy({
    by: ['status'],
    where: summaryWhere,
    _count: { _all: true },
  })
  const summary = { pending: 0, approved: 0, needsCorrection: 0, saved: 0 }
  for (const g of grouped) {
    if (g.status === 'SUBMITTED') summary.pending = g._count._all
    else if (g.status === 'APPROVED') summary.approved = g._count._all
    else if (g.status === 'NEEDS_CORRECTION') summary.needsCorrection = g._count._all
    else if (g.status === 'SAVED') summary.saved = g._count._all
  }

  return Response.json({
    results,
    summary,
    filters: {
      sessionId: effSessionId ?? null,
      termId: effTermId ?? null,
      classArmId: classArmId ?? null,
      subjectId: subjectId ?? null,
      status,
    },
  })
}
