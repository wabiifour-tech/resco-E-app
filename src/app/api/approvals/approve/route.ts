import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const approveSchema = z.object({
  resultIds: z.array(z.string().min(1)).min(1, 'Select at least one result'),
})

/**
 * POST /api/approvals/approve
 *   Body: { resultIds: string[] }
 *   Principal only. Batch-approves results that are currently SUBMITTED.
 *   For each result:
 *     - if status !== SUBMITTED → skipped (counted as `skipped`)
 *     - else → set status=APPROVED, approvedById=current principal,
 *       approvedAt=now, lockedAt=now; emit RESULT_APPROVED audit with full
 *       context (resultId, student, subject, classArm, term, session).
 *   Returns updated counts: { approved, skipped, totalRequested }.
 *
 * The 409 / "Re-check that status is SUBMITTED before approving" rule is
 * enforced per-row rather than as a hard 409 for the whole batch — the
 * frontend shows a toast of skipped rows. This way, racing with a teacher's
 * submit/resubmit doesn't fail the whole batch.
 */
export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) {
    return Response.json({ error: 'Principal access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = approveSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const resultIds = parsed.data.resultIds

  // Fetch all rows in one go (with relations for audit context).
  const rows = await db.result.findMany({
    where: { id: { in: resultIds } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, otherNames: true, admissionNumber: true } },
      subject: { select: { id: true, name: true } },
      term: { select: { id: true, name: true, order: true } },
      session: { select: { id: true, name: true } },
      enteredBy: { select: { id: true, user: { select: { name: true } } } },
    },
  })

  // Result.classArmId is a snapshot field (no relation on Result), so we
  // load all referenced class arms in one query for the audit context.
  const classArmIds = Array.from(
    new Set(rows.map((r) => r.classArmId).filter(Boolean)),
  )
  const classArms = await db.classArm.findMany({
    where: { id: { in: classArmIds } },
    select: { id: true, fullName: true, name: true },
  })
  const classArmMap = new Map(classArms.map((c) => [c.id, c]))

  const toApprove = rows.filter((r) => r.status === 'SUBMITTED')
  const skipped = rows.length - toApprove.length
  const missing = resultIds.length - rows.length

  if (toApprove.length === 0) {
    return Response.json(
      {
        error: 'None of the selected results are in SUBMITTED status.',
        approved: 0,
        skipped: rows.length,
        missing,
        totalRequested: resultIds.length,
      },
      { status: 409 },
    )
  }

  const now = new Date()

  await db.$transaction(async (tx) => {
    await tx.result.updateMany({
      where: { id: { in: toApprove.map((r) => r.id) }, status: 'SUBMITTED' },
      data: {
        status: 'APPROVED',
        approvedById: u.id,
        approvedAt: now,
        lockedAt: now,
      },
    })
  })

  // Audit one row at a time so the audit log is per-result, per the spec.
  for (const r of toApprove) {
    await logAudit({
      userId: u.id,
      userName: u.name,
      userRole: u.role,
      action: 'RESULT_APPROVED',
      context: {
        resultId: r.id,
        studentId: r.studentId,
        studentName: [r.student.firstName, r.student.lastName]
          .filter(Boolean)
          .join(' '),
        admissionNumber: r.student.admissionNumber,
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        classArmId: r.classArmId,
        classArmName: r.classArmId
          ? classArmMap.get(r.classArmId)?.fullName ?? r.classArmId
          : null,
        termName: r.term.name,
        sessionName: r.session.name,
        total: r.total,
        grade: r.grade,
        position: r.position,
        enteredByTeacherId: r.enteredByTeacherId ?? null,
        enteredByTeacherName: r.enteredBy?.user?.name ?? null,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    })
  }

  return Response.json({
    approved: toApprove.length,
    skipped,
    missing,
    totalRequested: resultIds.length,
  })
}
