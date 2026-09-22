import { db } from '@/lib/db'
import type { NextApiRequest } from 'next'

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'RESULT_CREATED'
  | 'RESULT_EDITED'
  | 'RESULT_SAVED'
  | 'RESULT_SUBMITTED'
  | 'RESULT_APPROVED'
  | 'RESULT_UNLOCKED'
  | 'RESULT_REOPENED'
  | 'RESULT_RETURNED_FOR_CORRECTION'
  | 'RESULT_MODIFIED_AFTER_REOPEN'
  | 'TEACHER_CREATED'
  | 'TEACHER_EDITED'
  | 'TEACHER_DEACTIVATED'
  | 'TEACHER_ACTIVATED'
  | 'TEACHER_ASSIGNMENT_CHANGED'
  | 'PASSWORD_CHANGED'
  | 'STUDENT_CREATED'
  | 'STUDENT_EDITED'
  | 'CLASS_CREATED'
  | 'CLASS_EDITED'
  | 'SUBJECT_CREATED'
  | 'SUBJECT_EDITED'
  | 'SESSION_CREATED'
  | 'SESSION_ACTIVATED'
  | 'TERM_ACTIVATED'
  | 'REMARK_CREATED'
  | 'REMARK_EDITED'
  | 'GRADING_UPDATED'
  | 'SETTINGS_UPDATED'
  | 'REPORT_CARD_GENERATED'

interface AuditParams {
  userId?: string
  userName: string
  userRole: string
  action: AuditAction | string
  context?: Record<string, unknown>
  ipAddress?: string
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userName: params.userName,
        userRole: params.userRole,
        action: params.action,
        context: params.context ? JSON.stringify(params.context) : null,
        ipAddress: params.ipAddress ?? null,
      },
    })
  } catch (e) {
    console.error('audit log failed', e)
  }
}

export function clientIp(req: NextApiRequest): string | undefined {
  const fwd = req.headers['x-forwarded-for']?.toString().split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || undefined
}
