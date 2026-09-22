import { NextRequest } from 'next/server'
import { requirePrincipal } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * GET /api/audit
 *   Principal only. Returns paginated AuditLog rows (most-recent first),
 *   with filters: action, userId, q (context text search), from/to date range.
 *   Also returns the distinct action list and distinct user list so the
 *   frontend can populate filter dropdowns.
 *
 * Query params:
 *   ?action=&userId=&q=&from=&to=&page=1&pageSize=50
 *
 * Response:
 *   {
 *     items: AuditLog[],
 *     total: number,
 *     page: number,
 *     pageSize: number,
 *     actions: string[],
 *     users: [{ id, name, role }]
 *   }
 */
export async function GET(req: NextRequest) {
  const u = await requirePrincipal()
  if (!u) {
    return Response.json({ error: 'Principal access required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')?.trim() || undefined
  const userId = url.searchParams.get('userId') || undefined
  const q = url.searchParams.get('q')?.trim().toLowerCase() || undefined
  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined
  const pageRaw = Number(url.searchParams.get('page') || '1')
  const pageSizeRaw = Number(url.searchParams.get('pageSize') || '50')
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 && pageSizeRaw <= 200
      ? Math.floor(pageSizeRaw)
      : 50

  const where: any = {}
  if (action && action !== 'ALL') where.action = action
  if (userId && userId !== 'ALL') where.userId = userId
  if (q) {
    where.OR = [
      { context: { contains: q } },
      { userName: { contains: q } },
      { action: { contains: q } },
    ]
  }
  if (from) {
    const d = new Date(from)
    if (!isNaN(d.getTime())) {
      where.createdAt = { ...(where.createdAt || {}), gte: d }
    }
  }
  if (to) {
    // Inclusive of the day end
    const d = new Date(to)
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      where.createdAt = { ...(where.createdAt || {}), lte: d }
    }
  }

  const [items, total, actions, users] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where: {},
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
    db.auditLog.findMany({
      where: { userId: { not: null } },
      distinct: ['userId'],
      select: {
        userId: true,
        userName: true,
        userRole: true,
      },
      orderBy: { userName: 'asc' },
    }),
  ])

  // Deduplicate users (Prisma distinct on userId but with name/role may yield
  // multiple rows per user if they used different names. Pick the latest row
  // per userId by re-sorting client-side.)
  const userMap = new Map<string, { id: string; name: string; role: string }>()
  for (const u of users as any[]) {
    if (!u.userId) continue
    if (!userMap.has(u.userId)) {
      userMap.set(u.userId, {
        id: u.userId,
        name: u.userName,
        role: u.userRole,
      })
    }
  }

  return Response.json({
    items,
    total,
    page,
    pageSize,
    actions: actions.map((a) => a.action),
    users: Array.from(userMap.values()),
  })
}
