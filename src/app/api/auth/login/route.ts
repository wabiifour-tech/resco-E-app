import { NextRequest } from 'next/server'
import { loginWithCredentials } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || !body.email || !body.password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }
    const result = await loginWithCredentials(body.email, body.password)
    if (!result.ok || !result.user) {
      return Response.json({ error: result.error ?? 'Login failed' }, { status: 401 })
    }
    return Response.json({ user: result.user })
  } catch (e: any) {
    return Response.json({ error: 'Login failed', detail: e?.message }, { status: 500 })
  }
}
