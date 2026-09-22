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
  teacherId: string
  teacherName: string
  teacherEmail: string
  classId: string
  className: string
  classLevel: number
  subjectId: string
  subjectName: string
  subjectCode: string | null
  createdAt: string
}

type Option = {
  id: string
  name?: string
  level?: number
  category?: string | null
  email?: string
  code?: string | null
}

type Options = {
  teachers: Option[]
  classes: Option[]
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
        a.teacherName.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q) ||
        a.subjectName.toLowerCase().includes(q),
    )
  }, [assignments, search])

  // Group assignments by class for a simple matrix view
  const matrix = useMemo(() => {
    const map = new Map<
      string,
      { classRow: { id: string; name: string }; subjects: { name: string; teacher: string }[] }
    >()
    for (const a of assignments) {
      const key = a.classId
      if (!map.has(key))
        map.set(key, { classRow: { id: a.classId, name: a.className }, subjects: [] })
      map.get(key)!.subjects.push({ name: a.subjectName, teacher: a.teacherName })
    }
    return Array.from(map.values()).sort((x, y) =>
      x.classRow.name.localeCompare(y.classRow.name),
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
            Assign teachers to class + subject combinations. A teacher can only
            enter results for their assigned class + subject.
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
            Each row represents one teacher&apos;s responsibility for a class + subject.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search by teacher, class, or subject…"
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
                : 'No assignments yet. Assign a teacher to a class + subject to begin.'}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Teacher</TableHead>
                    <TableHead className="min-w-[120px]">Class</TableHead>
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
                            {a.teacherName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {a.teacherName}
                            </p>
                            {a.teacherEmail ? (
                              <p className="text-xs text-muted-foreground truncate">
                                {a.teacherEmail}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.className}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.subjectName}</TableCell>
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
                                  {a.teacherName} will no longer be able to enter
                                  <strong> {a.subjectName} </strong>results for
                                  <strong> {a.className}</strong>.
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

      {/* Matrix by class */}
      {matrix.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" /> Subjects by Class
            </CardTitle>
            <CardDescription>
              Compact view of all subjects covered in each class, and the responsible teacher.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matrix.map(({ classRow, subjects }) => (
                <div
                  key={classRow.id}
                  className="rounded-md border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{classRow.name}</Badge>
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
                            key={`${classRow.id}-${i}`}
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
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')

  const { data: options, isLoading } = useQuery({
    queryKey: ['principal', 'assignments-options'],
    enabled: open,
    queryFn: () => api.get<Options>('/api/assignments/options'),
  })

  const mutation = useMutation({
    mutationFn: () => {
      if (!teacherId || !classId || !subjectId) {
        throw new Error('Please select a teacher, class, and subject.')
      }
      return api.post('/api/assignments', { teacherId, classId, subjectId })
    },
    onSuccess: () => {
      toast.success('Teacher assigned')
      qc.invalidateQueries({ queryKey: ['principal', 'assignments'] })
      setTeacherId('')
      setClassId('')
      setSubjectId('')
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create assignment'),
  })

  // Sort classes by level then name for a friendlier dropdown
  const sortedClasses = useMemo(() => {
    const list = options?.classes ?? []
    return [...list].sort((a, b) => {
      const la = a.level ?? 0
      const lb = b.level ?? 0
      if (la !== lb) return la - lb
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
  }, [options?.classes])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setTeacherId('')
          setClassId('')
          setSubjectId('')
        }
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign teacher</DialogTitle>
          <DialogDescription>
            Pick a teacher, a class, and a subject. Each combination must be unique.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : !options || sortedClasses.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            You need at least one teacher, class, and subject before assigning.
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
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {sortedClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
            disabled={mutation.isPending || !teacherId || !classId || !subjectId}
          >
            {mutation.isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
