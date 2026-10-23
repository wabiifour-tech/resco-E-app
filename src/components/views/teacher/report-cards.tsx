'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Printer,
  FileDown,
  Info,
  CheckCircle2,
  Filter,
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

type Assignment = {
  id: string
  classId: string
  className: string
  subjectId: string
  subjectName: string
  subjectCode: string | null
}

type Bootstrap = {
  activeSession: { id: string; name: string; isActive: boolean } | null
  activeTerm: {
    id: string
    name: string
    order: number
    sessionId: string
    isActive: boolean
  } | null
  assignments: Assignment[]
}

type StudentRow = {
  id: string
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  class: { id: string; name: string } | null
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchBootstrap(): Promise<Bootstrap> {
  return api.get<Bootstrap>('/api/results/bootstrap')
}

async function fetchStudentsForClass(classId: string): Promise<StudentRow[]> {
  const r = await api.get<{ students: StudentRow[]; count: number }>(
    '/api/results/students',
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

export function TeacherReportCards() {
  const [classId, setClassId] = useState<string>('')
  const [studentId, setStudentId] = useState<string>('')

  // Bootstrap — assignments + active session + active term
  const bootQuery = useQuery({
    queryKey: ['results-bootstrap'],
    queryFn: fetchBootstrap,
  })

  const activeSession = bootQuery.data?.activeSession ?? null
  const activeTerm = bootQuery.data?.activeTerm ?? null

  // The teacher can only generate cards for students in their assigned classes —
  // build a unique list of (classId, className) from their assignments.
  const classes = (() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const a of bootQuery.data?.assignments ?? []) {
      if (!map.has(a.classId)) {
        map.set(a.classId, {
          id: a.classId,
          name: a.className,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  })()

  // Reset student when class changes
  const [lastClassId, setLastClassId] = useState<string>('')
  if (classId !== lastClassId) {
    setLastClassId(classId)
    if (studentId) setStudentId('')
  }

  // Students for the selected class (uses the teacher-friendly endpoint that
  // checks the teacher has ANY assignment in this class).
  const studentsQuery = useQuery({
    queryKey: ['report-cards', 'students', classId],
    queryFn: () => fetchStudentsForClass(classId),
    enabled: !!classId,
  })

  const students = studentsQuery.data ?? []

  // ─── Bulk mode ──────────────────────────────────────────────────────────────
  // One-click "Download all report cards (PDF)" — fetches the class's active
  // student list via /api/report-card/bulk, then every student's card in
  // parallel via /api/report-card, renders them stacked (each on its own A4
  // page), and auto-opens the browser print dialog → "Save as PDF" produces a
  // single PDF with every student's card.
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkList, setBulkList] = useState<BulkStudent[]>([])
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
    if (!activeSession || !activeTerm) {
      toast.error('No active session or term set')
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
    if (!activeSession || !activeTerm) {
      toast.error('No active session or term set')
      return
    }
    // Browser print dialog → "Save as PDF" satisfies the PDF download req.
    toast.info('Choose "Save as PDF" in the print dialog to download.')
    setTimeout(() => window.print(), 200)
  }

  // One-click bulk download: fetch every student's report card in parallel,
  // render them all stacked (each on its own page), then trigger the browser
  // print dialog → "Save as PDF" produces a single PDF with every card.
  const handleBulkDownload = async () => {
    if (!classId) {
      toast.error('Pick a class first')
      return
    }
    if (!activeSession || !activeTerm) {
      toast.error('No active session or term set')
      return
    }
    setBulkLoading(true)
    try {
      const list = await fetchBulkList({
        classId,
        sessionId: activeSession.id,
        termId: activeTerm.id,
      })
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
              query: {
                studentId: s.studentId,
                sessionId: activeSession.id,
                termId: activeTerm.id,
              },
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
      setStudentId('')
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
    setPreloadedBulkCards({})
  }

  if (bootQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading…</p>
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeSession || !activeTerm) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate printable report cards for students in your assigned classes.
          </p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No active academic session/term</AlertTitle>
          <AlertDescription>
            The principal must set the current academic session and term before you
            can generate report cards.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate printable report cards for students in your assigned classes.
          </p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No assignments yet</AlertTitle>
          <AlertDescription>
            You have not been assigned to any class. Ask the principal to assign
            you before you can generate report cards.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Cards</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate printable report cards for students in your assigned classes —
          one student at a time, or every student in a class in one go.
        </p>
      </div>

      {/* ─── Active context banner ───────────────────────────────────────── */}
      <Card className="no-print border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-muted-foreground">Active:</span>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
            {activeSession.name}
          </Badge>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
            {activeTerm.name}
          </Badge>
          {classId ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
              {classes.find((c) => c.id === classId)?.name ?? '—'}
            </Badge>
          ) : null}
          <span className="text-muted-foreground">
            (Session &amp; term are set by the principal.)
          </span>
        </CardContent>
      </Card>

      {/* ─── Selectors ───────────────────────────────────────────────────── */}
      <Card className="no-print">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Pick a class and student
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rc-class">Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="rc-class" className="w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ─── Bulk actions ──────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleBulkDownload}
              disabled={!classId || !activeSession || !activeTerm || bulkLoading}
            >
              {bulkLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              {bulkLoading ? 'Loading report cards…' : 'Download all report cards (PDF)'}
            </Button>
            {bulkMode ? (
              <Button type="button" variant="ghost" onClick={handleExitBulk}>
                Exit bulk mode
              </Button>
            ) : null}
          </div>

          {classId && !bulkMode ? (
            <div className="space-y-3 pt-1">
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
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ─── Action buttons ─────────────────────────────────────────────── */}
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

      {/* ─── Bulk preview OR single preview ─────────────────────────────── */}
      {bulkMode ? (
        <BulkPreview
          students={bulkList}
          sessionId={activeSession.id}
          termId={activeTerm.id}
          preloadedCards={preloadedBulkCards}
        />
      ) : studentId && activeSession && activeTerm ? (
        <ReportCardDocument
          studentId={studentId}
          sessionId={activeSession.id}
          termId={activeTerm.id}
        />
      ) : null}
    </div>
  )
}
