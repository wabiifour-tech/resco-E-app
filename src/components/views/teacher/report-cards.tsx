'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
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
import { api } from '@/lib/api-client'
import { ReportCardDocument } from '@/components/views/shared/report-card-document'

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
  classArm: { id: string; name: string; fullName: string } | null
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchBootstrap(): Promise<Bootstrap> {
  return api.get<Bootstrap>('/api/results/bootstrap')
}

async function fetchStudentsForArm(armId: string): Promise<StudentRow[]> {
  const r = await api.get<{ students: StudentRow[]; count: number }>(
    '/api/results/students',
    { query: { armId, active: 'true' } },
  )
  return r.students
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export function TeacherReportCards() {
  const [classArmId, setClassArmId] = useState<string>('')
  const [studentId, setStudentId] = useState<string>('')

  // Bootstrap — assignments + active session + active term
  const bootQuery = useQuery({
    queryKey: ['results-bootstrap'],
    queryFn: fetchBootstrap,
  })

  const activeSession = bootQuery.data?.activeSession ?? null
  const activeTerm = bootQuery.data?.activeTerm ?? null

  // The teacher can only generate cards for students in their assigned arms —
  // build a unique list of (classArmId, classArmName, className) from
  // their assignments.
  const arms = (() => {
    const map = new Map<string, { id: string; name: string; className: string }>()
    for (const a of bootQuery.data?.assignments ?? []) {
      if (!map.has(a.classArmId)) {
        map.set(a.classArmId, {
          id: a.classArmId,
          name: a.classArmName,
          className: a.className,
        })
      }
    }
    return Array.from(map.values())
  })()

  // Reset student when arm changes
  const [lastArmId, setLastArmId] = useState<string>('')
  if (classArmId !== lastArmId) {
    setLastArmId(classArmId)
    if (studentId) setStudentId('')
  }

  // Students for the selected arm (uses the teacher-friendly endpoint that
  // checks the teacher has ANY assignment in this arm).
  const studentsQuery = useQuery({
    queryKey: ['report-cards', 'students', classArmId],
    queryFn: () => fetchStudentsForArm(classArmId),
    enabled: !!classArmId,
  })

  const students = studentsQuery.data ?? []

  // ─── Render ──────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    if (!studentId) {
      toast.error('Select a student first')
      return
    }
    if (!activeSession || !activeTerm) {
      toast.error('No active session or term set')
      return
    }
    window.print()
  }

  const handleDownloadPdf = () => {
    if (!studentId) {
      toast.error('Select a student first')
      return
    }
    if (!activeSession || !activeTerm) {
      toast.error('No active session or term set')
      return
    }
    toast.info('Choose "Save as PDF" in the print dialog to download.')
    setTimeout(() => window.print(), 200)
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
            Generate printable report cards for students in your assigned class arms.
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

  if (arms.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate printable report cards for students in your assigned class arms.
          </p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No assignments yet</AlertTitle>
          <AlertDescription>
            You have not been assigned to any class arm. Ask the principal to assign
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
          Generate printable report cards for students in your assigned class arms.
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
            Pick a class arm and student
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rc-arm">Class arm</Label>
              <Select value={classArmId} onValueChange={setClassArmId}>
                <SelectTrigger id="rc-arm" className="w-full">
                  <SelectValue placeholder="Select class arm" />
                </SelectTrigger>
                <SelectContent>
                  {arms.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.className})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {classArmId ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Students in this class arm</h2>
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
                    No active students in this class arm yet.
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
        <Button onClick={handlePrint} disabled={!studentId}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button variant="outline" onClick={handleDownloadPdf} disabled={!studentId}>
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* ─── Preview report card ─────────────────────────────────────────── */}
      {studentId && activeSession && activeTerm ? (
        <ReportCardDocument
          studentId={studentId}
          sessionId={activeSession.id}
          termId={activeTerm.id}
        />
      ) : null}
    </div>
  )
}
