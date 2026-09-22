'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ClipboardList, Plus, Trash2, Search, User, BookOpen } from 'lucide-react'

type Assignment = {
  id: string
  teacher: {
    id: string
    user: { name: string; email?: string | null }
  }
  classArm: {
    id: string
    fullName: string
    class?: { name: string; level: number }
  }
  subject: { id: string; name: string; code?: string | null }
}

type Option = {
  id: string
  name?: string
  fullName?: string
  className?: string
  level?: number
  email?: string
  code?: string | null
}

type Options = {
  teachers: Option[]
  classArms: Option[]
  subjects: Option[]
}

export function PrincipalAssignments() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['principal', 'assignments'],
    queryFn: () => api.get<{ assignments: Assignment[] }>('/api/assignments'),
  })

  const assignments = data?.assignments ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assignments
    return assignments.filter(
      (a) =>
        a.teacher.user.name.toLowerCase().includes(q) ||
        a.classArm.fullName.toLowerCase().includes(q) ||
        a.subject.name.toLowerCase().includes(q),
    )
  }, [assignments, search])

  // Group assignments by classArm for a simple matrix view
  const matrix = useMemo(() => {
    const map = new Map<string, { classArm: Assignment['classArm']; subjects: { name: string; teacher: string }[] }>()
    for (const a of assignments) {
      const key = a.classArm.id
      if (!map.has(key)) map.set(key, { classArm: a.classArm, subjects: [] })
      map.get(key)!.subjects.push({ name: a.subject.name, teacher: a.teacher.user.name })
    }
    return Array.from(map.values()).sort((x, y) =>
      x.classArm.fullName.localeCompare(y.classArm.fullName),
    )
  }, [assignments])

  const delMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assignments/${id}`),
    onSuccess: () => {
      toast.success('Assignment removed')
      qc.invalidateQueries({ queryKey: ['principal', 'assignments'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to remove assignment'),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign teachers to subject + class-arm combinations. A teacher can only enter results for their assigned class-arm + subject.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Assign Teacher
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Current Assignments
            <Badge variant="secondary">{assignments.length}</Badge>
          </CardTitle>
          <CardDescription>
            Each row represents one teacher&apos;s responsibility for a class-arm + subject.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search by teacher, arm, or subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {search.trim()
                ? 'No assignments match your search.'
                : 'No assignments yet. Assign a teacher to a class-arm + subject to begin.'}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Teacher</TableHead>
                    <TableHead className="min-w-[120px]">Class Arm</TableHead>
                    <TableHead className="min-w-[180px]">Subject</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                            {a.teacher.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {a.teacher.user.name}
                            </p>
                            {a.teacher.user.email ? (
                              <p className="text-xs text-muted-foreground truncate">
                                {a.teacher.user.email}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {a.classArm.fullName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.subject.name}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                aria-label="Remove assignment"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove assignment?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {a.teacher.user.name} will no longer be able to enter
                                  <strong> {a.subject.name} </strong>results for
                                  <strong> {a.classArm.fullName}</strong>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => delMutation.mutate(a.id)}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Matrix by class arm */}
      {matrix.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" /> Subjects by Class Arm
            </CardTitle>
            <CardDescription>
              Compact view of all subjects covered in each class arm, and the responsible teacher.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matrix.map(({ classArm, subjects }) => (
                <div
                  key={classArm.id}
                  className="rounded-md border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono">
                      {classArm.fullName}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {subjects.length} subject{subjects.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm max-h-40 overflow-y-auto pr-1">
                    {subjects.length === 0 ? (
                      <li className="text-xs text-muted-foreground">No subjects.</li>
                    ) : (
                      subjects
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((s, i) => (
                          <li
                            key={`${classArm.id}-${i}`}
                            className="flex flex-col gap-0.5 border-b last:border-0 pb-1 last:pb-0"
                          >
                            <span className="font-medium">{s.name}</span>
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {s.teacher}
                            </span>
                          </li>
                        ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CreateAssignmentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function CreateAssignmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [teacherId, setTeacherId] = useState('')
  const [classArmId, setClassArmId] = useState('')
  const [subjectId, setSubjectId] = useState('')

  const { data: options, isLoading } = useQuery({
    queryKey: ['principal', 'assignments-options'],
    enabled: open,
    queryFn: () => api.get<Options>('/api/assignments/options'),
  })

  const mutation = useMutation({
    mutationFn: () => {
      if (!teacherId || !classArmId || !subjectId) {
        throw new Error('Please select a teacher, class arm, and subject.')
      }
      return api.post('/api/assignments', { teacherId, classArmId, subjectId })
    },
    onSuccess: () => {
      toast.success('Teacher assigned')
      qc.invalidateQueries({ queryKey: ['principal', 'assignments'] })
      setTeacherId('')
      setClassArmId('')
      setSubjectId('')
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create assignment'),
  })

  // Sort class arms by level then name for a friendlier dropdown
  const sortedArms = useMemo(() => {
    const arms = options?.classArms ?? []
    return [...arms].sort((a, b) => {
      const la = a.level ?? 0
      const lb = b.level ?? 0
      if (la !== lb) return la - lb
      return (a.fullName ?? '').localeCompare(b.fullName ?? '')
    })
  }, [options?.classArms])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setTeacherId('')
          setClassArmId('')
          setSubjectId('')
        }
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign teacher</DialogTitle>
          <DialogDescription>
            Pick a teacher, a class arm, and a subject. Each combination must be unique.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : !options || sortedArms.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            You need at least one teacher, class arm, and subject before assigning.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {options.teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.email ? ` (${t.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class Arm</Label>
              <Select value={classArmId} onValueChange={setClassArmId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select class arm" />
                </SelectTrigger>
                <SelectContent>
                  {sortedArms.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName} {a.className ? `(${a.className})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {options.subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !teacherId || !classArmId || !subjectId}
          >
            {mutation.isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
