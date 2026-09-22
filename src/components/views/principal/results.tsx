'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, FileSpreadsheet, Filter, Info } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionRow = {
  id: string
  name: string
  isActive: boolean
  terms: { id: string; name: string; order: number; isActive: boolean }[]
}

type SessionsResponse = {
  sessions: SessionRow[]
  currentSessionId: string | null
  currentTermId: string | null
}

type TermsResponse = {
  session: SessionRow | null
  terms: { id: string; name: string; order: number; isActive: boolean }[]
  currentSessionId: string | null
  currentTermId: string | null
}

type ClassRow = {
  id: string
  name: string
  level: number
  category?: string | null
}

type SubjectRow = {
  id: string
  name: string
  code: string | null
}

type ResultRow = {
  id: string
  studentId: string
  subjectId: string
  sessionId: string
  termId: string
  classId: string
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
  remarkId: string | null
  remark: { id: string; category: string; text: string } | null
  status: string
  enteredByTeacherId: string | null
  enteredBy: { id: string; name: string } | null
  approvedById: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  student: {
    id: string
    admissionNumber: string
    firstName: string
    lastName: string
    otherNames: string | null
  }
  subject: { id: string; name: string; code: string | null }
  session: { id: string; name: string }
  term: { id: string; name: string; order: number; sessionId: string }
  class: { id: string; name: string }
  priorTotals: { firstTerm: number | null; secondTerm: number | null }
  cumulative: number | null
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchSessions(): Promise<SessionsResponse> {
  return api.get<SessionsResponse>('/api/sessions')
}

async function fetchTerms(sessionId: string): Promise<TermsResponse> {
  return api.get<TermsResponse>('/api/terms', { query: { sessionId } })
}

async function fetchClasses(): Promise<ClassRow[]> {
  const r = await api.get<{ classes: ClassRow[] }>('/api/classes')
  return r.classes
}

async function fetchSubjects(): Promise<SubjectRow[]> {
  const r = await api.get<{ subjects: SubjectRow[] }>('/api/subjects')
  return r.subjects
}

async function fetchResults(params: {
  sessionId: string
  termId?: string
  classId?: string
  subjectId?: string
  status?: string
}): Promise<ResultRow[]> {
  const r = await api.get<{ results: ResultRow[]; count: number }>('/api/results', {
    query: params,
  })
  return r.results
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'SAVED':
      return <Badge variant="secondary">Saved</Badge>
    case 'SUBMITTED':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent">
          Submitted
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
          Approved
        </Badge>
      )
    case 'NEEDS_CORRECTION':
      return <Badge variant="destructive">Needs correction</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function ordinal(n: number | null): string {
  if (!n || n <= 0) return '—'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function fullName(s: ResultRow['student']): string {
  return [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(' ')
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PrincipalResults() {
  // Filter state
  const [sessionId, setSessionId] = useState<string>('')
  const [termId, setTermId] = useState<string>('')
  const [classId, setClassId] = useState<string>('all')
  const [subjectId, setSubjectId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')

  // Sessions query (provides default session/term)
  const sessionsQuery = useQuery({
    queryKey: ['principal', 'sessions'],
    queryFn: fetchSessions,
  })

  // Track what the server reported as the current default. We compare
  // against this to know when the server-supplied default has arrived and
  // is different from our last known value — the canonical React pattern
  // for adjusting state during render without useEffect-setState.
  const incomingSession = sessionsQuery.data?.currentSessionId ?? null
  const incomingTerm = sessionsQuery.data?.currentTermId ?? null
  const [lastIncomingSession, setLastIncomingSession] = useState<string | null>(null)
  const [lastIncomingTerm, setLastIncomingTerm] = useState<string | null>(null)

  if (incomingSession && incomingSession !== lastIncomingSession && sessionId === '') {
    setLastIncomingSession(incomingSession)
    setSessionId(incomingSession)
  }
  if (incomingTerm && incomingTerm !== lastIncomingTerm && termId === '') {
    setLastIncomingTerm(incomingTerm)
    setTermId(incomingTerm)
  }

  // Terms for the selected session
  const termsQuery = useQuery({
    queryKey: ['principal', 'terms', sessionId],
    queryFn: () => fetchTerms(sessionId),
    enabled: !!sessionId,
  })

  // Classes + subjects — for the filter dropdowns
  const classesQuery = useQuery({
    queryKey: ['classes-for-results'],
    queryFn: fetchClasses,
  })

  const subjectsQuery = useQuery({
    queryKey: ['subjects-for-results'],
    queryFn: fetchSubjects,
  })

  // Results — fetch when session + term are set
  const resultsQuery = useQuery({
    queryKey: [
      'principal',
      'results',
      sessionId,
      termId,
      classId,
      subjectId,
      status,
    ],
    queryFn: () =>
      fetchResults({
        sessionId,
        termId: termId || undefined,
        classId: classId === 'all' ? undefined : classId,
        subjectId: subjectId === 'all' ? undefined : subjectId,
        status: status === 'all' ? undefined : status,
      }),
    enabled: !!sessionId && !!termId,
  })

  const sessions = sessionsQuery.data?.sessions ?? []
  const terms = termsQuery.data?.terms ?? []
  const classes = classesQuery.data ?? []
  const subjects = subjectsQuery.data ?? []
  const results = resultsQuery.data ?? []

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level
      return a.name.localeCompare(b.name)
    })
  }, [classes])

  const selectedSession = sessions.find((s) => s.id === sessionId)
  const selectedTerm = terms.find((t) => t.id === termId)
  const showFirstTermCol = (selectedTerm?.order ?? 1) >= 2
  const showSecondTermCol = (selectedTerm?.order ?? 1) >= 3
  const showCumulativeCol = (selectedTerm?.order ?? 1) >= 2

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse every result row in the school. Filter by session, term, class, subject, and status.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Session</label>
              <Select
                value={sessionId || '__none__'}
                onValueChange={(v) => {
                  setSessionId(v === '__none__' ? '' : v)
                  setTermId('') // reset term when session changes
                }}
              >
                <SelectTrigger className="w-full h-11" aria-label="Filter by session">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No session</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Term</label>
              <Select
                value={termId || '__none__'}
                onValueChange={(v) => setTermId(v === '__none__' ? '' : v)}
                disabled={!sessionId || terms.length === 0}
              >
                <SelectTrigger className="w-full h-11" aria-label="Filter by term">
                  <SelectValue
                    placeholder={!sessionId ? 'Pick a session first' : 'Select term'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No term</SelectItem>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Class</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-full h-11" aria-label="Filter by class">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {sortedClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Subject</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="w-full h-11" aria-label="Filter by subject">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full h-11" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="SAVED">Saved</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="NEEDS_CORRECTION">Needs correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Context banner */}
      {selectedSession && selectedTerm && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Viewing:</span>
            <span className="font-semibold">
              {selectedSession.name} — {selectedTerm.name}
            </span>
            {classId !== 'all' && (
              <Badge variant="outline">
                {classes.find((c) => c.id === classId)?.name ?? classId}
              </Badge>
            )}
            {subjectId !== 'all' && (
              <Badge variant="outline">
                {subjects.find((s) => s.id === subjectId)?.name ?? subjectId}
              </Badge>
            )}
            {status !== 'all' && (
              <Badge variant="outline">{status}</Badge>
            )}
            <span className="text-muted-foreground ml-auto">
              {results.length} row{results.length === 1 ? '' : 's'}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Info banner */}
      {!sessionId || !termId ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Select a session and term</AlertTitle>
          <AlertDescription>
            Pick a session and term above to browse results. You can also narrow by class, subject, and status.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
            <p className="text-sm text-muted-foreground">
              {resultsQuery.isLoading || resultsQuery.isFetching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> loading…
                </span>
              ) : (
                <>
                  {results.length} result{results.length === 1 ? '' : 's'}
                  {(classId !== 'all' || subjectId !== 'all' || status !== 'all')
                    ? ' matched'
                    : ' total'}
                </>
              )}
            </p>
          </div>

          {resultsQuery.isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <FileSpreadsheet className="h-8 w-8" />
              <p className="text-sm">No results match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Adm. No.</TableHead>
                    <TableHead className="min-w-[180px]">Student</TableHead>
                    <TableHead className="min-w-[150px]">Subject</TableHead>
                    <TableHead className="min-w-[100px]">Class</TableHead>
                    <TableHead className="min-w-[60px]">CA</TableHead>
                    <TableHead className="min-w-[60px]">Exam</TableHead>
                    <TableHead className="min-w-[60px]">Total</TableHead>
                    <TableHead className="min-w-[60px]">Grade</TableHead>
                    <TableHead className="min-w-[60px]">Pos.</TableHead>
                    {showFirstTermCol && (
                      <TableHead className="min-w-[80px]">1st Term</TableHead>
                    )}
                    {showSecondTermCol && (
                      <TableHead className="min-w-[80px]">2nd Term</TableHead>
                    )}
                    {showCumulativeCol && (
                      <TableHead className="min-w-[80px]">Cumulative</TableHead>
                    )}
                    <TableHead className="min-w-[200px]">Remark</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[140px]">Entered by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.student.admissionNumber}
                      </TableCell>
                      <TableCell className="font-medium">{fullName(r.student)}</TableCell>
                      <TableCell>
                        <span>{r.subject.name}</span>
                        {r.subject.code && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({r.subject.code})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.class.name}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{r.ca ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{r.exam ?? '—'}</TableCell>
                      <TableCell className="tabular-nums font-semibold">
                        {r.total ?? '—'}
                      </TableCell>
                      <TableCell>
                        {r.grade ? <Badge variant="outline">{r.grade}</Badge> : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {ordinal(r.position)}
                      </TableCell>
                      {showFirstTermCol && (
                        <TableCell className="tabular-nums text-muted-foreground">
                          {r.priorTotals.firstTerm ?? '—'}
                        </TableCell>
                      )}
                      {showSecondTermCol && (
                        <TableCell className="tabular-nums text-muted-foreground">
                          {r.priorTotals.secondTerm ?? '—'}
                        </TableCell>
                      )}
                      {showCumulativeCol && (
                        <TableCell className="tabular-nums font-semibold">
                          {r.cumulative ?? '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={r.remark?.text ?? ''}>
                        {r.remark?.text ?? '—'}
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.enteredBy?.name ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
