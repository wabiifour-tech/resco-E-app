'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Unlock,
  Undo2,
  Check,
  RefreshCcw,
  Search,
  ClipboardCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ApiError, api } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultRow = {
  id: string
  status: 'SAVED' | 'SUBMITTED' | 'NEEDS_CORRECTION' | 'APPROVED'
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
  cumulative: number | null
  priorTotals: number[]
  remarkId: string | null
  remarkText: string | null
  remarkCategory: string | null
  student: {
    id: string
    admissionNumber: string
    firstName: string
    lastName: string
    otherNames: string | null
    gender: string | null
    classId: string
    classArmId: string | null
  }
  subject: { id: string; name: string; code: string | null }
  classArm: {
    id: string
    name: string
    fullName: string
    classId: string
    class: { id: string; name: string; level: number }
  }
  term: { id: string; name: string; order: number }
  session: { id: string; name: string }
  enteredByTeacherId: string | null
  enteredByTeacherName: string | null
  approvedById: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

type Summary = {
  pending: number
  approved: number
  needsCorrection: number
  saved: number
}

type ApprovalsResponse = {
  results: ResultRow[]
  summary: Summary
  filters: {
    sessionId: string | null
    termId: string | null
    classArmId: string | null
    subjectId: string | null
    status: string
  }
}

type SessionItem = {
  id: string
  name: string
  isActive: boolean
  terms: { id: string; name: string; order: number; isActive: boolean }[]
}

type ClassItem = {
  id: string
  name: string
  level: number
  arms: { id: string; name: string; fullName: string; classId: string }[]
}

type SubjectItem = { id: string; name: string; code: string | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function studentName(r: ResultRow): string {
  return [r.student.firstName, r.student.lastName].filter(Boolean).join(' ')
}

function ordinal(n: number | null): string {
  if (!n || n <= 0) return '—'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function statusBadge(status: ResultRow['status']) {
  switch (status) {
    case 'SAVED':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3" /> Saved
        </Badge>
      )
    case 'SUBMITTED':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      )
    case 'NEEDS_CORRECTION':
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3" /> Correction
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
          <CheckCircle2 className="h-3 w-3" /> Approved
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// Group results by (classArmId + subjectId) so the principal can review a
// whole subject-class "result sheet" at once.
function groupResults(rows: ResultRow[]) {
  const map = new Map<
    string,
    {
      key: string
      classArmId: string
      classArmName: string
      className: string
      subjectId: string
      subjectName: string
      enteredByTeacherName: string | null
      rows: ResultRow[]
    }
  >()
  for (const r of rows) {
    const k = `${r.classArmId}|${r.subjectId}`
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        classArmId: r.classArm.id,
        classArmName: r.classArm.fullName,
        className: r.classArm.class.name,
        subjectId: r.subject.id,
        subjectName: r.subject.name,
        enteredByTeacherName: r.enteredByTeacherName ?? null,
        rows: [],
      })
    }
    map.get(k)!.rows.push(r)
  }
  return Array.from(map.values())
}

// ─── API helpers ───────────────────────────────────────────────────────────────

async function fetchApprovals(params: {
  sessionId?: string
  termId?: string
  classArmId?: string
  subjectId?: string
  status?: string
}): Promise<ApprovalsResponse> {
  return api.get<ApprovalsResponse>('/api/approvals', { query: params })
}

async function approveResults(resultIds: string[]) {
  return api.post<{
    approved: number
    skipped: number
    missing: number
    totalRequested: number
  }>('/api/approvals/approve', { resultIds })
}

async function unlockResult(id: string) {
  return api.post<{ ok: boolean; id: string; status: string }>(
    `/api/approvals/${id}/unlock`,
  )
}

async function returnResult(id: string, reason: string) {
  return api.post<{ ok: boolean; id: string; status: string }>(
    `/api/approvals/${id}/return`,
    { reason },
  )
}

// ─── Return-for-correction dialog ─────────────────────────────────────────────

function ReturnDialog({
  open,
  onOpenChange,
  result,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  result: ResultRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {result && (
          <ReturnFormBody
            result={result}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReturnFormBody({
  result,
  onOpenChange,
}: {
  result: ResultRow
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: (r: string) => returnResult(result.id, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      toast.success(
        `Result returned for correction: ${studentName(result)}`,
      )
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to return result'
      toast.error(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return toast.error('A reason is required')
    mutation.mutate(reason.trim())
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Undo2 className="h-4 w-4" />
          Return for correction
        </DialogTitle>
        <DialogDescription>
          Send this result back to{' '}
          <span className="font-medium text-foreground">
            {result.enteredByTeacherName ?? 'the teacher'}
          </span>{' '}
          for correction. The student will be hidden from the approvals queue
          until the teacher re-submits.
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-md border p-3 text-sm space-y-1">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Student</span>
          <span className="font-medium text-right">
            {studentName(result)}
            <span className="block text-xs text-muted-foreground font-normal">
              {result.student.admissionNumber}
            </span>
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Subject</span>
          <span className="font-medium text-right">{result.subject.name}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Class</span>
          <span className="font-medium text-right">
            {result.classArm.fullName}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium text-right">
            {result.total ?? '—'} / 100 ({result.grade ?? '—'})
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="reason">Reason / correction note</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. CA total should be 28 not 38. Exam score appears transposed. Please verify and re-submit."
            rows={4}
            maxLength={500}
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            The teacher will see this note. {reason.length}/500 characters.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Return for correction
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

// ─── Reopen (unlock) confirmation ────────────────────────────────────────────

function ReopenDialog({
  open,
  onOpenChange,
  result,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  result: ResultRow | null
}) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: string) => unlockResult(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      toast.success('Result reopened — the teacher can now edit it again.')
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to reopen result'
      toast.error(msg)
    },
  })

  return (
    <AlertDialog
      open={open && !!result}
      onOpenChange={(o) => {
        if (!mutation.isPending) onOpenChange(o)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Unlock className="h-4 w-4" /> Reopen this result?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {result ? (
              <>
                <span className="font-medium text-foreground">
                  {studentName(result)}
                </span>{' '}
                — {result.subject.name} ({result.classArm.fullName}) will be
                unlocked and set back to <span className="font-medium">Pending</span>.
                The teacher will be able to edit and re-submit it. Approved
                audit history is kept.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault()
              if (result) mutation.mutate(result.id)
            }}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Reopen for editing
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Mobile card row ─────────────────────────────────────────────────────────

function MobileRowCard({
  r,
  selected,
  onToggleSelect,
  onApprove,
  onReturn,
  onReopen,
  busy,
}: {
  r: ResultRow
  selected: boolean
  onToggleSelect: (id: string, checked: boolean) => void
  onApprove: (id: string) => void
  onReturn: (r: ResultRow) => void
  onReopen: (r: ResultRow) => void
  busy: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        selected ? 'border-primary bg-accent/30' : 'bg-background'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Checkbox
            checked={selected}
            onCheckedChange={(c) => onToggleSelect(r.id, !!c)}
            aria-label={`Select ${studentName(r)}`}
            className="mt-1"
            disabled={r.status !== 'SUBMITTED'}
          />
          <div className="min-w-0">
            <p className="font-medium leading-tight truncate">
              {studentName(r)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {r.student.admissionNumber}
            </p>
          </div>
        </div>
        {statusBadge(r.status)}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-muted/50 p-1.5">
          <p className="text-[10px] text-muted-foreground">CA</p>
          <p className="text-sm font-semibold">{r.ca ?? '—'}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-1.5">
          <p className="text-[10px] text-muted-foreground">Exam</p>
          <p className="text-sm font-semibold">{r.exam ?? '—'}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-1.5">
          <p className="text-[10px] text-muted-foreground">Total</p>
          <p className="text-sm font-semibold">{r.total ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div>
          <p className="text-muted-foreground">Grade</p>
          <p className="font-semibold">{r.grade ?? '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Position</p>
          <p className="font-semibold">{ordinal(r.position)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cumulative</p>
          <p className="font-semibold">
            {r.cumulative != null ? r.cumulative : '—'}
          </p>
        </div>
      </div>

      {r.remarkText && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">
          “{r.remarkText}”
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {r.status === 'SUBMITTED' && (
          <>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 min-h-[44px]"
              disabled={busy}
              onClick={() => onApprove(r.id)}
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px]"
              disabled={busy}
              onClick={() => onReturn(r)}
            >
              <Undo2 className="h-4 w-4" />
              Return
            </Button>
          </>
        )}
        {r.status === 'APPROVED' && (
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px] flex-1"
            disabled={busy}
            onClick={() => onReopen(r)}
          >
            <Unlock className="h-4 w-4" />
            Reopen
          </Button>
        )}
        {r.status === 'NEEDS_CORRECTION' && (
          <p className="text-xs text-muted-foreground italic py-2">
            Awaiting teacher correction.
          </p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Entered by {r.enteredByTeacherName ?? '—'}
      </p>
    </div>
  )
}

// ─── Result-sheet group card ──────────────────────────────────────────────────

function ResultSheetGroup({
  group,
  selected,
  onToggleSelect,
  onToggleGroup,
  onApproveOne,
  onApproveBatch,
  onReturn,
  onReopen,
  busyIds,
}: {
  group: ReturnType<typeof groupResults>[number]
  selected: Set<string>
  onToggleSelect: (id: string, checked: boolean) => void
  onToggleGroup: (group: ReturnType<typeof groupResults>[number], checked: boolean) => void
  onApproveOne: (id: string) => void
  onApproveBatch: (ids: string[]) => void
  onReturn: (r: ResultRow) => void
  onReopen: (r: ResultRow) => void
  busyIds: Set<string>
}) {
  const submittedRows = group.rows.filter((r) => r.status === 'SUBMITTED')
  const selectedCount = submittedRows.filter((r) => selected.has(r.id)).length
  const allSelected =
    submittedRows.length > 0 && selectedCount === submittedRows.length
  const someSelected = selectedCount > 0 && !allSelected
  const hasApproved = group.rows.some((r) => r.status === 'APPROVED')
  const hasNeedsCorrection = group.rows.some(
    (r) => r.status === 'NEEDS_CORRECTION',
  )

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">
            {group.subjectName} — {group.classArmName}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {group.rows.length} student
            {group.rows.length === 1 ? '' : 's'} · Entered by{' '}
            {group.enteredByTeacherName ?? '—'}
            {submittedRows.length > 0
              ? ` · ${submittedRows.length} pending`
              : hasApproved
                ? ' · all approved'
                : hasNeedsCorrection
                  ? ' · some need correction'
                  : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(c) => onToggleGroup(group, !!c)}
            disabled={submittedRows.length === 0}
            aria-label="Select all pending in this group"
            id={`chk-${group.key}`}
          />
          <Label
            htmlFor={`chk-${group.key}`}
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Select pending
          </Label>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
            disabled={
              submittedRows.length === 0 ||
              busyIds.size > 0 ||
              selectedCount === 0
            }
            onClick={() =>
              onApproveBatch(
                submittedRows
                  .filter((r) => selected.has(r.id))
                  .map((r) => r.id),
              )
            }
            title={
              selectedCount > 0
                ? `Approve ${selectedCount} selected`
                : `Approve all ${submittedRows.length} pending in this group`
            }
          >
            <Check className="h-4 w-4" />
            {selectedCount > 0
              ? `Approve ${selectedCount}`
              : `Approve all (${submittedRows.length})`}
          </Button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-center">CA</TableHead>
              <TableHead className="text-center">Exam</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Grade</TableHead>
              <TableHead className="text-center">Pos.</TableHead>
              <TableHead className="text-center">Cum.</TableHead>
              <TableHead>Remark</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={(c) => onToggleSelect(r.id, !!c)}
                    disabled={r.status !== 'SUBMITTED'}
                    aria-label={`Select ${studentName(r)}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{studentName(r)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.student.admissionNumber}
                  </div>
                </TableCell>
                <TableCell className="text-center">{r.ca ?? '—'}</TableCell>
                <TableCell className="text-center">{r.exam ?? '—'}</TableCell>
                <TableCell className="text-center font-semibold">
                  {r.total ?? '—'}
                </TableCell>
                <TableCell className="text-center">{r.grade ?? '—'}</TableCell>
                <TableCell className="text-center">
                  {ordinal(r.position)}
                </TableCell>
                <TableCell className="text-center">
                  {r.cumulative != null ? r.cumulative : '—'}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  {r.remarkText ? (
                    <span
                      className="text-xs text-muted-foreground line-clamp-1"
                      title={r.remarkText}
                    >
                      “{r.remarkText}”
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {r.status === 'SUBMITTED' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 min-h-[44px]"
                          disabled={busyIds.has(r.id)}
                          onClick={() => onApproveOne(r.id)}
                          aria-label={`Approve ${studentName(r)}`}
                        >
                          <Check className="h-4 w-4" />
                          <span className="sr-only">Approve</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-[44px]"
                          disabled={busyIds.has(r.id)}
                          onClick={() => onReturn(r)}
                          aria-label={`Return for correction: ${studentName(r)}`}
                        >
                          <Undo2 className="h-4 w-4" />
                          <span className="sr-only">Return</span>
                        </Button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-[44px]"
                        disabled={busyIds.has(r.id)}
                        onClick={() => onReopen(r)}
                        aria-label={`Reopen: ${studentName(r)}`}
                      >
                        <Unlock className="h-4 w-4" />
                        <span className="sr-only">Reopen</span>
                      </Button>
                    )}
                    {r.status === 'NEEDS_CORRECTION' && (
                      <span className="text-xs text-muted-foreground italic">
                        Returned
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y">
        {group.rows.map((r) => (
          <div key={r.id} className="p-3">
            <MobileRowCard
              r={r}
              selected={selected.has(r.id)}
              onToggleSelect={onToggleSelect}
              onApprove={onApproveOne}
              onReturn={onReturn}
              onReopen={onReopen}
              busy={busyIds.has(r.id)}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PrincipalApprovals() {
  const qc = useQueryClient()

  // Filter state (defaults filled in from /api/sessions + /api/settings)
  const [sessionId, setSessionId] = useState<string>('')
  const [termId, setTermId] = useState<string>('')
  const [classArmId, setClassArmId] = useState<string>('ALL')
  const [subjectId, setSubjectId] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [returnTarget, setReturnTarget] = useState<ResultRow | null>(null)
  const [reopenTarget, setReopenTarget] = useState<ResultRow | null>(null)

  // Bootstrap: get sessions (which include terms) so the principal can change
  // session/term; default to active session/term.
  const sessionsQuery = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const r = await api.get<{
        sessions: SessionItem[]
        currentSessionId: string | null
        currentTermId: string | null
      }>('/api/sessions')
      return r.sessions
    },
    staleTime: 60_000,
  })

  // Derive the active session/term from the sessions list. We use these as
  // fallback defaults when the user hasn't picked anything yet — that way we
  // avoid the setState-in-effect anti-pattern: the "effective" session/term
  // is computed during render from the cached sessions list, and the user's
  // explicit selection (in `sessionId`/`termId` state) wins once set.
  const activeSession = useMemo(
    () => sessionsQuery.data?.find((s) => s.isActive) ?? null,
    [sessionsQuery.data],
  )
  const effSessionId = sessionId || activeSession?.id || ''
  const effSession = useMemo(
    () => sessionsQuery.data?.find((s) => s.id === effSessionId) ?? null,
    [sessionsQuery.data, effSessionId],
  )
  const effTermId =
    termId ||
    effSession?.terms.find((t) => t.isActive)?.id ||
    effSession?.terms[0]?.id ||
    ''

  // Classes (with arms) for the class-arm filter dropdown.
  const classesQuery = useQuery<ClassItem[]>({
    queryKey: ['classes'],
    queryFn: async () => {
      const r = await api.get<{ classes: ClassItem[] }>('/api/classes')
      return r.classes
    },
    staleTime: 60_000,
  })

  // Subjects dropdown
  const subjectsQuery = useQuery<SubjectItem[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const r = await api.get<{ subjects: SubjectItem[] }>('/api/subjects')
      return r.subjects
    },
    staleTime: 60_000,
  })

  // Main results query — only run once filters are ready.
  const enabled = !!effSessionId && !!effTermId
  const resultsQuery = useQuery<ApprovalsResponse>({
    queryKey: [
      'approvals',
      effSessionId,
      effTermId,
      classArmId,
      subjectId,
      statusFilter,
    ],
    queryFn: () =>
      fetchApprovals({
        sessionId: effSessionId || undefined,
        termId: effTermId || undefined,
        classArmId: classArmId !== 'ALL' ? classArmId : undefined,
        subjectId: subjectId !== 'ALL' ? subjectId : undefined,
        status: statusFilter,
      }),
    enabled,
  })

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (ids: string[]) => approveResults(ids),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      setSelected(new Set())
      const parts = [`Approved ${data.approved}`]
      if (data.skipped) parts.push(`${data.skipped} skipped`)
      if (data.missing) parts.push(`${data.missing} not found`)
      toast.success(parts.join(' · '))
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to approve results'
      toast.error(msg)
    },
    onSettled: () => setBusyIds(new Set()),
  })

  function handleApproveOne(id: string) {
    setBusyIds((s) => new Set(s).add(id))
    approveMutation.mutate([id])
  }
  function handleApproveBatch(ids: string[]) {
    if (ids.length === 0) {
      toast.error('Select at least one pending result to approve.')
      return
    }
    setBusyIds(new Set(ids))
    approveMutation.mutate(ids)
  }

  const unlockMutation = useMutation({
    mutationFn: (id: string) => unlockResult(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to reopen result'
      toast.error(msg)
    },
    onSettled: () => setBusyIds(new Set()),
  })

  function handleReopen(r: ResultRow) {
    setReopenTarget(r)
  }

  function handleReturn(r: ResultRow) {
    setReturnTarget(r)
  }

  function handleToggleSelect(id: string, checked: boolean) {
    setSelected((s) => {
      const next = new Set(s)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleToggleGroup(
    group: ReturnType<typeof groupResults>[number],
    checked: boolean,
  ) {
    const ids = group.rows
      .filter((r) => r.status === 'SUBMITTED')
      .map((r) => r.id)
    setSelected((s) => {
      const next = new Set(s)
      if (checked) ids.forEach((id) => next.add(id))
      else ids.forEach((id) => next.delete(id))
      return next
    })
  }

  const sessions = sessionsQuery.data ?? []
  const termsForSession = effSession?.terms ?? []
  const classes = classesQuery.data ?? []
  const subjects = subjectsQuery.data ?? []

  const results = resultsQuery.data?.results ?? []
  const summary = resultsQuery.data?.summary ?? {
    pending: 0,
    approved: 0,
    needsCorrection: 0,
    saved: 0,
  }
  const groups = useMemo(() => groupResults(results), [results])
  const selectedPendingCount = results.filter(
    (r) => r.status === 'SUBMITTED' && selected.has(r.id),
  ).length

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review submitted results, approve or return them, and reopen
            previously-approved entries when teachers need to make changes.
          </p>
        </div>
        {selectedPendingCount > 0 && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
            disabled={approveMutation.isPending}
            onClick={() =>
              handleApproveBatch(
                results
                  .filter((r) => r.status === 'SUBMITTED' && selected.has(r.id))
                  .map((r) => r.id),
              )
            }
          >
            {approveMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            <Check className="h-4 w-4" />
            Approve {selectedPendingCount} selected
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending review</p>
              <p className="text-xl font-bold">{summary.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-xl font-bold">{summary.approved}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Need correction</p>
              <p className="text-xl font-bold">{summary.needsCorrection}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Drafts (saved)</p>
              <p className="text-xl font-bold">{summary.saved}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-session" className="text-xs">
                Session
              </Label>
              <Select
                value={effSessionId || undefined}
                onValueChange={(v) => {
                  setSessionId(v)
                  // Reset term to first term of the new session.
                  const s = sessions.find((s) => s.id === v)
                  setTermId(
                    s?.terms.find((t) => t.isActive)?.id ?? s?.terms[0]?.id ?? '',
                  )
                }}
              >
                <SelectTrigger id="f-session" className="w-full min-h-[44px]">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.isActive ? ' (active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-term" className="text-xs">
                Term
              </Label>
              <Select
                value={effTermId || undefined}
                onValueChange={setTermId}
                disabled={!effSessionId}
              >
                <SelectTrigger id="f-term" className="w-full min-h-[44px]">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {termsForSession.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isActive ? ' (active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-classarm" className="text-xs">
                Class arm
              </Label>
              <Select value={classArmId} onValueChange={setClassArmId}>
                <SelectTrigger id="f-classarm" className="w-full min-h-[44px]">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All class arms</SelectItem>
                  {classes.flatMap((c) =>
                    c.arms.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.fullName}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-subject" className="text-xs">
                Subject
              </Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="f-subject" className="w-full min-h-[44px]">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-status" className="text-xs">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="f-status" className="w-full min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBMITTED">Pending review</SelectItem>
                  <SelectItem value="APPROVED">Approved (to reopen)</SelectItem>
                  <SelectItem value="NEEDS_CORRECTION">
                    Returned for correction
                  </SelectItem>
                  <SelectItem value="SAVED">Saved drafts</SelectItem>
                  <SelectItem value="ALL">All statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(classArmId !== 'ALL' ||
            subjectId !== 'ALL' ||
            statusFilter !== 'SUBMITTED') && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Showing{' '}
                <span className="font-medium text-foreground">
                  {statusFilter === 'ALL' ? 'all' : statusFilter}
                </span>{' '}
                results
                {classArmId !== 'ALL' &&
                  ` for ${classes.flatMap((c) => c.arms).find((a) => a.id === classArmId)?.fullName ?? ''}`}
                {subjectId !== 'ALL' &&
                  ` · ${subjects.find((s) => s.id === subjectId)?.name ?? ''}`}
                .
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => {
                  setClassArmId('ALL')
                  setSubjectId('ALL')
                  setStatusFilter('SUBMITTED')
                }}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {resultsQuery.isLoading || sessionsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !enabled ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <ClipboardCheck className="h-8 w-8" />
            <p className="text-sm">
              Configure an active academic session and term in School Settings
              to review submitted results.
            </p>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <Search className="h-8 w-8" />
            <p className="text-sm">
              No results match these filters.{' '}
              {statusFilter === 'SUBMITTED'
                ? 'No teachers have submitted results pending your review yet.'
                : 'Try switching the status filter to see other results.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <ResultSheetGroup
              key={g.key}
              group={g}
              selected={selected}
              onToggleSelect={handleToggleSelect}
              onToggleGroup={handleToggleGroup}
              onApproveOne={handleApproveOne}
              onApproveBatch={handleApproveBatch}
              onReturn={handleReturn}
              onReopen={handleReopen}
              busyIds={busyIds}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ReturnDialog
        open={!!returnTarget}
        onOpenChange={(o) => !o && setReturnTarget(null)}
        result={returnTarget}
      />
      <ReopenDialog
        open={!!reopenTarget}
        onOpenChange={(o) => !o && setReopenTarget(null)}
        result={reopenTarget}
      />
    </div>
  )
}
