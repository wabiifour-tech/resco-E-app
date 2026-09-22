import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { logAudit, clientIp } from '@/lib/audit'
import type { NextApiRequest, NextApiResponse } from 'next'

const SECRET = process.env.NEXTAUTH_SECRET || 'resco-ecard-dev-secret-change-in-prod'
const COOKIE_NAME = 'resco_session'
const MAX_AGE = 60 * 60 * 12 // 12 hours

export type SessionUser = {
  id: string
  name: string
  email: string
  role: 'PRINCIPAL' | 'TEACHER'
  teacherId: string | null
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function signPayload(payload: object): string {
  const body = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', SECRET).update(body).digest()
  return `${body}.${b64url(sig)}`
}

function verifyToken(token: string): any | null {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const expected = createHmac('sha256', SECRET).update(body).digest()
    const provided = Buffer.from(sig, 'base64url')
    if (expected.length !== provided.length) return null
    if (!timingSafeEqual(expected, provided)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

/** Create a session cookie for a user. */
export async function createSession(user: SessionUser): Promise<void> {
  const payload = {
    ...user,
    iat: Date.now(),
    exp: Date.now() + MAX_AGE * 1000,
  }
  const token = signPayload(payload)
  const c = await cookies()
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function destroySession(): Promise<void> {
  const c = await cookies()
  c.delete(COOKIE_NAME)
}

/** Read session from cookie (App Router). */
export async function getSession(): Promise<SessionUser | null> {
  const c = await cookies()
  const token = c.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  // Verify the user still exists and is active
  const u = await db.user.findUnique({
    where: { id: payload.id },
    include: { teacher: true },
  })
  if (!u || !u.active) return null
  if (u.email !== payload.email) return null
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as 'PRINCIPAL' | 'TEACHER',
    teacherId: u.teacher?.id ?? null,
  }
}

/** For App Router route handlers. */
export async function getAuthSession(): Promise<SessionUser | null> {
  return getSession()
}

export async function requireUser(): Promise<SessionUser | null> {
  const u = await getSession()
  return u
}

export async function requirePrincipal(): Promise<SessionUser | null> {
  const u = await getSession()
  if (!u || u.role !== 'PRINCIPAL') return null
  return u
}

/** Helper returning a 401 Response for unauthenticated App Router calls. */
export function unauthorized(): Response {
  return Response.json({ error: 'Authentication required' }, { status: 401 })
}

/** Helper returning a 403 Response for forbidden App Router calls. */
export function forbidden(message = 'Forbidden'): Response {
  return Response.json({ error: message }, { status: 403 })
}

/**
 * Ensure a teacher is authorized for a classArm + subject.
 * Principal is always authorized. Returns the user or null.
 */
export async function requireTeacherAuthorized(
  classArmId: string,
  subjectId: string,
): Promise<SessionUser | null> {
  const u = await getSession()
  if (!u) return null
  if (u.role === 'PRINCIPAL') return u
  if (u.role !== 'TEACHER' || !u.teacherId) return null
  const assignment = await db.teacherAssignment.findFirst({
    where: { teacherId: u.teacherId, classArmId, subjectId },
  })
  if (!assignment) return null
  return u
}

/** Authenticate a user with email/password and create a session. */
export async function loginWithCredentials(
  email: string,
  password: string,
  req?: NextApiRequest,
): Promise<{ ok: boolean; error?: string; user?: SessionUser }> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { teacher: true },
  })
  if (!user || !user.active) return { ok: false, error: 'Invalid email or password' }
  const valid = verifyPassword(password, user.passwordHash)
  if (!valid) return { ok: false, error: 'Invalid email or password' }

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as 'PRINCIPAL' | 'TEACHER',
    teacherId: user.teacher?.id ?? null,
  }
  await createSession(sessionUser)
  await logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'LOGIN',
    context: { email: user.email, role: user.role },
    ipAddress: req ? clientIp(req) : undefined,
  })
  return { ok: true, user: sessionUser }
}

export const SESSION_COOKIE = COOKIE_NAME
