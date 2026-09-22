'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Save,
  Send,
  Lock,
  CheckCircle2,
  AlertCircle,
  Info,
  Calculator,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError, api } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type Assignment = {
  id: string
  classArmId: string
  classArmName: string
  className: string
  subjectId: string
  subjectName: string
  subjectCode: string | null
}

type Remark = {
  id: string
  category: string
  text: string
}

type GradeBoundary = {
  id: string
  min: number
  max: number
  grade: string
  order: number
}

type Bootstrap = {
  activeSession: {
    id: string
    name: string
    isActive: boolean
  } | null
  activeTerm: {
    id: string
    name: string
    order: number
    sessionId: string
    isActive: boolean
  } | null
  assignments: Assignment[]
  remarks: Remark[]
  gradeBoundaries: GradeBoundary[]
}

type StudentRow = {
  id: string
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  active: boolean
  class: { id: string; name: string } | null
  classArm: { id: string; name: string; fullName: string } | null
}

type ResultRow = {
  id: string
  studentId: string
  subjectId: string
  sessionId: string
  termId: string
  classArmId: string
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
  remarkId: string | null
  remark: { id: string; category: string; text: string } | null
  status: string
  priorTotals: { firstTerm: number | null; secondTerm: number | null }
  cumulative: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CA_MAX = 30
const EXAM_MAX = 70

function liveTotal(ca: string, exam: string): number | null {
  const c = ca === '' ? null : Number(ca)
  const e = exam === '' ? null : Number(exam)
  if (c == null || e == null || !Number.isFinite(c) || !Number.isFinite(e)) return null
  return c + e
}

function liveGrade(total: number | null, boundaries: GradeBoundary[]): string | null {
  if (total == null || !Number.isFinite(total)) return null
  for (const b of boundaries) {
    if (total >= b.min && total <= b.max) return b.grade
  }
  return boundaries[boundaries.length - 1]?.grade ?? 'F'
}

function validateInput(ca: string, exam: string): string | null {
  if (ca === '' || exam === '') return null // empty is OK (not yet entered)
  const c = Number(ca)
  const e = Number(exam)
  if (!Number.isFinite(c) || !Number.isFinite(e)) return 'Scores must be valid numbers'
  if (c < 0 || c > CA_MAX) return `CA must be between 0 and ${CA_MAX}`
  if (e < 0 || e > EXAM_MAX) return `Examination must be between 0 and ${EXAM_MAX}`
  return null
}

function liveCumulative(
  termOrder: number,
  termTotal: number | null,
  priors: { firstTerm: number | null; secondTerm: number | null },
): number | null {
  if (termTotal == null || !Number.isFinite(termTotal)) return null
  if (termOrder === 1) return termTotal
  if (termOrder === 2) {
    if (priors.firstTerm == null) return null
    return Math.round(((priors.firstTerm + termTotal) / 2) * 100) / 100
  }
  if (termOrder === 3) {
    if (priors.firstTerm == null || priors.secondTerm == null) return null
    return (
      Math.round(((priors.firstTerm + priors.secondTerm + termTotal) / 3) * 100) / 100
    )
  }
  return null
}

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

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchBootstrap(): Promise<Bootstrap> {
  return api.get<Bootstrap>('/api/results/bootstrap')
}

async function fetchStudents(armId: string): Promise<StudentRow[]> {
  const r = await api.get<{ students: StudentRow[]; count: number }>(
    '/api/results/students',
    { query: { armId, active: 'true' } },
  )
  return r.students
}

async function fetchResults(params: {
  sessionId: string
  termId: string
  classArmId: string
  subjectId: string
}): Promise<ResultRow[]> {
  const r = await api.get<{ results: ResultRow[]; count: number }>('/api/results', {
    query: params,
  })
  return r.results
}

type SaveBody = {
  studentId: string
  subjectId: string
  sessionId: string
  termId: string
  classArmId: string
  ca: number
  exam: number
  remarkId: string | null
}

async function saveResult(body: SaveBody) {
  return api.post<{ result: ResultRow }>('/api/results', body)
}

async function submitBatch(body: {
  resultIds?: string[]
  studentIds?: string[]
  subjectId?: string
  classArmId?: string
  sessionId?: string
  termId?: string
}) {
  return api.post<{
    submitted: { id: string; status: string }[]
    rejected: { id: string; reason: string }[]
    submittedCount: number
    rejectedCount: number
  }>('/api/results/submit', body)
}

// ─── Row state (per student) ──────────────────────────────────────────────────

type RowState = {
  studentId: string
  ca: string
  exam: string
  remarkId: string | null
  // server-side snapshot (last saved)
  serverCa: number | null
  serverExam: number | null
  serverRemarkId: string | null
  status: string
  position: number | null
  priorTotals: { firstTerm: number | null; secondTerm: number | null }
  resultId: string | null
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function TeacherResultsEntry() {
  const qc = useQueryClient()
  const [assignmentId, setAssignmentId] = useState<string>('')

  // Bootstrap — assignments, active session/term, remarks, grade boundaries
  const { data: boot, isLoading: bootLoading } = useQuery({
    queryKey: ['results-bootstrap'],
    queryFn: fetchBootstrap,
  })

  const activeSession = boot?.activeSession ?? null
  const activeTerm = boot?.activeTerm ?? null
  const assignments = boot?.assignments ?? []
  const remarks = boot?.remarks ?? []
  const boundaries = boot?.gradeBoundaries ?? []

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === assignmentId) ?? null,
    [assignments, assignmentId],
  )

  // Students list
  const studentsQuery = useQuery({
    queryKey: ['results-students', selectedAssignment?.classArmId],
    queryFn: () => fetchStudents(selectedAssignment!.classArmId),
    enabled: !!selectedAssignment?.classArmId && !!activeSession && !!activeTerm,
  })

  // Existing results for this session/term/arm/subject
  const resultsQuery = useQuery({
    queryKey: [
      'results',
      activeSession?.id,
      activeTerm?.id,
      selectedAssignment?.classArmId,
      selectedAssignment?.subjectId,
    ],
    queryFn: () =>
      fetchResults({
        sessionId: activeSession!.id,
        termId: activeTerm!.id,
        classArmId: selectedAssignment!.classArmId,
        subjectId: selectedAssignment!.subjectId,
      }),
    enabled:
      !!selectedAssignment?.classArmId &&
      !!selectedAssignment?.subjectId &&
      !!activeSession &&
      !!activeTerm,
  })

  const students = studentsQuery.data ?? []
  const results = resultsQuery.data ?? []

  // Build per-student row state from students + results
  const rowStates = useMemo<RowState[]>(() => {
    return students.map((s) => {
      const r = results.find((rr) => rr.studentId === s.id)
      return {
        studentId: s.id,
        ca: r?.ca != null ? String(r.ca) : '',
        exam: r?.exam != null ? String(r.exam) : '',
        remarkId: r?.remarkId ?? null,
        serverCa: r?.ca ?? null,
        serverExam: r?.exam ?? null,
        serverRemarkId: r?.remarkId ?? null,
        status: r?.status ?? 'NEW',
        position: r?.position ?? null,
        priorTotals: r?.priorTotals ?? { firstTerm: null, secondTerm: null },
        resultId: r?.id ?? null,
      }
    })
  }, [students, results])

  // Per-row draft overrides (so user can edit before saving)
  const [drafts, setDrafts] = useState<Record<string, { ca: string; exam: string; remarkId: string | null }>>({})

  // Reset drafts whenever the underlying data changes
  // (use a key based on result snapshot signature to reset cleanly)
  const draftSignature = rowStates
    .map((r) => `${r.studentId}:${r.serverCa ?? ''}:${r.serverExam ?? ''}:${r.serverRemarkId ?? ''}`)
    .join('|')
  const [lastSig, setLastSig] = useState('')
  if (draftSignature !== lastSig) {
    setLastSig(draftSignature)
    setDrafts({})
  }

  function getDraft(studentId: string, fallback: RowState) {
    const d = drafts[studentId]
    if (d) return d
    return { ca: fallback.ca, exam: fallback.exam, remarkId: fallback.remarkId }
  }

  function setDraft(studentId: string, patch: Partial<{ ca: string; exam: string; remarkId: string | null }>) {
    setDrafts((prev) => {
      const existing = prev[studentId] ?? {
        ca: rowStates.find((r) => r.studentId === studentId)?.ca ?? '',
        exam: rowStates.find((r) => r.studentId === studentId)?.exam ?? '',
        remarkId: rowStates.find((r) => r.studentId === studentId)?.remarkId ?? null,
      }
      return { ...prev, [studentId]: { ...existing, ...patch } }
    })
  }

  // Save mutation (single row)
  const saveMutation = useMutation({
    mutationFn: (vars: {
      row: RowState
      ca: string
      exam: string
      remarkId: string | null
    }) => {
      if (!selectedAssignment || !activeSession || !activeTerm) {
        throw new Error('Missing assignment, session, or term')
      }
      const ca = Number(vars.ca)
      const exam = Number(vars.exam)
      const body: SaveBody = {
        studentId: vars.row.studentId,
        subjectId: selectedAssignment.subjectId,
        sessionId: activeSession.id,
        termId: activeTerm.id,
        classArmId: selectedAssignment.classArmId,
        ca,
        exam,
        remarkId: vars.remarkId,
      }
      return saveResult(body)
    },
    onSuccess: () => {
      toast.success('Result saved')
      qc.invalidateQueries({
        queryKey: ['results'],
      })
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to save'
      toast.error(msg)
    },
  })

  // Submit mutation (batch — either all drafts OR by studentIds)
  const submitMutation = useMutation({
    mutationFn: (vars: { studentIds: string[]; subjectId: string; classArmId: string; sessionId: string; termId: string }) => {
      return submitBatch(vars)
    },
    onSuccess: (data) => {
      if (data.submittedCount > 0) {
        toast.success(`${data.submittedCount} result(s) submitted`)
      }
      if (data.rejectedCount > 0) {
        toast.warning(`${data.rejectedCount} result(s) could not be submitted`)
      }
      qc.invalidateQueries({ queryKey: ['results'] })
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to submit'
      toast.error(msg)
    },
  })

  function handleSaveRow(row: RowState) {
    const draft = getDraft(row.studentId, row)
    const err = validateInput(draft.ca, draft.exam)
    if (err) return toast.error(err)
    if (draft.ca === '' || draft.exam === '') {
      return toast.error('Enter both CA and Examination scores')
    }
    saveMutation.mutate({
      row,
      ca: draft.ca,
      exam: draft.exam,
      remarkId: draft.remarkId,
    })
  }

  function handleSaveAll() {
    const editable = rowStates.filter((r) => r.status !== 'SUBMITTED' && r.status !== 'APPROVED')
    if (editable.length === 0) return toast.info('Nothing to save')

    // Validate all
    for (const r of editable) {
      const d = getDraft(r.studentId, r)
      const err = validateInput(d.ca, d.exam)
      if (err) return toast.error(`Row error: ${err}`)
      if (d.ca === '' || d.exam === '') {
        return toast.error('Enter both CA and Examination for every student')
      }
    }
    // Save one by one (awaitable)
    Promise.all(
      editable.map((r) => {
        const d = getDraft(r.studentId, r)
        return saveMutation.mutateAsync({ row: r, ca: d.ca, exam: d.exam, remarkId: d.remarkId })
      }),
    )
      .then(() => toast.success(`Saved ${editable.length} result(s)`))
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : 'Some saves failed'
        toast.error(msg)
      })
  }

  function handleSubmitAll() {
    if (!selectedAssignment || !activeSession || !activeTerm) return
    const editable = rowStates.filter(
      (r) =>
        (r.status === 'SAVED' || r.status === 'NEEDS_CORRECTION') &&
        r.serverCa != null &&
        r.serverExam != null,
    )
    if (editable.length === 0) {
      return toast.info('Save at least one result before submitting')
    }
    submitMutation.mutate({
      studentIds: editable.map((r) => r.studentId),
      subjectId: selectedAssignment.subjectId,
      classArmId: selectedAssignment.classArmId,
      sessionId: activeSession.id,
      termId: activeTerm.id,
    })
  }

  function handleSubmitRow(row: RowState) {
    if (!selectedAssignment || !activeSession || !activeTerm) return
    if (row.status !== 'SAVED' && row.status !== 'NEEDS_CORRECTION') return
    if (row.serverCa == null || row.serverExam == null) {
      return toast.error('Save the result first')
    }
    submitMutation.mutate({
      studentIds: [row.studentId],
      subjectId: selectedAssignment.subjectId,
      classArmId: selectedAssignment.classArmId,
      sessionId: activeSession.id,
      termId: activeTerm.id,
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (bootLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enter Results</h1>
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
          <h1 className="text-2xl font-bold tracking-tight">Enter Results</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a class arm and subject to enter results for the active term.
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No active academic session/term</AlertTitle>
          <AlertDescription>
            The principal must set the current academic session and term before you can enter results.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enter Results</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a class arm and subject to enter results for the active term.
          </p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No assignments yet</AlertTitle>
          <AlertDescription>
            You have not been assigned to any class arm + subject. Ask the principal
            to assign you before you can enter results.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const termOrder = activeTerm.order
  const showFirstTermCol = termOrder >= 2
  const showSecondTermCol = termOrder >= 3
  const showCumulativeCol = termOrder >= 2

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enter Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a class arm and subject to enter results for the active term.
        </p>
      </div>

      {/* Context banner */}
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-muted-foreground">Active:</span>
          <span className="font-semibold">
            {activeSession.name} — {activeTerm.name}
          </span>
          <Badge variant="outline">CA / {CA_MAX}</Badge>
          <Badge variant="outline">Exam / {EXAM_MAX}</Badge>
          <Badge variant="outline">Total / 100</Badge>
        </CardContent>
      </Card>

      {/* Assignment selector */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-select">Class Arm + Subject</Label>
            <Select value={assignmentId} onValueChange={setAssignmentId}>
              <SelectTrigger id="assignment-select" className="w-full">
                <SelectValue placeholder="Select a class arm + subject to enter results" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.classArmName} — {a.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedAssignment && (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {studentsQuery.isLoading || resultsQuery.isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> loading students…
                </span>
              ) : (
                <span>
                  {students.length} student{students.length === 1 ? '' : 's'} in{' '}
                  {selectedAssignment.classArmName}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleSaveAll}
                disabled={
                  saveMutation.isPending ||
                  studentsQuery.isLoading ||
                  resultsQuery.isLoading ||
                  rowStates.length === 0
                }
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save all
              </Button>
              <Button
                onClick={handleSubmitAll}
                disabled={
                  submitMutation.isPending ||
                  studentsQuery.isLoading ||
                  resultsQuery.isLoading ||
                  rowStates.length === 0
                }
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit all
              </Button>
            </div>
          </div>

          {/* Term-2 / Term-3 info banner */}
          {(showFirstTermCol || showSecondTermCol) && (
            <Alert>
              <Calculator className="h-4 w-4" />
              <AlertTitle>{activeTerm.name} — cumulative calculation</AlertTitle>
              <AlertDescription>
                {termOrder === 2 && (
                  <>
                    You only enter Second Term CA + Exam. The system auto-retrieves the
                    student&apos;s First Term total. Cumulative = (1st + 2nd) ÷ 2.
                  </>
                )}
                {termOrder === 3 && (
                  <>
                    You only enter Third Term CA + Exam. The system auto-retrieves both
                    First and Second Term totals. Cumulative = (1st + 2nd + 3rd) ÷ 3.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Empty / loading / table */}
          {studentsQuery.isLoading || resultsQuery.isLoading ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : rowStates.length === 0 ? (
            <Card>
              <CardContent className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                <p className="text-sm">No active students in this class arm.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop table — hidden on mobile */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">Student</TableHead>
                          <TableHead className="min-w-[80px]">CA<br /><span className="text-xs font-normal text-muted-foreground">/ {CA_MAX}</span></TableHead>
                          <TableHead className="min-w-[80px]">Exam<br /><span className="text-xs font-normal text-muted-foreground">/ {EXAM_MAX}</span></TableHead>
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
                          <TableHead className="min-w-[220px]">Remark</TableHead>
                          <TableHead className="min-w-[90px]">Status</TableHead>
                          <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rowStates.map((row) => {
                          const draft = getDraft(row.studentId, row)
                          const total = liveTotal(draft.ca, draft.exam)
                          const grade = liveGrade(total, boundaries)
                          const cumulative = liveCumulative(termOrder, total, row.priorTotals)
                          const isLocked =
                            row.status === 'SUBMITTED' || row.status === 'APPROVED'
                          const inputErr = validateInput(draft.ca, draft.exam)
                          return (
                            <TableRow key={row.studentId}>
                              <TableCell>
                                <div className="font-medium">
                                  {[row.studentId && students.find((s) => s.id === row.studentId)?.firstName, students.find((s) => s.id === row.studentId)?.otherNames, students.find((s) => s.id === row.studentId)?.lastName].filter(Boolean).join(' ')}
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                  {students.find((s) => s.id === row.studentId)?.admissionNumber}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  max={CA_MAX}
                                  value={draft.ca}
                                  disabled={isLocked}
                                  onChange={(e) =>
                                    setDraft(row.studentId, { ca: e.target.value })
                                  }
                                  className="w-20 h-11"
                                  aria-label={`CA for student ${row.studentId}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  max={EXAM_MAX}
                                  value={draft.exam}
                                  disabled={isLocked}
                                  onChange={(e) =>
                                    setDraft(row.studentId, { exam: e.target.value })
                                  }
                                  className="w-20 h-11"
                                  aria-label={`Exam for student ${row.studentId}`}
                                />
                              </TableCell>
                              <TableCell className="tabular-nums font-semibold">
                                {total ?? '—'}
                              </TableCell>
                              <TableCell>
                                {grade ? <Badge variant="outline">{grade}</Badge> : '—'}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {ordinal(row.position)}
                              </TableCell>
                              {showFirstTermCol && (
                                <TableCell className="tabular-nums text-muted-foreground">
                                  {row.priorTotals.firstTerm ?? '—'}
                                </TableCell>
                              )}
                              {showSecondTermCol && (
                                <TableCell className="tabular-nums text-muted-foreground">
                                  {row.priorTotals.secondTerm ?? '—'}
                                </TableCell>
                              )}
                              {showCumulativeCol && (
                                <TableCell className="tabular-nums font-semibold">
                                  {cumulative ?? '—'}
                                </TableCell>
                              )}
                              <TableCell>
                                <Select
                                  value={draft.remarkId ?? '__none__'}
                                  onValueChange={(v) =>
                                    setDraft(row.studentId, {
                                      remarkId: v === '__none__' ? null : v,
                                    })
                                  }
                                  disabled={isLocked}
                                >
                                  <SelectTrigger className="w-full h-11" aria-label={`Remark for student ${row.studentId}`}>
                                    <SelectValue placeholder="No remark" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">No remark</SelectItem>
                                    <SelectGroup>
                                      {Object.entries(
                                        remarks.reduce<Record<string, Remark[]>>((acc, r) => {
                                          ;(acc[r.category] ||= []).push(r)
                                          return acc
                                        }, {}),
                                      ).map(([cat, items]) => (
                                        <SelectGroup key={cat}>
                                          <SelectLabel>{cat}</SelectLabel>
                                          {items.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                              {r.text.length > 50 ? r.text.slice(0, 47) + '…' : r.text}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {row.status === 'NEW' ? (
                                  <Badge variant="outline">New</Badge>
                                ) : (
                                  statusBadge(row.status)
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {inputErr && (
                                    <span className="text-xs text-destructive self-center mr-1">
                                      {inputErr}
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleSaveRow(row)}
                                    disabled={isLocked || saveMutation.isPending}
                                  >
                                    {saveMutation.isPending &&
                                      saveMutation.variables?.row.studentId === row.studentId ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Save className="h-3.5 w-3.5" />
                                      )}
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitRow(row)}
                                    disabled={
                                      isLocked ||
                                      row.status === 'NEW' ||
                                      submitMutation.isPending
                                    }
                                  >
                                    {submitMutation.isPending &&
                                    submitMutation.variables?.studentIds?.[0] === row.studentId ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Send className="h-3.5 w-3.5" />
                                    )}
                                    Submit
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Mobile cards — block on mobile, hidden on >=md */}
              <div className="md:hidden space-y-3">
                {rowStates.map((row) => {
                  const draft = getDraft(row.studentId, row)
                  const total = liveTotal(draft.ca, draft.exam)
                  const grade = liveGrade(total, boundaries)
                  const cumulative = liveCumulative(termOrder, total, row.priorTotals)
                  const isLocked =
                    row.status === 'SUBMITTED' || row.status === 'APPROVED'
                  const inputErr = validateInput(draft.ca, draft.exam)
                  const student = students.find((s) => s.id === row.studentId)
                  const fullName = student
                    ? [student.firstName, student.otherNames, student.lastName].filter(Boolean).join(' ')
                    : ''
                  return (
                    <Card key={row.studentId}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{fullName}</p>
                            <p className="text-xs font-mono text-muted-foreground">
                              {student?.admissionNumber}
                            </p>
                          </div>
                          {row.status === 'NEW' ? (
                            <Badge variant="outline">New</Badge>
                          ) : (
                            statusBadge(row.status)
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor={`ca-${row.studentId}`} className="text-xs">
                              CA / {CA_MAX}
                            </Label>
                            <Input
                              id={`ca-${row.studentId}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={CA_MAX}
                              value={draft.ca}
                              disabled={isLocked}
                              onChange={(e) =>
                                setDraft(row.studentId, { ca: e.target.value })
                              }
                              className="h-11"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`ex-${row.studentId}`} className="text-xs">
                              Exam / {EXAM_MAX}
                            </Label>
                            <Input
                              id={`ex-${row.studentId}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={EXAM_MAX}
                              value={draft.exam}
                              disabled={isLocked}
                              onChange={(e) =>
                                setDraft(row.studentId, { exam: e.target.value })
                              }
                              className="h-11"
                            />
                          </div>
                        </div>

                        {inputErr && (
                          <p className="text-xs text-destructive">{inputErr}</p>
                        )}

                        {/* Live metrics */}
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="rounded-md border p-2">
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-semibold tabular-nums">{total ?? '—'}</p>
                          </div>
                          <div className="rounded-md border p-2">
                            <p className="text-muted-foreground">Grade</p>
                            <p className="font-semibold">{grade ?? '—'}</p>
                          </div>
                          <div className="rounded-md border p-2">
                            <p className="text-muted-foreground">Pos.</p>
                            <p className="font-semibold tabular-nums">{ordinal(row.position)}</p>
                          </div>
                          {showCumulativeCol && (
                            <div className="rounded-md border p-2 bg-emerald-50 dark:bg-emerald-950/30">
                              <p className="text-muted-foreground">Cum.</p>
                              <p className="font-semibold tabular-nums">{cumulative ?? '—'}</p>
                            </div>
                          )}
                        </div>

                        {/* Carry-over */}
                        {(showFirstTermCol || showSecondTermCol) && (
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                            {showFirstTermCol && (
                              <span>1st Term: <strong className="tabular-nums">{row.priorTotals.firstTerm ?? '—'}</strong></span>
                            )}
                            {showSecondTermCol && (
                              <span>2nd Term: <strong className="tabular-nums">{row.priorTotals.secondTerm ?? '—'}</strong></span>
                            )}
                          </div>
                        )}

                        {/* Remark */}
                        <div className="space-y-1">
                          <Label className="text-xs">Remark</Label>
                          <Select
                            value={draft.remarkId ?? '__none__'}
                            onValueChange={(v) =>
                              setDraft(row.studentId, {
                                remarkId: v === '__none__' ? null : v,
                              })
                            }
                            disabled={isLocked}
                          >
                            <SelectTrigger className="w-full h-11" aria-label={`Remark for ${fullName}`}>
                              <SelectValue placeholder="No remark" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No remark</SelectItem>
                              {Object.entries(
                                remarks.reduce<Record<string, Remark[]>>((acc, r) => {
                                  ;(acc[r.category] ||= []).push(r)
                                  return acc
                                }, {}),
                              ).map(([cat, items]) => (
                                <SelectGroup key={cat}>
                                  <SelectLabel>{cat}</SelectLabel>
                                  {items.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {r.text.length > 50 ? r.text.slice(0, 47) + '…' : r.text}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 h-11"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSaveRow(row)}
                            disabled={isLocked || saveMutation.isPending}
                          >
                            {saveMutation.isPending &&
                              saveMutation.variables?.row.studentId === row.studentId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save
                          </Button>
                          <Button
                            className="flex-1 h-11"
                            size="sm"
                            onClick={() => handleSubmitRow(row)}
                            disabled={
                              isLocked ||
                              row.status === 'NEW' ||
                              submitMutation.isPending
                            }
                          >
                            {submitMutation.isPending &&
                            submitMutation.variables?.studentIds?.[0] === row.studentId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Submit
                          </Button>
                        </div>
                        {isLocked && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            {row.status === 'SUBMITTED'
                              ? 'Submitted — awaiting principal approval.'
                              : 'Approved by principal — read only.'}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {!selectedAssignment && (
        <Card>
          <CardContent className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <Info className="h-8 w-8" />
            <p className="text-sm">
              Select a class arm + subject above to start entering results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
