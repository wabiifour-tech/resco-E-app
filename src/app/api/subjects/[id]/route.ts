import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const editSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required').max(80),
  code: z.string().trim().max(20).optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const subject = await db.subject.findUnique({ where: { id } })
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 404 })

  const name = parsed.data.name
  const code =
    parsed.data.code && parsed.data.code.length > 0 ? parsed.data.code.toUpperCase() : null

  if (name !== subject.name) {
    const clash = await db.subject.findUnique({ where: { name } })
    if (clash) {
      return Response.json({ error: `Subject "${name}" already exists` }, { status: 400 })
    }
  }

  const updated = await db.subject.update({
    where: { id },
    data: { name, code },
  })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SUBJECT_EDITED',
    context: {
      subjectId: id,
      before: { name: subject.name, code: subject.code },
      after: { name, code },
    },
  })

  return Response.json({ subject: updated })
}

// PATCH /api/subjects/[id] — toggle active/inactive (activate/deactivate a subject).
// Inactive subjects remain in the library but are excluded from the "available
// to add" list when configuring class subjects, and from assignment options.
const patchSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  code: z.string().trim().max(20).optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const subject = await db.subject.findUnique({ where: { id } })
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 404 })

  const data: { active?: boolean; name?: string; code?: string | null } = {}
  if (typeof parsed.data.active === 'boolean') data.active = parsed.data.active
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.code !== undefined) {
    data.code = parsed.data.code && parsed.data.code.length > 0 ? parsed.data.code.toUpperCase() : null
  }

  if (data.name && data.name !== subject.name) {
    const clash = await db.subject.findUnique({ where: { name: data.name } })
    if (clash) return Response.json({ error: `Subject "${data.name}" already exists` }, { status: 400 })
  }

  const updated = await db.subject.update({ where: { id }, data })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SUBJECT_EDITED',
    context: { subjectId: id, before: { active: subject.active, name: subject.name }, after: data },
  })

  return Response.json({ subject: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const u = await requirePrincipal()
  if (!u) return Response.json({ error: 'Principal access required' }, { status: 403 })

  const { id } = await params
  const subject = await db.subject.findUnique({
    where: { id },
    include: { _count: { select: { results: true, assignments: true } } },
  })
  if (!subject) return Response.json({ error: 'Subject not found' }, { status: 404 })

  if (subject._count.results > 0) {
    return Response.json(
      {
        error: `Cannot delete "${subject.name}" — ${subject._count.results} result(s) reference it. Remove or reassign them first.`,
      },
      { status: 400 },
    )
  }

  // Cascade deletes teacher assignments (FK on TeacherAssignment.subjectId)
  await db.subject.delete({ where: { id } })

  await logAudit({
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    action: 'SUBJECT_EDITED',
    context: { subjectId: id, deleted: true, name: subject.name },
  })

  return Response.json({ ok: true })
}
