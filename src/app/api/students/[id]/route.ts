import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// RESCO eCard — Student detail API (FLAT structure, NO class arms).
// All edits use `classId` (NOT classArmId).

const editSchema = z.object({
  admissionNumber: z.string().trim().min(1, 'Admission number is required').optional(),
  firstName: z.string().trim().min(1, 'First name is required').optional(),
  lastName: z.string().trim().min(1, 'Last name is required').optional(),
  otherNames: z.string().trim().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  classId: z.string().min(1, 'Class is required').optional(),
  active: z.boolean().optional(),
})

const toggleSchema = z.object({
  active: z.boolean(),
})

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })
  const { id } = await ctx.params

  const student = await db.student.findUnique({
    where: { id },
    include: {
      class: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  })
  if (!student) {
    return Response.json({ error: 'Student not found' }, { status: 404 })
  }
  return Response.json({ student })
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })
  const { id } = await ctx.params

  const existing = await db.student.findUnique({ where: { id } })
  if (!existing) {
    return Response.json({ error: 'Student not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const data = parsed.data

  const finalClassId = data.classId ?? existing.classId

  if (data.classId) {
    const klass = await db.class.findUnique({ where: { id: data.classId } })
    if (!klass) {
      return Response.json({ error: 'Selected class does not exist' }, { status: 400 })
    }
  }

  // Admission number uniqueness check
  if (data.admissionNumber && data.admissionNumber !== existing.admissionNumber) {
    const conflict = await db.student.findUnique({
      where: { admissionNumber: data.admissionNumber },
    })
    if (conflict && conflict.id !== id) {
      return Response.json(
        { error: 'A student with this admission number already exists' },
        { status: 409 },
      )
    }
  }

  const updated = await db.student.update({
    where: { id },
    data: {
      ...(data.admissionNumber !== undefined ? { admissionNumber: data.admissionNumber } : {}),
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.otherNames !== undefined ? { otherNames: data.otherNames } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(data.classId !== undefined ? { classId: data.classId } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    include: {
      class: { select: { id: true, name: true } },
    },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'STUDENT_EDITED',
    context: {
      studentId: id,
      admissionNumber: updated.admissionNumber,
      name: `${updated.firstName} ${updated.lastName}`,
      changes: {
        ...(data.admissionNumber !== undefined && data.admissionNumber !== existing.admissionNumber ? { admissionNumber: `${existing.admissionNumber} → ${data.admissionNumber}` } : {}),
        ...(data.firstName !== undefined && data.firstName !== existing.firstName ? { firstName: `${existing.firstName} → ${data.firstName}` } : {}),
        ...(data.lastName !== undefined && data.lastName !== existing.lastName ? { lastName: `${existing.lastName} → ${data.lastName}` } : {}),
        ...(data.classId !== undefined && data.classId !== existing.classId ? { classId: `${existing.classId} → ${data.classId}` } : {}),
        ...(data.active !== undefined && data.active !== existing.active ? { active: `${existing.active} → ${data.active}` } : {}),
      },
    },
  })

  void finalClassId // referenced for clarity above; no further use needed
  return Response.json({ student: updated })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })
  const { id } = await ctx.params

  const existing = await db.student.findUnique({ where: { id } })
  if (!existing) {
    return Response.json({ error: 'Student not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = toggleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { active } = parsed.data

  if (active === existing.active) {
    return Response.json({ student: { ...existing, class: { id: existing.classId, name: '' } } })
  }

  const updated = await db.student.update({
    where: { id },
    data: { active },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'STUDENT_EDITED',
    context: {
      studentId: id,
      admissionNumber: updated.admissionNumber,
      name: `${updated.firstName} ${updated.lastName}`,
      changes: { active: `${existing.active} → ${updated.active}` },
    },
  })

  return Response.json({ student: updated })
}
