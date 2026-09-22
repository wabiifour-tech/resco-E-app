'use client'

import { useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Printer,
  FileDown,
  Info,
  Users,
  Filter,
  CheckCircle2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError } from '@/lib/api-client'
import { ReportCardDocument } from '@/components/views/shared/report-card-document'

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

type StudentRow = {
  id: string
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  active: boolean
  class: { id: string; name: string } | null
}

type BulkStudent = {
  studentId: string
  admissionNumber: string
  fullName: string
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

async function fetchStudentsForClass(classId: string): Promise<StudentRow[]> {
  const r = await api.get<{ students: StudentRow[]; count: number }>(
    '/api/students',
    { query: { classId, active: 'true' } },
  )
  return r.students
}

async function fetchBulkList(opts: {
  classId: string
  sessionId: string
  termId: string
}): Promise<BulkStudent[]> {
  const r = await api.get<{
    students: BulkStudent[]
    class: { id: string; name: string }
    session: { id: string; name: string }
    term: { id: string; name: string; order: number }
  }>('/api/report-card/bulk', { query: opts })
  return r.students
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export function PrincipalReportCards() {
  // Filter state (defaults to active session/term via render-time adjust)
  const [sessionId, setSessionId] = useState<string>('')
  const [termId, setTermId] = useState<string>('')
  const [classId, setClassId] = useState<string>('all')
  const [studentId, setStudentId] = useState<string>('')

  // Sessions query (provides default session/term)
  const sessionsQuery = useQuery({
    queryKey: ['principal', 'sessions'],
    queryFn: fetchSessions,
  })

  // Render-time adjust for default session/term — canonical React pattern
  // (not useEffect-setState) per the project's lint rule.
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

  // Classes (flat list — students belong directly to a class)
  const classesQuery = useQuery({
    queryKey: ['classes-for-report-cards'],
    queryFn: fetchClasses,
  })

  const classes = classesQuery.data ?? []
  const sortedClasses = [...classes].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    return a.name.localeCompare(b.name)
  })

  // Reset student when class changes (render-time adjust)
  const [lastClassId, setLastClassId] = useState<string>('all')
  if (classId !== lastClassId) {
    setLastClassId(classId)
    if (studentId) setStudentId('')
  }

  // Students for selected class
  const studentsQuery = useQuery({
    queryKey: ['report-cards', 'students', classId],
    queryFn: () => fetchStudentsForClass(classId),
    enabled: classId !== 'all',
  })

  const students = studentsQuery.data ?? []

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkList, setBulkList] = useState<BulkStudent[]>([])

  // ─── Render ──────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    if (!studentId && !bulkMode) {
      toast.error('Select a student first')
      return
    }
    if (bulkMode && bulkList.length === 0) {
      toast.error('No students to print')
      return
    }
    window.print()
  }

  const handleDownloadPdf = () => {
    if (!studentId && !bulkMode) {
      toast.error('Select a student first')
      return
    }
    if (bulkMode && bulkList.length === 0) {
      toast.error('No students to download')
      return
    }
    // Browser print dialog → "Save as PDF" satisfies the PDF download req.
    toast.info('Choose "Save as PDF" in the print dialog to download.')
    setTimeout(() => window.print(), 200)
  }

  const handleLoadBulk = async () => {
    if (!sessionId || !termId || classId === 'all') {
      toast.error('Pick a session, term, and class first')
      return
    }
    try {
      const list = await fetchBulkList({
        classId,
        sessionId,
        termId,
      })
      if (list.length === 0) {
        toast.info('No active students in this class')
      } else {
        toast.success(`Loaded ${list.length} student(s) for bulk print`)
      }
      setBulkList(list)
      setBulkMode(true)
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to load bulk list'
      toast.error(msg)
    }
  }

  const handleExitBulk = () => {
    setBulkMode(false)
    setBulkList([])
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Cards</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick an academic session, term, class and student to preview a
          printable report card — or print every student in a class in one
          go.
        </p>
      </div>

      {/* ─── Selectors ─────────────────────────────────────────────────────── */}
      <Card className="no-print">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="rc-session">Academic session</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger id="rc-session" className="w-full">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {(sessionsQuery.data?.sessions ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.isActive ? ' (active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-term">Term</Label>
              <Select
                value={termId}
                onValueChange={setTermId}
                disabled={!sessionId}
              >
                <SelectTrigger id="rc-term" className="w-full">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {(termsQuery.data?.terms ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isActive ? ' (active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-class">Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="rc-class" className="w-full">
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

            <div className="space-y-1.5 self-end">
              <span className="text-xs text-muted-foreground">
                {classId !== 'all'
                  ? `${students.length} active student(s)`
                  : 'Pick a class to load students'}
              </span>
            </div>
          </div>

          {/* Bulk actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleLoadBulk}
              disabled={!sessionId || !termId || classId === 'all'}
            >
              <Users className="mr-2 h-4 w-4" />
              Load all students in class (bulk print)
            </Button>
            {bulkMode ? (
              <Button type="button" variant="ghost" onClick={handleExitBulk}>
                Exit bulk mode
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ─── Active filters banner ─────────────────────────────────────────── */}
      {sessionId && termId ? (
        <Card className="no-print border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Generating for:</span>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
              {sessionsQuery.data?.sessions.find((s) => s.id === sessionId)?.name ?? '—'}
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
              {termsQuery.data?.terms.find((t) => t.id === termId)?.name ?? '—'}
            </Badge>
            {classId !== 'all' ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
                {classes.find((c) => c.id === classId)?.name ?? '—'}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Action buttons (above the card) ─────────────────────────────── */}
      <div className="no-print flex flex-wrap gap-2">
        <Button onClick={handlePrint} disabled={!studentId && !bulkMode}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button variant="outline" onClick={handleDownloadPdf} disabled={!studentId && !bulkMode}>
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* ─── Bulk preview OR single preview ───────────────────────────────── */}
      {bulkMode ? (
        <BulkPreview
          students={bulkList}
          sessionId={sessionId}
          termId={termId}
        />
      ) : (
        <>
          {/* ─── Student picker ─────────────────────────────────────────── */}
          {classId !== 'all' ? (
            <Card className="no-print">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Students in this class</h2>
                  <span className="text-xs text-muted-foreground">
                    {students.length} active
                  </span>
                </div>
                {studentsQuery.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : studentsQuery.isError ? (
                  <Alert variant="destructive">
                    <AlertDescription>Failed to load students.</AlertDescription>
                  </Alert>
                ) : students.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No active students in this class yet.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Adm. No.</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead className="w-24 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((s) => (
                          <TableRow
                            key={s.id}
                            data-state={s.id === studentId ? 'selected' : undefined}
                          >
                            <TableCell className="font-mono text-xs">
                              {s.admissionNumber}
                            </TableCell>
                            <TableCell>
                              {[s.firstName, s.otherNames, s.lastName]
                                .filter(Boolean)
                                .join(' ')}
                            </TableCell>
                            <TableCell>
                              {s.gender
                                ? s.gender === 'MALE'
                                  ? 'Male'
                                  : 'Female'
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={
                                  s.id === studentId ? 'default' : 'outline'
                                }
                                onClick={() => setStudentId(s.id)}
                              >
                                {s.id === studentId ? (
                                  <>
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    Selected
                                  </>
                                ) : (
                                  'Preview'
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* ─── Preview report card ─────────────────────────────────────── */}
          {studentId && sessionId && termId ? (
            <ReportCardDocument
              studentId={studentId}
              sessionId={sessionId}
              termId={termId}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

// ─── Bulk preview (stacked report cards) ──────────────────────────────────────

function BulkPreview({
  students,
  sessionId,
  termId,
}: {
  students: BulkStudent[]
  sessionId: string
  termId: string
}) {
  // Fetch all report cards in parallel (one query per student)
  const queries = useQueries({
    queries: students.map((s) => ({
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
    <div className="space-y-8">
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
        const q = queries[i]
        return (
          <div
            key={s.studentId}
            className="rc-bulk-card"
            style={{ breakAfter: 'page' }}
          >
            {q?.isLoading ? (
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
