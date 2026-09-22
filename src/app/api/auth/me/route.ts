import { getSession } from '@/lib/auth'

export async function GET() {
  const u = await getSession()
  if (!u) return Response.json({ user: null }, { status: 200 })
  return Response.json({ user: u })
}
