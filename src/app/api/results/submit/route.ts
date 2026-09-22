import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession, requireTeacherAuthorized } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// RESCO eCard — Bulk submit results (FLAT structure, NO class arms).
// Body: either { resultIds: string[] }
//      OR { studentIds, subjectId, classId, sessionId, termId }

const submitSchema = z
  .object({
    resultIds: z.array(z.string().min(1)).optional(),
    studentIds: z.array(z.string().min(1)).optional(),
    subjectId: z.string().optional(),
    classId: z.string().optional(),
    sessionId: z.string().optional(),
    termId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.resultIds && data.resultIds.length > 0) return
    if (
      data.studentIds &&
      data.studentIds.length > 0 &&
      data.subjectId &&
      data.classId &&
      data.sessionId &&
      data.termId
    ) {
      return
    }
    ctx.addIssue({
      code: 'custom',
      message:
        'Provide either { resultIds: [...] } or { studentIds, subjectId, classId, sessionId, termId }',
    })
  })

export async function POST(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const data = parsed.data

  // Resolve the set of result rows to submit
  let targetRows: {
    id: string
    studentId: string
    subjectId: string
    sessionId: string
    termId: string
    classId: string
    status: string
  }[] = []

  if (data.resultIds && data.resultIds.length > 0) {
    targetRows = await db.result.findMany({
      where: { id: { in: data.resultIds } },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        sessionId: true,
        termId: true,
        classId: true,
        status: true,
      },
    })
  } else {
    targetRows = await db.result.findMany({
      where: {
        studentId: { in: data.studentIds! },
        subjectId: data.subjectId,
        classId: data.classId,
        sessionId: data.sessionId,
        termId: data.termId,
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        sessionId: true,
        termId: true,
        classId: true,
        status: true,
      },
    })
  }

  if (targetRows.length === 0) {
    return Response.json(
      { error: 'No matching result rows found. Save results first.' },
      { status: 400 },
    )
  }

  // Per-row authorization + status check. We precompute the list of
  // rows that are eligible (SAVED or NEEDS_CORRECTION) and authorized,
  // then issue a single bulk update per row. We don't wrap in a single
  // transaction because each row's update is independent and the
  // per-row audit insert is slow (~500ms each) which would blow the
  // default 5s interactive-transaction timeout.
  const updated: { id: string; status: string }[] = []
  const rejected: { id: string; reason: string }[] = []

  for (const row of targetRows) {
    // Auth check (teacher must be assigned; principal passes)
    if (u.role === 'TEACHER') {
      const ok = await requireTeacherAuthorized(row.classId, row.subjectId)
      if (!ok) {
        rejected.push({ id: row.id, reason: 'Not authorized' })
        continue
      }
    }

    // Skip already-submitted/approved
    if (row.status === 'SUBMITTED' || row.status === 'APPROVED') {
      rejected.push({ id: row.id, reason: `Already ${row.status}` })
      continue
    }

    // Only submit rows that are SAVED or NEEDS_CORRECTION
    if (row.status !== 'SAVED' && row.status !== 'NEEDS_CORRECTION') {
      rejected.push({ id: row.id, reason: `Status ${row.status} cannot be submitted` })
      continue
    }

    // Defensive: only submit if ca/exam/total are non-null
    const fullRow = await db.result.findUnique({
      where: { id: row.id },
      select: { ca: true, exam: true, total: true },
    })
    if (!fullRow || fullRow.ca == null || fullRow.exam == null || fullRow.total == null) {
      rejected.push({ id: row.id, reason: 'Missing scores — save first' })
      continue
    }

    await db.result.update({
      where: { id: row.id },
      data: { status: 'SUBMITTED' },
    })
    updated.push({ id: row.id, status: 'SUBMITTED' })

    // Audit per row (outside any transaction to avoid blocking)
    await logAudit({
      userId: u.id,
      userName: u.name,
      userRole: u.role,
      action: 'RESULT_SUBMITTED',
      context: {
        resultId: row.id,
        studentId: row.studentId,
        subjectId: row.subjectId,
        sessionId: row.sessionId,
        termId: row.termId,
        classId: row.classId,
      },
    })
  }

  return Response.json({
    submitted: updated,
    rejected,
    submittedCount: updated.length,
    rejectedCount: rejected.length,
  })
}
