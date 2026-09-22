import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

// RESCO eCard — Students API (FLAT structure, NO class arms).
// A student belongs directly to a Class (no class arm).
// Query/body fields use `classId` (NEVER classArmId / armId / arm).

const createSchema = z.object({
  admissionNumber: z
    .string()
    .trim()
    .min(1, 'Admission number is required'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  otherNames: z.string().trim().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  classId: z.string().min(1, 'Class is required'),
  active: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const classId = url.searchParams.get('classId') ?? undefined
  const active = url.searchParams.get('active') // 'true' | 'false' | undefined

  const where: any = {}
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { otherNames: { contains: q } },
      { admissionNumber: { contains: q } },
    ]
  }
  if (classId) where.classId = classId
  if (active === 'true') where.active = true
  if (active === 'false') where.active = false

  const students = await db.student.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return Response.json({ students, count: students.length })
}

export async function POST(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const data = parsed.data

  // Validate class exists
  const klass = await db.class.findUnique({ where: { id: data.classId } })
  if (!klass) {
    return Response.json({ error: 'Selected class does not exist' }, { status: 400 })
  }

  // Admission number unique
  const existingAdm = await db.student.findUnique({
    where: { admissionNumber: data.admissionNumber },
  })
  if (existingAdm) {
    return Response.json(
      { error: 'A student with this admission number already exists' },
      { status: 409 },
    )
  }

  const student = await db.student.create({
    data: {
      admissionNumber: data.admissionNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      otherNames: data.otherNames ?? null,
      gender: data.gender ?? null,
      classId: data.classId,
      active: data.active,
    },
    include: {
      class: { select: { id: true, name: true } },
    },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'STUDENT_CREATED',
    context: {
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      name: `${student.firstName} ${student.lastName}`,
      classId: student.classId,
      className: klass.name,
    },
  })

  return Response.json({ student }, { status: 201 })
}
