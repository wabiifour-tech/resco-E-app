import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

/**
 * Conditional Prisma client factory.
 *
 * - Local dev: DATABASE_URL is `file:...` → standard PrismaClient reading the
 *   local SQLite file directly (unchanged behaviour).
 * - Production (Vercel): DATABASE_URL is `libsql://...` → use the libSQL driver
 *   adapter so the app talks to a hosted Turso DB (Vercel serverless has no
 *   persistent filesystem, so a local SQLite file would be lost on cold start).
 *
 * DATABASE_AUTH_TOKEN is required for a remote libsql DB.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? ''
  if (url.startsWith('libsql:')) {
    // The PrismaLibSQL adapter (v6) creates its own libsql client from {url, authToken}.
    const adapter = new PrismaLibSQL({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    })
    return new PrismaClient({ adapter } as any)
  }
  return new PrismaClient({
    log: ['error', 'warn'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient

export default prismaClient
