import { prismaClient } from '@/lib/prisma-client'

// Shared Prisma client used by all API routes + the seed script.
// Resolves to a local-SQLite PrismaClient in dev, or a libSQL-adapter
// PrismaClient when DATABASE_URL points at a Turso (libsql://) DB in production.
export const db = prismaClient
