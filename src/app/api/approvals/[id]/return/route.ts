import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// RESCO eCard — Return a result for correction (FLAT structure, NO class arms).
// POST /api/approvals/[id]/return
//   Body: { reason: string }
//   Principal only. Sends a SUBMITTED result back to the teacher for
//   correction — sets status to NEEDS_CORRECTION and audits
//   RESULT_RETURNED_FOR_CORRECTION with the principal's reason message.
//
// Returns 409 if the result is not SUBMITTED.

const returnSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(500),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) {
    return Response.json({ error: 'Principal access required' }, { status: 403 })
  }

  const { id } = await params

  const body = await req.json().catch(() => null)
  const parsed = returnSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const reason = parsed.data.reason

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

  if (r.status !== 'SUBMITTED') {
    return Response.json(
      {
        error: `Only SUBMITTED results can be returned for correction (current status: ${r.status}).`,
      },
      { status: 409 },
    )
  }

  await db.result.update({
    where: { id },
    data: { status: 'NEEDS_CORRECTION' },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'RESULT_RETURNED_FOR_CORRECTION',
    context: {
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
      enteredByTeacherId: r.enteredByTeacherId ?? null,
      enteredByTeacherName: r.enteredBy?.user?.name ?? null,
      reason,
    },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
  })

  return Response.json({
    ok: true,
    id,
    status: 'NEEDS_CORRECTION',
  })
}
