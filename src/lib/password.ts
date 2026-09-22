import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Secure password hashing using Node's built-in scrypt KDF.
 * No external dependencies. Compliant with OWASP password storage guidance.
 * Format: scrypt$<saltHex>$<hashHex>
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$')
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false
    const salt = Buffer.from(parts[1], 'hex')
    const storedHash = Buffer.from(parts[2], 'hex')
    const hash = scryptSync(password, salt, 64)
    if (hash.length !== storedHash.length) return false
    return timingSafeEqual(hash, storedHash)
  } catch {
    return false
  }
}
