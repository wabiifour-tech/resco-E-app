import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// Bulk teacher assignment: create MANY (Teacher, Class, Subject) rows + optional
// class-teacher flags in ONE request. Powers the multi-class multi-subject UI.
//
// POST /api/assignments/bulk
// {
//   teacherId: string,
//   entries: [
//     { classId, subjectIds: string[], classTeacher?: boolean }
//   ]
// }
//
// Each entry covers one class: the subjects the teacher teaches there, plus an
// optional class-teacher flag. The principal can configure e.g.:
//   Mrs. Adebayo:
//     Primary 2: classTeacher=true, subjects=[English, Maths, Basic Science]
//     Primary 3: classTeacher=false, subjects=[English, Yoruba]
//     Primary 5: classTeacher=true, subjects=[Social Studies, Civic Education]
//
// Idempotent: skips rows that already exist; does NOT delete rows that are
// absent from the request (use the per-row DELETE for removals). Returns a
// summary of created/skipped.

const entrySchema = z.object({
  classId: z.string().min(1),
  subjectIds: z.array(z.string().min(1)),
  classTeacher: z.boolean().optional(),
})

const bulkSchema = z.object({
  teacherId: z.string().min(1, 'Teacher is required'),
  entries: z.array(entrySchema).min(1, 'At least one class entry is required'),
})

export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { teacherId, entries } = parsed.data

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    include: { user: true },
  })
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 400 })

  // Validate all classes exist + collect class names for audit
  const classIds = Array.from(new Set(entries.map((e) => e.classId)))
  const classes = await db.class.findMany({ where: { id: { in: classIds } } })
  const classMap = new Map(classes.map((c) => [c.id, c]))
  for (const cid of classIds) {
    if (!classMap.has(cid)) return Response.json({ error: `Class not found: ${cid}` }, { status: 400 })
  }

  // Validate all subjects exist
  const subjectIds = Array.from(new Set(entries.flatMap((e) => e.subjectIds)))
  const subjects = subjectIds.length
    ? await db.subject.findMany({ where: { id: { in: subjectIds } } })
    : []
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  for (const sid of subjectIds) {
    if (!subjectMap.has(sid)) return Response.json({ error: `Subject not found: ${sid}` }, { status: 400 })
  }

  let createdAssignments = 0
  let skippedAssignments = 0
  let createdClassTeacher = 0
  let skippedClassTeacher = 0

  for (const entry of entries) {
    const klass = classMap.get(entry.classId)!
    // Subject-teaching assignments
    for (const subjectId of entry.subjectIds) {
      const exists = await db.teacherAssignment.findUnique({
        where: { teacherId_classId_subjectId: { teacherId, classId: entry.classId, subjectId } },
      })
      if (exists) {
        skippedAssignments++
        continue
      }
      await db.teacherAssignment.create({
        data: { teacherId, classId: entry.classId, subjectId },
      })
      createdAssignments++
    }
    // Class-teacher responsibility
    if (entry.classTeacher) {
      const ctExists = await db.classTeacher.findUnique({
        where: { teacherId_classId: { teacherId, classId: entry.classId } },
      })
      if (ctExists) {
        skippedClassTeacher++
      } else {
        await db.classTeacher.create({ data: { teacherId, classId: entry.classId } })
        createdClassTeacher++
      }
    }
  }

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'TEACHER_ASSIGNMENT_CHANGED',
    context: {
      teacherId,
      teacherName: teacher.user.name,
      action: 'BULK_ASSIGN',
      classes: entries.map((e) => ({
        className: classMap.get(e.classId)?.name,
        classTeacher: !!e.classTeacher,
        subjectCount: e.subjectIds.length,
      })),
      createdAssignments,
      skippedAssignments,
      createdClassTeacher,
      skippedClassTeacher,
    },
  })

  return Response.json({
    ok: true,
    teacherId,
    createdAssignments,
    skippedAssignments,
    createdClassTeacher,
    skippedClassTeacher,
  })
}
