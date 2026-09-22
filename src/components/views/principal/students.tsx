'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  Loader2,
  GraduationCap,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError, api } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string
  name: string
  level: number
  arms: { id: string; name: string; fullName: string }[]
}

type ClassesResponse = { classes: ClassRow[] }

type StudentRow = {
  id: string
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: string | null
  classId: string
  classArmId: string | null
  active: boolean
  class: { id: string; name: string }
  classArm: { id: string; name: string; fullName: string } | null
}

type StudentsResponse = { students: StudentRow[]; count: number }

type Gender = 'MALE' | 'FEMALE'

// ─── API helpers ───────────────────────────────────────────────────────────────

async function fetchClasses(): Promise<ClassRow[]> {
  const r = await api.get<ClassesResponse>('/api/classes')
  return r.classes
}

async function fetchStudents(params: {
  q: string
  classId: string
  armId: string
  active: string
}): Promise<StudentsResponse> {
  return api.get<StudentsResponse>('/api/students', {
    query: {
      q: params.q || undefined,
      classId: params.classId || undefined,
      armId: params.armId || undefined,
      active: params.active || undefined,
    },
  })
}

type CreatePayload = {
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: Gender | null
  classId: string
  classArmId: string | null
  active: boolean
}

async function createStudent(body: CreatePayload) {
  return api.post<{ student: StudentRow }>('/api/students', body)
}

async function updateStudent(
  id: string,
  body: Partial<CreatePayload>,
) {
  return api.put<{ student: StudentRow }>(`/api/students/${id}`, body)
}

async function toggleStudent(id: string, active: boolean) {
  return api.patch<{ student: StudentRow }>(`/api/students/${id}`, { active })
}

// ─── Student form dialog ─────────────────────────────────────────────────────

type FormData = {
  admissionNumber: string
  firstName: string
  lastName: string
  otherNames: string
  gender: Gender | null
  classId: string
  classArmId: string | null
  active: boolean
}

type StudentFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  student?: StudentRow | null
}

function StudentFormDialog({
  open,
  onOpenChange,
  mode,
  student,
}: StudentFormDialogProps) {
  // Outer shell — the form state lives in a child (`StudentFormBody`) mounted
  // INSIDE DialogContent, so when the dialog closes Radix unmounts it; on each
  // open it remounts fresh, running useState's initialiser against the current
  // `student` prop. No effect-based reset needed.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <StudentFormBody mode={mode} student={student} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

type StudentFormBodyProps = {
  mode: 'create' | 'edit'
  student?: StudentRow | null
  onOpenChange: (open: boolean) => void
}

function StudentFormBody({ mode, student, onOpenChange }: StudentFormBodyProps) {
  const qc = useQueryClient()
  const isCreate = mode === 'create'

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes-for-students'],
    queryFn: fetchClasses,
  })

  const [form, setForm] = useState<FormData>({
    admissionNumber: student?.admissionNumber ?? '',
    firstName: student?.firstName ?? '',
    lastName: student?.lastName ?? '',
    otherNames: student?.otherNames ?? '',
    gender: student?.gender as Gender | null,
    classId: student?.classId ?? '',
    classArmId: student?.classArmId ?? null,
    active: student?.active ?? true,
  })

  const arms = useMemo(() => {
    if (!form.classId) return []
    return classes?.find((c) => c.id === form.classId)?.arms ?? []
  }, [form.classId, classes])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: CreatePayload = {
        admissionNumber: data.admissionNumber.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        otherNames: data.otherNames.trim() || null,
        gender: data.gender,
        classId: data.classId,
        classArmId: data.classArmId || null,
        active: data.active,
      }
      if (isCreate) return createStudent(payload)
      return updateStudent(student!.id, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      toast.success(isCreate ? 'Student created' : 'Student updated')
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong'
      toast.error(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.admissionNumber.trim())
      return toast.error('Admission number is required')
    if (!form.firstName.trim()) return toast.error('First name is required')
    if (!form.lastName.trim()) return toast.error('Last name is required')
    if (!form.classId) return toast.error('Class is required')
    mutation.mutate(form)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isCreate ? 'Add student' : 'Edit student'}
        </DialogTitle>
        <DialogDescription>
          {isCreate
            ? 'Create a new student record. The same student is reused across all three terms.'
            : 'Update the student record. Admission numbers must stay unique.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="s-adm">Admission number</Label>
          <Input
            id="s-adm"
            value={form.admissionNumber}
            onChange={(e) =>
              setForm({ ...form, admissionNumber: e.target.value })
            }
            placeholder="e.g. RES/2026/001"
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            A unique, stable identifier. Do not reuse it for another student.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="s-fn">First name</Label>
            <Input
              id="s-fn"
              value={form.firstName}
              onChange={(e) =>
                setForm({ ...form, firstName: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-ln">Last name</Label>
            <Input
              id="s-ln"
              value={form.lastName}
              onChange={(e) =>
                setForm({ ...form, lastName: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="s-on">Other names (optional)</Label>
            <Input
              id="s-on"
              value={form.otherNames}
              onChange={(e) =>
                setForm({ ...form, otherNames: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-gender">Gender (optional)</Label>
            <Select
              value={form.gender ?? '__none__'}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  gender: v === '__none__' ? null : (v as Gender),
                })
              }
            >
              <SelectTrigger id="s-gender" className="w-full">
                <SelectValue placeholder="Not specified" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not specified</SelectItem>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="s-class">Class</Label>
            <Select
              value={form.classId || '__none__'}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  classId: v === '__none__' ? '' : v,
                  classArmId: null,
                })
              }
              disabled={classesLoading}
            >
              <SelectTrigger id="s-class" className="w-full">
                <SelectValue
                  placeholder={
                    classesLoading ? 'Loading…' : 'Select a class'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-arm">Class arm (optional)</Label>
            <Select
              value={form.classArmId ?? '__none__'}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  classArmId: v === '__none__' ? null : v,
                })
              }
              disabled={!form.classId}
            >
              <SelectTrigger id="s-arm" className="w-full">
                <SelectValue
                  placeholder={
                    !form.classId ? 'Pick a class first' : 'No specific arm'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No specific arm</SelectItem>
                {arms.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Active status</p>
            <p className="text-xs text-muted-foreground">
              Inactive students are excluded from new result entries.
            </p>
          </div>
          <Switch
            checked={form.active}
            onCheckedChange={(checked) =>
              setForm({ ...form, active: checked })
            }
            aria-label="Toggle active status"
          />
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
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isCreate ? 'Create student' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PrincipalStudents() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [armFilter, setArmFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StudentRow | null>(null)

  const { data: classesData } = useQuery({
    queryKey: ['classes-for-students'],
    queryFn: fetchClasses,
  })

  const filterArms = useMemo(() => {
    if (!classFilter || classFilter === 'all') return []
    return classesData?.find((c) => c.id === classFilter)?.arms ?? []
  }, [classFilter, classesData])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['students', q, classFilter, armFilter, activeFilter],
    queryFn: () =>
      fetchStudents({
        q,
        classId: classFilter === 'all' ? '' : classFilter,
        armId: armFilter === 'all' ? '' : armFilter,
        active: activeFilter,
      }),
  })

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      toggleStudent(vars.id, vars.active),
    onMutate: async (vars) => {
      await qc.cancelQueries({
        queryKey: ['students', q, classFilter, armFilter, activeFilter],
      })
      const prev = qc.getQueryData<StudentsResponse>([
        'students',
        q,
        classFilter,
        armFilter,
        activeFilter,
      ])
      if (prev) {
        const next = {
          ...prev,
          students: prev.students.map((s) =>
            s.id === vars.id ? { ...s, active: vars.active } : s,
          ),
        }
        qc.setQueryData<StudentsResponse>(
          ['students', q, classFilter, armFilter, activeFilter],
          next,
        )
      }
      return { prev }
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to update status'
      toast.error(msg)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
    },
  })

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setQ(searchInput.trim())
  }

  function handleClassFilterChange(v: string) {
    setClassFilter(v)
    setArmFilter('all')
  }

  const students = data?.students ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage student records. Each student is identified by a stable
            admission number and reused across all three terms.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="sm:w-auto">
          <Plus className="h-4 w-4" />
          Add student
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3 lg:flex-row lg:items-center"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or admission number…"
                className="pl-9"
                aria-label="Search students"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:items-center">
              <Select value={classFilter} onValueChange={handleClassFilterChange}>
                <SelectTrigger
                  className="sm:w-40 lg:w-36"
                  aria-label="Filter by class"
                >
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classesData?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={armFilter}
                onValueChange={setArmFilter}
                disabled={classFilter === 'all' || filterArms.length === 0}
              >
                <SelectTrigger
                  className="sm:w-40 lg:w-36"
                  aria-label="Filter by arm"
                >
                  <SelectValue placeholder="All arms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All arms</SelectItem>
                  {filterArms.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={activeFilter}
                onValueChange={setActiveFilter}
              >
                <SelectTrigger
                  className="sm:w-40 lg:w-36"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="true">Active only</SelectItem>
                  <SelectItem value="false">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
            <p className="text-sm text-muted-foreground">
              {isFetching && !isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> refreshing…
                </span>
              ) : (
                <>
                  {students.length} student{students.length === 1 ? '' : 's'}
                  {q || classFilter !== 'all' || armFilter !== 'all' || activeFilter !== 'all'
                    ? ' matched'
                    : ' total'}
                </>
              )}
            </p>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <GraduationCap className="h-8 w-8" />
              <p className="text-sm">No students match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adm. No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Class / Arm</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
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
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{s.class.name}</Badge>
                            {s.classArm ? (
                              <Badge variant="outline">
                                {s.classArm.fullName}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No arm
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={s.active}
                              disabled={toggleMutation.isPending}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  id: s.id,
                                  active: checked,
                                })
                              }
                              aria-label={`Toggle active status for ${fullName}`}
                            />
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
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditTarget(s)}
                              aria-label={`Edit ${fullName}`}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          </div>
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

      {/* Dialogs */}
      <StudentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
      <StudentFormDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        mode="edit"
        student={editTarget}
      />
    </div>
  )
}
