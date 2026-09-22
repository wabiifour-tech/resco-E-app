import { db } from '@/lib/db'

/**
 * Curriculum configuration helpers.
 *
 * A class OFFERS a subject iff a ClassSubject row exists for (classId, subjectId).
 * The principal configures this per class. Result entry requires the subject be
 * offered for the student's class (in addition to the teacher being assigned).
 */

/** Is the subject offered for the class? */
export async function isSubjectOfferedForClass(
  classId: string,
  subjectId: string,
): Promise<boolean> {
  const row = await db.classSubject.findUnique({
    where: {
      classId_subjectId: { classId, subjectId },
    },
    select: { id: true },
  })
  return !!row
}

/** Get all subject ids offered for a class. */
export async function getOfferedSubjectIdsForClass(classId: string): Promise<string[]> {
  const rows = await db.classSubject.findMany({
    where: { classId },
    select: { subjectId: true },
  })
  return rows.map((r) => r.subjectId)
}

/** Get offered subjects (with name) for a class, ordered by name. */
export async function getOfferedSubjectsForClass(classId: string) {
  const rows = await db.classSubject.findMany({
    where: { classId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { subject: { name: 'asc' } },
  })
  return rows.map((r) => ({
    id: r.subject.id,
    name: r.subject.name,
    code: r.subject.code,
  }))
}

/** Is the teacher the class teacher of this class? */
export async function isClassTeacher(
  teacherId: string,
  classId: string,
): Promise<boolean> {
  const row = await db.classTeacher.findUnique({
    where: {
      teacherId_classId: { teacherId, classId },
    },
    select: { id: true },
  })
  return !!row
}
