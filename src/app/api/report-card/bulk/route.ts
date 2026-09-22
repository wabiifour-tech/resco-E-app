import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requirePrincipal } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/report-card/bulk?classArmId=&sessionId=&termId=
 *
 * Principal only. Returns the list of active students in a class arm for
 * which a report card should be generated. The frontend fetches the full
 * report-card payload for each student via `/api/report-card?studentId=...`
 * and renders stacked `ReportCardDocument`s for printing.
 *
 * Returns: { students: [{ studentId, fullName, admissionNumber }], session, term }
 */
export async function GET(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const url = new URL(req.url)
  const classArmId = url.searchParams.get('classArmId')
  const sessionId = url.searchParams.get('sessionId')
  const termId = url.searchParams.get('termId')

  if (!classArmId || !sessionId || !termId) {
    return Response.json(
      { error: 'classArmId, sessionId, and termId are required' },
      { status: 400 },
    )
  }

  // Validate FK existence
  const [arm, session, term] = await Promise.all([
    db.classArm.findUnique({ where: { id: classArmId }, select: { id: true, fullName: true } }),
    db.academicSession.findUnique({ where: { id: sessionId }, select: { id: true, name: true } }),
    db.term.findUnique({ where: { id: termId }, select: { id: true, name: true, order: true, sessionId: true } }),
  ])
  if (!arm) return Response.json({ error: 'Class arm not found' }, { status: 404 })
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (!term) return Response.json({ error: 'Term not found' }, { status: 404 })
  if (term.sessionId !== session.id) {
    return Response.json({ error: 'Term does not belong to the selected session' }, { status: 400 })
  }

  // All active students in this class arm
  const students = await db.student.findMany({
    where: { classArmId, active: true },
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      otherNames: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return Response.json({
    classArm: { id: arm.id, fullName: arm.fullName },
    session: { id: session.id, name: session.name },
    term: { id: term.id, name: term.name, order: term.order },
    students: students.map((s) => ({
      studentId: s.id,
      admissionNumber: s.admissionNumber,
      fullName: [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(' '),
    })),
  })
}
