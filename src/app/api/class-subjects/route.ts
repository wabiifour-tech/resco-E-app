import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal, getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// Class-Subjects: which subjects each class OFFERS (curriculum configuration).
// GET  /api/class-subjects?classId=        → subjects offered for a class
// GET  /api/class-subjects                 → all ClassSubject rows (principal)
// POST /api/class-subjects  {classId, subjectId}   → offer a subject for a class
// DELETE /api/class-subjects/[id]

export async function GET(req: NextRequest) {
  const u = await getSession()
  if (!u) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const classId = req.nextUrl.searchParams.get('classId')
  if (classId) {
    const rows = await db.classSubject.findMany({
      where: { classId },
      include: { subject: { select: { id: true, name: true, code: true, active: true } } },
      orderBy: { subject: { name: 'asc' } },
    })
    return Response.json({
      classId,
      subjects: rows.map((r) => ({
        id: r.subject.id,
        name: r.subject.name,
        code: r.subject.code,
        active: r.subject.active,
        classSubjectId: r.id,
      })),
    })
  }

  // Principal: full matrix grouped by class
  const principal = await requirePrincipal()
  if (!principal) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const rows = await db.classSubject.findMany({
    include: {
      class: { select: { id: true, name: true, level: true, category: true } },
      subject: { select: { id: true, name: true, code: true, active: true } },
    },
    orderBy: [{ class: { level: 'asc' } }, { subject: { name: 'asc' } }],
  })
  return Response.json({
    classSubjects: rows.map((r) => ({
      id: r.id,
      classId: r.classId,
      className: r.class.name,
      classLevel: r.class.level,
      category: r.class.category,
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      subjectCode: r.subject.code,
    })),
  })
}

const createSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  subjectId: z.string().min(1, 'Subject is required'),
})

export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const { classId, subjectId } = parsed.data

  const [klass, subject] = await Promise.all([
    db.class.findUnique({ where: { id: classId } }),
    db.subject.findUnique({ where: { id: subjectId } }),
  ])
  if (!klass) return Response.json({ error: 'Class not found' }, { status: 400 })
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 400 })

  const existing = await db.classSubject.findUnique({
    where: { classId_subjectId: { classId, subjectId } },
  })
  if (existing) {
    return Response.json(
      { error: `${subject.name} is already offered for ${klass.name}` },
      { status: 400 },
    )
  }

  const row = await db.classSubject.create({ data: { classId, subjectId } })
  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SUBJECT_ASSIGNED_TO_CLASS',
    context: { classId, className: klass.name, subjectId, subjectName: subject.name, action: 'OFFER' },
  })
  return Response.json({ id: row.id, classId, subjectId }, { status: 201 })
}
