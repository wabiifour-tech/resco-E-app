'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  KeyRound,
  Loader2,
  Users,
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

type TeacherRow = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  teacherId: string | null
  assignmentCount: number
  createdAt: string
}

type TeachersResponse = { teachers: TeacherRow[]; count: number }

// ─── API helpers ───────────────────────────────────────────────────────────────

async function fetchTeachers(params: {
  q: string
  active: string
}): Promise<TeachersResponse> {
  return api.get<TeachersResponse>('/api/teachers', {
    query: {
      q: params.q || undefined,
      active: params.active || undefined,
    },
  })
}

async function createTeacher(body: {
  name: string
  email: string
  password: string
  active: boolean
}) {
  return api.post<{ teacher: TeacherRow }>('/api/teachers', body)
}

async function updateTeacher(
  id: string,
  body: { name?: string; email?: string; active?: boolean },
) {
  return api.put<{ teacher: TeacherRow }>(`/api/teachers/${id}`, body)
}

async function toggleTeacher(id: string, active: boolean) {
  return api.patch<{ teacher: TeacherRow }>(`/api/teachers/${id}`, { active })
}

async function changePassword(id: string, password: string) {
  return api.post<{ ok: boolean }>(`/api/teachers/${id}/password`, { password })
}

// ─── Create / Edit dialog ─────────────────────────────────────────────────────

type FormData = {
  name: string
  email: string
  password: string
  confirmPassword: string
  active: boolean
}

type TeacherFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  teacher?: TeacherRow | null
}

function TeacherFormDialog({
  open,
  onOpenChange,
  mode,
  teacher,
}: TeacherFormDialogProps) {
  // The outer shell only renders the Dialog. The form state lives in a child
  // (`TeacherFormBody`) mounted INSIDE DialogContent, so when the dialog
  // closes Radix unmounts it; on each open it remounts fresh — useState's
  // initialiser runs again with the current `teacher` prop, so we never need
  // an effect-based reset.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <TeacherFormBody mode={mode} teacher={teacher} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

type TeacherFormBodyProps = {
  mode: 'create' | 'edit'
  teacher?: TeacherRow | null
  onOpenChange: (open: boolean) => void
}

function TeacherFormBody({ mode, teacher, onOpenChange }: TeacherFormBodyProps) {
  const qc = useQueryClient()
  const isCreate = mode === 'create'

  const [form, setForm] = useState<FormData>({
    name: teacher?.name ?? '',
    email: teacher?.email ?? '',
    password: '',
    confirmPassword: '',
    active: teacher?.active ?? true,
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isCreate) {
        return createTeacher({
          name: data.name.trim(),
          email: data.email.trim(),
          password: data.password,
          active: data.active,
        })
      }
      return updateTeacher(teacher!.id, {
        name: data.name.trim(),
        email: data.email.trim(),
        active: data.active,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      toast.success(isCreate ? 'Teacher created' : 'Teacher updated')
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
    if (!form.name.trim()) return toast.error('Full name is required')
    if (!form.email.trim()) return toast.error('Email is required')
    if (isCreate) {
      if (form.password.length < 6)
        return toast.error('Password must be at least 6 characters')
      if (form.password !== form.confirmPassword)
        return toast.error('Passwords do not match')
    }
    mutation.mutate(form)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isCreate ? 'Create teacher' : 'Edit teacher'}
        </DialogTitle>
        <DialogDescription>
          {isCreate
            ? 'Add a new teacher account. They can sign in once their assignments are configured.'
            : 'Update teacher identity and active status.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="t-name">Full name</Label>
          <Input
            id="t-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Adaeze Okafor"
            autoComplete="name"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-email">Email</Label>
          <Input
            id="t-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="teacher@resco.edu.ng"
            autoComplete="email"
            required
          />
        </div>

        {isCreate && (
          <div className="space-y-2">
            <Label htmlFor="t-password">Password</Label>
            <Input
              id="t-password"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum 6 characters. The password is hashed before storage —
              it cannot be retrieved later.
            </p>
          </div>
        )}

        {isCreate && (
          <div className="space-y-2">
            <Label htmlFor="t-confirm">Confirm password</Label>
            <Input
              id="t-confirm"
              type="password"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              placeholder="Re-enter password"
              autoComplete="new-password"
              required
            />
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Active status</p>
            <p className="text-xs text-muted-foreground">
              Inactive teachers cannot sign in.
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
            {isCreate ? 'Create teacher' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

// ─── Change password dialog ───────────────────────────────────────────────────

type PasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher: TeacherRow | null
}

function PasswordDialog({ open, onOpenChange, teacher }: PasswordDialogProps) {
  // The form body lives inside DialogContent, so it remounts each time the
  // dialog reopens — no effect-based reset needed.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <PasswordFormBody teacher={teacher} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

function PasswordFormBody({
  teacher,
  onOpenChange,
}: {
  teacher: TeacherRow | null
  onOpenChange: (open: boolean) => void
}) {
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const mutation = useMutation({
    mutationFn: (pw: string) => changePassword(teacher!.id, pw),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      toast.success('Password updated')
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to update password'
      toast.error(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!teacher) return
    if (password.length < 6)
      return toast.error('Password must be at least 6 characters')
    if (password !== confirm) return toast.error('Passwords do not match')
    mutation.mutate(password)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Change password
        </DialogTitle>
        <DialogDescription>
          Set a new password for{' '}
          <span className="font-medium text-foreground">{teacher?.name}</span>{' '}
          ({teacher?.email}). The stored password is never shown.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="np">New password</Label>
          <Input
            id="np"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            autoFocus
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc">Confirm new password</Label>
          <Input
            id="npc"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            autoComplete="new-password"
            required
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
            Update password
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PrincipalTeachers() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TeacherRow | null>(null)
  const [pwTarget, setPwTarget] = useState<TeacherRow | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['teachers', q, activeFilter],
    queryFn: () => fetchTeachers({ q, active: activeFilter }),
  })

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      toggleTeacher(vars.id, vars.active),
    onMutate: async (vars) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['teachers', q, activeFilter] })
      const prev = qc.getQueryData<TeachersResponse>([
        'teachers',
        q,
        activeFilter,
      ])
      if (prev) {
        const next = {
          ...prev,
          teachers: prev.teachers.map((t) =>
            t.id === vars.id ? { ...t, active: vars.active } : t,
          ),
        }
        qc.setQueryData<TeachersResponse>(['teachers', q, activeFilter], next)
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
      qc.invalidateQueries({ queryKey: ['teachers'] })
    },
  })

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setQ(searchInput.trim())
  }

  const teachers = data?.teachers ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teachers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create teacher accounts and manage their identity, password, and
            active status.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="sm:w-auto">
          <Plus className="h-4 w-4" />
          Add teacher
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-9"
                aria-label="Search teachers"
              />
            </div>
            <Select
              value={activeFilter}
              onValueChange={(v) => setActiveFilter(v)}
            >
              <SelectTrigger className="sm:w-44" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="true">Active only</SelectItem>
                <SelectItem value="false">Inactive only</SelectItem>
              </SelectContent>
            </Select>
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
                  {teachers.length} teacher{teachers.length === 1 ? '' : 's'}
                  {q || activeFilter !== 'all' ? ' matched' : ' total'}
                </>
              )}
            </p>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <Users className="h-8 w-8" />
              <p className="text-sm">No teachers match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Assignments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.email}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{t.assignmentCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={t.active}
                            disabled={toggleMutation.isPending}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                id: t.id,
                                active: checked,
                              })
                            }
                            aria-label={`Toggle active status for ${t.name}`}
                          />
                          {t.active ? (
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
                            onClick={() => setEditTarget(t)}
                            aria-label={`Edit ${t.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPwTarget(t)}
                            aria-label={`Change password for ${t.name}`}
                          >
                            <KeyRound className="h-4 w-4" />
                            <span className="sr-only">Change password</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <TeacherFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
      <TeacherFormDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        mode="edit"
        teacher={editTarget}
      />
      <PasswordDialog
        open={!!pwTarget}
        onOpenChange={(o) => !o && setPwTarget(null)}
        teacher={pwTarget}
      />
    </div>
  )
}
