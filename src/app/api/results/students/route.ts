import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// RESCO eCard — Students in a class (FLAT structure, NO class arms).
// GET /api/results/students?classId=&active=true&q=
//
// Returns students in a class. Auth:
//   - Principal: any class
//   - Teacher: must be assigned to (classId, ANY subject) of that class.
//     We check if the teacher has at least one assignment for that class.

export async function GET(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url)
  const classId = url.searchParams.get('classId')
  const active = url.searchParams.get('active')
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''

  if (!classId) {
    return Response.json({ error: 'classId is required' }, { status: 400 })
  }

  // Authorization
  if (u.role === 'TEACHER') {
    // Teacher must be assigned to ANY subject of this class
    const assignment = await db.teacherAssignment.findFirst({
      where: { teacherId: u.teacherId ?? '', classId },
    })
    if (!assignment) {
      return Response.json(
        { error: 'You are not assigned to this class' },
        { status: 403 },
      )
    }
  }

  const where: any = { classId }
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
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return Response.json({ students, count: students.length })
}
