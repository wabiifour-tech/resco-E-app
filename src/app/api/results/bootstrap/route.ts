import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getActiveSessionAndTerm } from '@/lib/session'
import { DEFAULT_GRADE_BOUNDARIES } from '@/lib/results'

export const dynamic = 'force-dynamic'

// RESCO eCard — Bootstrap endpoint (FLAT structure, NO class arms).
// GET /api/results/bootstrap
//
// One-call endpoint that returns everything the teacher's results-entry view
// needs (so the teacher doesn't have to hit multiple principal-only endpoints):
//   - activeSession, activeTerm
//   - assignments (for principal: all; for teacher: own, stripped)
//   - remarks (active only, flat)
//   - gradeBoundaries
//
// Each assignment includes `class: { id, name }` (NOT classArm).
// Auth: any logged-in user (principal or teacher).

export async function GET() {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { session, term } = await getActiveSessionAndTerm()

  // Assignments
  let assignments: any[] = []
  if (u.role === 'PRINCIPAL') {
    const rows = await db.teacherAssignment.findMany({
      include: {
        teacher: { include: { user: { select: { name: true, email: true } } } },
        class: { select: { id: true, name: true, level: true, category: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { class: { level: 'asc' } },
        { class: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    })
    assignments = rows.map((a) => ({
      id: a.id,
      teacherId: a.teacherId,
      teacherName: a.teacher.user.name,
      classId: a.classId,
      className: a.class.name,
      classLevel: a.class.level,
      classCategory: a.class.category ?? null,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      subjectCode: a.subject.code,
    }))
  } else {
    // Teacher — only own, stripped of other teachers' data
    if (u.teacherId) {
      const rows = await db.teacherAssignment.findMany({
        where: { teacherId: u.teacherId },
        include: {
          class: { select: { id: true, name: true, level: true, category: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: [
          { class: { level: 'asc' } },
          { class: { name: 'asc' } },
          { subject: { name: 'asc' } },
        ],
      })
      assignments = rows.map((a) => ({
        id: a.id,
        classId: a.classId,
        className: a.class.name,
        classLevel: a.class.level,
        classCategory: a.class.category ?? null,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        subjectCode: a.subject.code,
      }))
    }
  }

  // Remarks (active only, flat)
  const remarkRows = await db.remark.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, category: true, text: true },
  })

  // Grade boundaries
  const boundaryRows = await db.gradeBoundary.findMany({ orderBy: { order: 'asc' } })
  const gradeBoundaries =
    boundaryRows.length > 0
      ? boundaryRows.map((b) => ({
          id: b.id,
          min: b.min,
          max: b.max,
          grade: b.grade,
          order: b.order,
        }))
      : DEFAULT_GRADE_BOUNDARIES.map((b, i) => ({ ...b, id: `default-${i}` }))

  return Response.json({
    activeSession: session
      ? { id: session.id, name: session.name, isActive: session.isActive }
      : null,
    activeTerm: term
      ? {
          id: term.id,
          name: term.name,
          order: term.order,
          sessionId: term.sessionId,
          isActive: term.isActive,
        }
      : null,
    assignments,
    remarks: remarkRows,
    gradeBoundaries,
  })
}
