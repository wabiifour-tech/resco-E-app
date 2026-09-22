import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession, requireTeacherAuthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/results/students?armId=&active=true&q=
 *
 * Returns students in a class arm. Auth:
 *   - Principal: any arm
 *   - Teacher: must be assigned to (armId, ANY subject) of that arm.
 *     We check if the teacher has at least one assignment for that arm.
 */
export async function GET(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const armId = url.searchParams.get('armId')
  const active = url.searchParams.get('active')
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''

  if (!armId) {
    return Response.json({ error: 'armId is required' }, { status: 400 })
  }

  // Authorization
  if (u.role === 'TEACHER') {
    // Teacher must be assigned to ANY subject of this arm
    const assignment = await db.teacherAssignment.findFirst({
      where: { teacherId: u.teacherId ?? '', classArmId: armId },
    })
    if (!assignment) {
      return Response.json(
        { error: 'You are not assigned to this class arm' },
        { status: 403 },
      )
    }
    // Require authorization for at least one subject — uses the helper so the
    // teacher must have an actual assignment record (not just a first assignment)
    const ok = assignment
      ? await requireTeacherAuthorized(armId, assignment.subjectId)
      : null
    if (!ok) {
      return Response.json(
        { error: 'You are not assigned to this class arm' },
        { status: 403 },
      )
    }
  }

  const where: any = { classArmId: armId }
  if (active === 'true') where.active = true
  if (active === 'false') where.active = false
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { otherNames: { contains: q } },
      { admissionNumber: { contains: q } },
    ]
  }

  const students = await db.student.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      classArm: { select: { id: true, name: true, fullName: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return Response.json({ students, count: students.length })
}
