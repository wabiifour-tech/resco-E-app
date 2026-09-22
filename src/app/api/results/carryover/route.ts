import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession, requireTeacherAuthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/results/carryover?studentId=&subjectId=&sessionId=
 * Returns the prior term totals for a single student+subject+session
 * so the entry grid can show carry-over + cumulative live.
 *
 * Returns: { firstTerm, secondTerm, firstTermExists, secondTermExists }
 */
export async function GET(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const studentId = url.searchParams.get('studentId')
  const subjectId = url.searchParams.get('subjectId')
  const sessionId = url.searchParams.get('sessionId')

  if (!studentId || !subjectId || !sessionId) {
    return Response.json(
      { error: 'studentId, subjectId, and sessionId are required' },
      { status: 400 },
    )
  }

  // Authorization: check the teacher is assigned to ANY arm of this student.
  // If the student is in an arm+subject that the teacher isn't assigned to,
  // they can't see carry-over for it.
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, classArmId: true },
  })
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 })

  if (u.role === 'TEACHER') {
    // Teacher must be authorized for (student's classArm, subjectId)
    const classArmId = student.classArmId ?? ''
    if (!classArmId) {
      return Response.json(
        { error: 'Student has no class arm assigned' },
        { status: 400 },
      )
    }
    const ok = await requireTeacherAuthorized(classArmId, subjectId)
    if (!ok) {
      return Response.json(
        { error: 'You are not assigned to this student class arm and subject' },
        { status: 403 },
      )
    }
  }

  // Fetch First Term and Second Term totals for this student+subject+session
  const terms = await db.term.findMany({
    where: { sessionId, order: { in: [1, 2] } },
    select: { id: true, order: true },
  })

  let firstTerm: number | null = null
  let secondTerm: number | null = null
  let firstTermExists = false
  let secondTermExists = false

  for (const t of terms) {
    const r = await db.result.findUnique({
      where: {
        studentId_subjectId_sessionId_termId: {
          studentId,
          subjectId,
          sessionId,
          termId: t.id,
        },
      },
      select: { total: true, status: true },
    })
    if (t.order === 1) {
      firstTermExists = !!r
      firstTerm = r?.total ?? null
    }
    if (t.order === 2) {
      secondTermExists = !!r
      secondTerm = r?.total ?? null
    }
  }

  return Response.json({
    firstTerm,
    secondTerm,
    firstTermExists,
    secondTermExists,
  })
}
