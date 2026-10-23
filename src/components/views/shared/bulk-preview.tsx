'use client'

import { useQueries } from '@tanstack/react-query'
import {
  Info,
  CheckCircle2,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api-client'
import { ReportCardDocument } from '@/components/views/shared/report-card-document'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkStudent = {
  studentId: string
  admissionNumber: string
  fullName: string
}

// ─── Bulk preview (stacked report cards) ──────────────────────────────────────
// Shared by the principal + teacher Report Cards views. Renders every student's
// report card stacked, each inside a .rc-bulk-card with `break-after: page` so
// the browser print dialog lays each card on its own A4 page → "Save as PDF"
// produces a single PDF with every student's card.
//
// Two load paths:
//  1. Caller passes a pre-fetched `preloadedCards` map (one-click Download All
//     flow) → renders from the map immediately (no per-student queries).
//  2. Caller passes an empty/absent map → falls back to fetching each card in
//     parallel via /api/report-card (Preview-all-on-screen flow).

export function BulkPreview({
  students,
  sessionId,
  termId,
  preloadedCards,
}: {
  students: BulkStudent[]
  sessionId: string
  termId: string
  preloadedCards?: Record<string, unknown>
}) {
  // If the caller pre-fetched all cards (one-click Download All), render from
  // the preloaded map immediately (no per-student queries). Otherwise fall
  // back to fetching each card in parallel.
  const hasPreloaded = preloadedCards && Object.keys(preloadedCards).length > 0
  const queries = useQueries({
    queries: hasPreloaded
      ? []
      : students.map((s) => ({
          queryKey: ['report-card', s.studentId, sessionId, termId],
          queryFn: () =>
            api.get<any>('/api/report-card', {
              query: { studentId: s.studentId, sessionId, termId },
            }),
          enabled: !!sessionId && !!termId && !!s.studentId,
          refetchOnWindowFocus: false,
        })),
  })

  if (students.length === 0) {
    return (
      <Alert className="no-print">
        <Info className="h-4 w-4" />
        <AlertTitle>No students</AlertTitle>
        <AlertDescription>
          No active students in this class.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-8 rc-bulk-container">
      <div className="no-print">
        <Alert className="border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Bulk mode</AlertTitle>
          <AlertDescription>
            {students.length} student report cards loaded. Use <strong>Print</strong>{' '}
            above to print them all — each card is on its own page.
          </AlertDescription>
        </Alert>
      </div>

      {students.map((s, i) => {
        const preloaded = hasPreloaded
          ? (preloadedCards![s.studentId] as any | undefined)
          : undefined
        const q = hasPreloaded ? undefined : queries[i]
        return (
          <div
            key={s.studentId}
            className="rc-bulk-card"
            style={{ breakAfter: 'page' }}
          >
            {hasPreloaded ? (
              preloaded ? (
                <ReportCardDocument
                  studentId={s.studentId}
                  sessionId={sessionId}
                  termId={termId}
                  preloaded={preloaded}
                />
              ) : (
                <Alert variant="destructive" className="no-print">
                  <AlertDescription>
                    Failed to load card for {s.fullName} ({s.admissionNumber})
                  </AlertDescription>
                </Alert>
              )
            ) : q?.isLoading ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-20 w-20 rounded" />
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ) : q?.isError ? (
              <Alert variant="destructive" className="no-print">
                <AlertDescription>
                  Failed to load card for {s.fullName} ({s.admissionNumber})
                </AlertDescription>
              </Alert>
            ) : q?.data ? (
              <ReportCardDocument
                studentId={s.studentId}
                sessionId={sessionId}
                termId={termId}
                preloaded={q.data}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
