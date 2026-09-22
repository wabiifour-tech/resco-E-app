'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Loader2,
  GraduationCap,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api-client'

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
  remarks: unknown[]
  gradeBoundaries: unknown[]
}

type StudentRow = {
  id: string
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  classId: string
  active: boolean
  class: { id: string; name: string } | null
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchBootstrap(): Promise<Bootstrap> {
  return api.get<Bootstrap>('/api/results/bootstrap')
}

async function fetchStudents(classId: string, q: string): Promise<StudentRow[]> {
  const r = await api.get<{ students: StudentRow[]; count: number }>(
    '/api/results/students',
    { query: { classId, active: 'true', q: q || undefined } },
  )
  return r.students
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function TeacherMyStudents() {
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')

  const bootQuery = useQuery({
    queryKey: ['results-bootstrap'],
    queryFn: fetchBootstrap,
  })

  const assignments = bootQuery.data?.assignments ?? []
  const classIds = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.classId))),
    [assignments],
  )

  // Fetch students for each class in parallel
  const studentsQueries = useQuery({
    queryKey: ['teacher-students-by-class', classIds.join('|'), q],
    queryFn: async () => {
      const results = await Promise.all(
        classIds.map((classId) =>
          fetchStudents(classId, q).then((students) => ({
            classId,
            students,
          })),
        ),
      )
      return results
    },
    enabled: classIds.length > 0,
  })

  const classLookup = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const a of assignments) {
      const list = map.get(a.classId) ?? []
      list.push(a)
      map.set(a.classId, list)
    }
    return map
  }, [assignments])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setQ(searchInput.trim().toLowerCase())
  }

  // Group + flatten for display
  const grouped = useMemo(() => {
    if (!studentsQueries.data) return []
    return studentsQueries.data.map(({ classId, students }) => {
      const classAssignments = classLookup.get(classId) ?? []
      const className = classAssignments[0]?.className ?? classId
      return {
        classId,
        className,
        subjects: classAssignments.map((a) => a.subjectName),
        students,
      }
    })
  }, [studentsQueries.data, classLookup])

  const totalStudents = grouped.reduce((sum, g) => sum + g.students.length, 0)

  if (bootQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Students</h1>
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

  if (assignments.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Students in the classes you teach.
          </p>
        </div>
        <Card>
          <CardContent className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <GraduationCap className="h-8 w-8" />
            <p className="text-sm">
              You have no class assignments yet. Ask the principal to assign you to a class.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Students in the classes you teach. Read-only — ask the principal to manage student records.
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or admission number…"
              className="pl-9 h-11"
              aria-label="Search students"
            />
            <button type="submit" className="sr-only">Search</button>
          </form>
        </CardContent>
      </Card>

      {/* Total banner */}
      <div className="text-sm text-muted-foreground">
        {studentsQueries.isLoading || studentsQueries.isFetching ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> loading students…
          </span>
        ) : (
          <span>
            {totalStudents} active student{totalStudents === 1 ? '' : 's'} across{' '}
            {grouped.length} class{grouped.length === 1 ? '' : 'es'}.
          </span>
        )}
      </div>

      {/* Per-class student lists */}
      {studentsQueries.isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <GraduationCap className="h-8 w-8" />
            <p className="text-sm">No students found.</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map((g) => (
          <Card key={g.classId}>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{g.className}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {g.students.length} active student{g.students.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Subjects:{' '}
                  {g.subjects.length > 0 ? g.subjects.join(', ') : '—'}
                </div>
              </div>

              {g.students.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  No active students in this class.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Adm. No.</TableHead>
                        <TableHead className="min-w-[200px]">Name</TableHead>
                        <TableHead className="min-w-[100px]">Gender</TableHead>
                        <TableHead className="min-w-[120px]">Class</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.students.map((s) => {
                        const fullName = [s.firstName, s.otherNames, s.lastName]
                          .filter(Boolean)
                          .join(' ')
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs">
                              {s.admissionNumber}
                            </TableCell>
                            <TableCell className="font-medium">{fullName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {s.gender ? (
                                <Badge variant="outline">{s.gender}</Badge>
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {s.class ? (
                                <Badge variant="secondary">{s.class.name}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {s.active ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <XCircle className="h-3 w-3" />
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
