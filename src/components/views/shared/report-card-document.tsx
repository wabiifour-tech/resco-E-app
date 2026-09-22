'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  School,
  AlertCircle,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api, ApiError } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type TermResult = {
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
} | null

type SubjectRow = {
  subjectId: string
  subjectName: string
  firstTerm: TermResult
  secondTerm: TermResult
  thirdTerm: TermResult
  currentTerm: {
    ca: number | null
    exam: number | null
    total: number | null
    grade: string | null
    position: number | null
    remarkText: string | null
    remarkCategory: string | null
  }
  cumulative: number | null
  position: number | null
}

type ReportCardData = {
  settings: {
    schoolName: string
    address: string
    phone: string | null
    motto: string
    logoDataUrl: string | null
    principalName: string | null
    principalSignatureDataUrl: string | null
  }
  session: { id: string; name: string }
  term: { id: string; name: string; order: number }
  student: {
    id: string
    admissionNumber: string
    fullName: string
    className: string
    gender: string | null
  }
  subjects: SubjectRow[]
  classAverage: number | null
  termOrder: number
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ordinal(n: number | null | undefined): string {
  if (!n || n <= 0) return '-'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  // For totals/CA/exam we use integers; for cumulative we may show decimals.
  return String(n)
}

function fmtCumulative(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  // Always show 2 decimals for cumulative
  return n.toFixed(2)
}

function generatedAtLabel(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Lagos',
    })
  } catch {
    return ''
  }
}

async function fetchReportCard(opts: {
  studentId: string
  sessionId: string
  termId: string
}): Promise<ReportCardData> {
  return api.get<ReportCardData>('/api/report-card', { query: opts })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportCardDocument({
  studentId,
  sessionId,
  termId,
  // The bulk-print flow passes already-loaded data so we don't fire 50 queries
  // at once. When provided, we skip the query.
  preloaded,
}: {
  studentId: string
  sessionId: string
  termId: string
  preloaded?: ReportCardData
}) {
  const query = useQuery({
    queryKey: ['report-card', studentId, sessionId, termId],
    queryFn: () => fetchReportCard({ studentId, sessionId, termId }),
    enabled: !!studentId && !!sessionId && !!termId && !preloaded,
    // Don't refetch on window focus — keeps print stable
    refetchOnWindowFocus: false,
  })

  const data = preloaded ?? query.data
  const isLoading = !preloaded && query.isLoading
  const error = !preloaded ? query.error : null

  if (isLoading) {
    return (
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-20 w-20 rounded" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    const msg =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to load report card'
    return (
      <Alert variant="destructive" className="print:hidden">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load report card</AlertTitle>
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return <CardView data={data} />
}

// ─── Card view (real report card markup) ─────────────────────────────────────

function CardView({ data }: { data: ReportCardData }) {
  const termOrder = data.termOrder
  const s = data.settings
  const st = data.student

  // Subject columns per the spec
  const showFirstTermCol = termOrder >= 2
  const showSecondTermCol = termOrder >= 3
  const showCumulativeCol = termOrder >= 2

  const today = generatedAtLabel(data.generatedAt)

  // Student's overall totals for the summary row
  const subjectsWithTotal = data.subjects.filter(
    (sub) => sub.currentTerm.total != null,
  )
  const totalSum = subjectsWithTotal.reduce(
    (acc, sub) => acc + (sub.currentTerm.total ?? 0),
    0,
  )
  const studentAverage =
    subjectsWithTotal.length > 0
      ? Math.round((totalSum / subjectsWithTotal.length) * 100) / 100
      : null

  return (
    <div className="print-area mx-auto w-full max-w-[820px] bg-white text-black print:shadow-none print:border-0 print:max-w-none print:w-full">
      <div className="border border-black/70 p-6 sm:p-8 print:p-8 print:border-2 print:border-black bg-white text-black">
        {/* ─── Header: logo (left) + name/motto/address (center/right) ────── */}
        <header className="flex items-center gap-4 border-b-2 border-black/70 pb-4">
          <div className="shrink-0">
            {s.logoDataUrl ? (
               
              <img
                src={s.logoDataUrl}
                alt="School logo"
                className="h-20 w-20 object-contain print:h-20 print:w-20"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded border border-black/40">
                <School className="h-8 w-8 text-black/50" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-tight text-black">
              {s.schoolName}
            </h1>
            <p className="mt-0.5 text-sm italic text-black/80">
              {s.motto}
            </p>
            <p className="mt-0.5 text-xs text-black/70">{s.address}</p>
            {s.phone ? (
              <p className="text-xs text-black/70">Tel: {s.phone}</p>
            ) : null}
          </div>
          <div className="w-20 shrink-0 print:w-20" aria-hidden="true" />
        </header>

        {/* ─── Title strip ──────────────────────────────────────────────── */}
        <div className="my-3 text-center">
          <h2 className="text-lg font-bold uppercase tracking-wider text-black">
            Student Report Card
          </h2>
          <p className="text-sm text-black/80">
            {data.session.name} — {data.term.name}
          </p>
        </div>

        {/* ─── Student info band ─────────────────────────────────────────── */}
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 border border-black/50 bg-black/[0.03] p-3 text-sm print:grid-cols-2">
          <div>
            <span className="font-semibold">Name:</span>{' '}
            <span className="uppercase">{st.fullName}</span>
          </div>
          <div>
            <span className="font-semibold">Admission No:</span>{' '}
            {st.admissionNumber}
          </div>
          <div>
            <span className="font-semibold">Class:</span> {st.className}
          </div>
          <div>
            <span className="font-semibold">Term:</span> {data.term.name}
          </div>
          <div>
            <span className="font-semibold">Session:</span> {data.session.name}
          </div>
          {st.gender ? (
            <div>
              <span className="font-semibold">Gender:</span>{' '}
              {st.gender === 'MALE' ? 'Male' : 'Female'}
            </div>
          ) : null}
        </div>

        {/* ─── Results table ─────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm text-black print:table-fixed">
            <thead>
              <tr className="bg-black/10 text-left">
                <th className="border border-black/50 px-2 py-1.5 text-left font-semibold">
                  Subject
                </th>
                {showFirstTermCol ? (
                  <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                    1st Term
                  </th>
                ) : null}
                {showSecondTermCol ? (
                  <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                    2nd Term
                  </th>
                ) : null}
                <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                  {termOrder === 1 ? 'CA /30' : `${ordinal(termOrder)} Term CA /30`}
                </th>
                <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                  {termOrder === 1 ? 'Exam /70' : `${ordinal(termOrder)} Term Exam /70`}
                </th>
                <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                  {termOrder === 1 ? 'Total /100' : `${ordinal(termOrder)} Term Total /100`}
                </th>
                {showCumulativeCol ? (
                  <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                    Cumulative
                  </th>
                ) : null}
                <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                  Grade
                </th>
                <th className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                  Position
                </th>
                <th className="border border-black/50 px-2 py-1.5 text-left font-semibold">
                  Remark
                </th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      3 +
                      (showFirstTermCol ? 1 : 0) +
                      (showSecondTermCol ? 1 : 0) +
                      (showCumulativeCol ? 1 : 0) +
                      4
                    }
                    className="border border-black/50 px-2 py-3 text-center text-black/60"
                  >
                    No subject results have been recorded for this term yet.
                  </td>
                </tr>
              ) : (
                data.subjects.map((sub) => (
                  <tr key={sub.subjectId} className="even:bg-black/[0.02]">
                    <td className="border border-black/50 px-2 py-1.5 text-left">
                      {sub.subjectName}
                    </td>
                    {showFirstTermCol ? (
                      <td className="border border-black/50 px-2 py-1.5 text-center">
                        {fmt(sub.firstTerm?.total)}
                      </td>
                    ) : null}
                    {showSecondTermCol ? (
                      <td className="border border-black/50 px-2 py-1.5 text-center">
                        {fmt(sub.secondTerm?.total)}
                      </td>
                    ) : null}
                    <td className="border border-black/50 px-2 py-1.5 text-center">
                      {fmt(sub.currentTerm.ca)}
                    </td>
                    <td className="border border-black/50 px-2 py-1.5 text-center">
                      {fmt(sub.currentTerm.exam)}
                    </td>
                    <td className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                      {fmt(sub.currentTerm.total)}
                    </td>
                    {showCumulativeCol ? (
                      <td className="border border-black/50 px-2 py-1.5 text-center font-semibold">
                        {fmtCumulative(sub.cumulative)}
                      </td>
                    ) : null}
                    <td className="border border-black/50 px-2 py-1.5 text-center">
                      {sub.currentTerm.grade ?? '—'}
                    </td>
                    <td className="border border-black/50 px-2 py-1.5 text-center">
                      {ordinal(sub.currentTerm.position)}
                    </td>
                    <td className="border border-black/50 px-2 py-1.5 text-left text-xs">
                      {sub.currentTerm.remarkText ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {studentAverage != null ? (
              <tfoot>
                <tr className="bg-black/10 font-semibold">
                  <td
                    colSpan={
                      // We want the Total label to span up to (but not including)
                      // the current term Total column.
                      3 +
                      (showFirstTermCol ? 1 : 0) +
                      (showSecondTermCol ? 1 : 0) - 1
                    }
                    className="border border-black/50 px-2 py-1.5 text-right"
                  >
                    Student Term Total / Average:
                  </td>
                  <td className="border border-black/50 px-2 py-1.5 text-center font-bold">
                    {totalSum}
                  </td>
                  {showCumulativeCol ? (
                    <td className="border border-black/50 px-2 py-1.5 text-center font-bold">
                      {fmtCumulative(studentAverage)}
                    </td>
                  ) : null}
                  <td
                    colSpan={3}
                    className="border border-black/50 px-2 py-1.5 text-center"
                  >
                    Class average:{' '}
                    {data.classAverage != null
                      ? fmtCumulative(data.classAverage)
                      : '—'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {/* ─── Teacher remark block ──────────────────────────────────────── */}
        <section className="mt-4 border border-black/50 p-3">
          <h3 className="mb-1 text-sm font-bold uppercase text-black">
            Class Teacher&apos;s Remark
          </h3>
          <p className="min-h-12 text-sm text-black">
            {data.subjects[0]?.currentTerm?.remarkText ? (
              <>
                {data.subjects[0].currentTerm.remarkText}
                {data.subjects[0].currentTerm.remarkCategory ? (
                  <span className="ml-2 text-xs text-black/60">
                    ({data.subjects[0].currentTerm.remarkCategory})
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-black/50 italic">
                No remark has been recorded for this student.
              </span>
            )}
          </p>
        </section>

        {/* ─── Signatures + date ─────────────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-2 gap-6 print:grid-cols-2">
          <div className="flex flex-col items-center">
            <div className="mb-1 h-10" />
            <div className="w-full border-t border-black" />
            <p className="mt-1 text-center text-xs text-black">
              Class Teacher&apos;s Signature
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-1 flex h-10 items-end justify-center">
              {s.principalSignatureDataUrl ? (
                 
                <img
                  src={s.principalSignatureDataUrl}
                  alt="Principal signature"
                  className="h-10 max-w-[200px] object-contain"
                />
              ) : null}
            </div>
            <div className="w-full border-t border-black" />
            <p className="mt-1 text-center text-xs text-black">
              {s.principalName ? `${s.principalName}` : 'Principal'}
            </p>
            <p className="text-center text-xs text-black/70">
              Principal&apos;s Signature
            </p>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-wrap items-center justify-between border-t border-black/30 pt-2 text-[11px] text-black/70">
          <span>Date issued: {today || '—'}</span>
          <span className="italic">
            This report card is computer-generated and valid only with the
            principal&apos;s signature.
          </span>
        </footer>
      </div>
    </div>
  )
}

// Re-export for parents that want to fetch the same data
export type { ReportCardData }
