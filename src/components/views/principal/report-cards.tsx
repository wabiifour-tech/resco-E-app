'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
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
import {
  BulkPreview,
  type BulkStudent,
} from '@/components/views/shared/bulk-preview'

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
  // Preloaded report-card data keyed by studentId — populated by the
  // one-click "Download All" so BulkPreview renders immediately (no
  // per-student queries) + print can fire right after.
  const [preloadedBulkCards, setPreloadedBulkCards] = useState<
    Record<string, unknown>
  >({})
  const [bulkLoading, setBulkLoading] = useState(false)

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
      setPreloadedBulkCards({})
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

  // One-click bulk download: fetch every student's report card in parallel,
  // render them all stacked (each on its own page), then trigger the browser
  // print dialog → "Save as PDF" produces a single PDF with every card.
  const handleBulkDownload = async () => {
    if (!sessionId || !termId || classId === 'all') {
      toast.error('Pick a session, term, and class first')
      return
    }
    setBulkLoading(true)
    try {
      const list = await fetchBulkList({ classId, sessionId, termId })
      if (list.length === 0) {
        toast.info('No active students in this class')
        setBulkLoading(false)
        return
      }
      toast.info(`Loading ${list.length} report card(s)…`)
      // Fetch all cards in parallel.
      const entries = await Promise.all(
        list.map(async (s) => {
          try {
            const data = await api.get<any>('/api/report-card', {
              query: { studentId: s.studentId, sessionId, termId },
            })
            return [s.studentId, data] as const
          } catch {
            return [s.studentId, null] as const
          }
        }),
      )
      const map: Record<string, unknown> = {}
      for (const [id, data] of entries) {
        if (data) map[id as string] = data
      }
      setBulkList(list)
      setPreloadedBulkCards(map)
      setStudentId(null)
      setBulkMode(true)
      toast.success(`Loaded ${list.length} report card(s) — opening print dialog…`)
      // Let React render the stacked cards, then open the print dialog.
      setTimeout(() => window.print(), 900)
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to load report cards'
      toast.error(msg)
    } finally {
      setBulkLoading(false)
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleBulkDownload}
              disabled={!sessionId || !termId || classId === 'all' || bulkLoading}
            >
              {bulkLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              {bulkLoading ? 'Loading report cards…' : 'Download all report cards (PDF)'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleLoadBulk}
              disabled={!sessionId || !termId || classId === 'all' || bulkLoading}
            >
              <Users className="mr-2 h-4 w-4" />
              Preview all (on screen)
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
          preloadedCards={preloadedBulkCards}
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

