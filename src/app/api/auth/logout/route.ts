import { destroySession, getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST() {
  try {
    const u = await getSession()
    if (u) {
      await logAudit({
        userId: u.id,
        userName: u.name,
        userRole: u.role,
        action: 'LOGOUT',
      })
    }
    await destroySession()
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: 'Logout failed', detail: e?.message }, { status: 500 })
  }
}
