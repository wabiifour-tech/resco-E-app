import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { recomputePositions } from '@/lib/results'

// RESCO eCard — Unlock (reopen) an APPROVED result (FLAT structure, NO class arms).
// POST /api/approvals/[id]/unlock
//   Principal only. Reopens an APPROVED result so the teacher can edit it
//   again. Sets status back to SUBMITTED (so it shows as "pending re-review"
//   in the approvals queue), clears lockedAt, but keeps approvedById /
//   approvedAt as historical audit info. Emits RESULT_UNLOCKED and
//   RESULT_REOPENED audit events with full context.
//
// Returns 409 if the result is not APPROVED.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) {
    return Response.json({ error: 'Principal access required' }, { status: 403 })
  }

  const { id } = await params

  const r = await db.result.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      session: { select: { id: true, name: true } },
      enteredBy: { select: { id: true, user: { select: { name: true } } } },
    },
  })

  if (!r) {
    return Response.json({ error: 'Result not found' }, { status: 404 })
  }

  if (r.status !== 'APPROVED') {
    return Response.json(
      {
        error: `Only APPROVED results can be reopened (current status: ${r.status}).`,
      },
      { status: 409 },
    )
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined

  const context = {
    resultId: r.id,
    studentId: r.studentId,
    studentName: [r.student.firstName, r.student.lastName]
      .filter(Boolean)
      .join(' '),
    admissionNumber: r.student.admissionNumber,
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    classId: r.classId,
    className: r.class?.name ?? r.classId,
    termName: r.term.name,
    sessionName: r.session.name,
    previousApprovedById: r.approvedById ?? null,
    previousApprovedAt: r.approvedAt ?? null,
  }

  await db.result.update({
    where: { id },
    data: {
      status: 'SUBMITTED',
      lockedAt: null,
      // Keep approvedById / approvedAt as historical record per spec.
    },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'RESULT_UNLOCKED',
    context,
    ipAddress: ip,
  })
  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'RESULT_REOPENED',
    context,
    ipAddress: ip,
  })

  // Refresh positions so the now-editable row's group stays consistent.
  try {
    await recomputePositions({
      subjectId: r.subjectId,
      classId: r.classId,
      sessionId: r.sessionId,
      termId: r.termId,
    })
  } catch {
    // Positions are best-effort; don't fail the unlock.
  }

  return Response.json({
    ok: true,
    id,
    status: 'SUBMITTED',
  })
}
