'use client'
import { useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  FileText,
  GraduationCap,
  X,
} from 'lucide-react'

type Subject = {
  id: string
  name: string
  code: string | null
  _count: { assignments: number; results: number }
}

type ClassRow = {
  id: string
  name: string
  level: number
  category: string | null
  studentCount: number
}

// Shape returned by GET /api/class-subjects?classId=<id>
type OfferedSubject = {
  id: string
  name: string
  code: string | null
  active: boolean
  classSubjectId: string
}

export function PrincipalSubjects() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<string>('library')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['principal', 'subjects'],
    queryFn: () => api.get<{ subjects: Subject[] }>('/api/subjects'),
  })

  // Flat list of classes (for the "Class Subjects" config tab).
  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<{ classes: ClassRow[] }>('/api/classes'),
    staleTime: 60_000,
  })

  const subjects = data?.subjects ?? []
  const classes = classesData?.classes ?? []
  const filtered = search.trim()
    ? subjects.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.code ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : subjects

  const delMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/subjects/${id}`),
    onSuccess: () => {
      toast.success('Subject deleted')
      qc.invalidateQueries({ queryKey: ['principal', 'subjects'] })
      qc.invalidateQueries({ queryKey: ['class-subjects'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete subject'),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the subject library and configure which subjects each class offers.
          </p>
        </div>
        {tab === 'library' && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Subject
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="library" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Subject Library
          </TabsTrigger>
          <TabsTrigger value="class-subjects" className="gap-1.5">
            <GraduationCap className="h-4 w-4" /> Class Subjects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" /> Subjects
                <Badge variant="secondary">{subjects.length}</Badge>
              </CardTitle>
              <CardDescription>
                Subjects can be assigned to teachers per class from the Teacher Assignments module.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search subjects by name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  {search.trim() ? 'No subjects match your search.' : 'No subjects yet. Create the first one.'}
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Name</TableHead>
                        <TableHead className="min-w-[100px]">Code</TableHead>
                        <TableHead className="min-w-[100px] text-right">Teachers</TableHead>
                        <TableHead className="min-w-[100px] text-right">Results</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">
                            <span className="inline-flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              {s.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            {s.code ? (
                              <Badge variant="outline" className="font-mono">
                                {s.code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s._count.assignments}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s._count.results}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditing(s)}
                                aria-label={`Edit ${s.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    aria-label={`Delete ${s.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This subject is referenced by {s._count.results} result(s).
                                      {s._count.results > 0
                                        ? ' Remove those results before deleting.'
                                        : ' This action cannot be undone.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => delMutation.mutate(s.id)}
                                      disabled={s._count.results > 0}
                                    >
                                      Delete
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
        </TabsContent>

        <TabsContent value="class-subjects" className="mt-4">
          <ClassSubjectsConfig classes={classes} allSubjects={subjects} />
        </TabsContent>
      </Tabs>

      <SubjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
      <SubjectFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        mode="edit"
        subject={editing}
      />
    </div>
  )
}

// ─── Class Subjects configuration ──────────────────────────────────────────
// Lets the principal choose WHICH subjects each class OFFERS (ClassSubject rows).

function ClassSubjectsConfig({
  classes,
  allSubjects,
}: {
  classes: ClassRow[]
  allSubjects: Subject[]
}) {
  const qc = useQueryClient()
  const [classId, setClassId] = useState<string>('')
  const [search, setSearch] = useState('')

  // Derived: default to the first class (ordered by level) until the user
  // picks one. Avoids a useEffect+setState cascade.
  const effectiveClassId = classId || classes[0]?.id || ''

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['class-subjects', effectiveClassId],
    queryFn: () =>
      api.get<{ classId: string; subjects: OfferedSubject[] }>('/api/class-subjects', {
        query: { classId: effectiveClassId },
      }),
    enabled: !!effectiveClassId,
  })

  const offered = data?.subjects ?? []
  const offeredIds = new Set(offered.map((s) => s.id))
  // Available = subjects in the library NOT yet offered for this class.
  const available = allSubjects.filter((s) => !offeredIds.has(s.id))

  const q = search.trim().toLowerCase()
  const matches = (name: string, code: string | null) =>
    !q ||
    name.toLowerCase().includes(q) ||
    (code ?? '').toLowerCase().includes(q)
  const offeredFiltered = offered.filter((s) => matches(s.name, s.code))
  const availableFiltered = available.filter((s) => matches(s.name, s.code))

  const addMutation = useMutation({
    mutationFn: (subjectId: string) =>
      api.post('/api/class-subjects', { classId: effectiveClassId, subjectId }),
    onSuccess: () => {
      toast.success('Subject added to class')
      qc.invalidateQueries({ queryKey: ['class-subjects', effectiveClassId] })
      qc.invalidateQueries({ queryKey: ['class-subjects'] })
      qc.invalidateQueries({ queryKey: ['assignments'] })
      qc.invalidateQueries({ queryKey: ['assignments-options'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to add subject'),
  })

  const removeMutation = useMutation({
    mutationFn: (classSubjectId: string) =>
      api.delete(`/api/class-subjects/${classSubjectId}`),
    onSuccess: () => {
      toast.success('Subject removed from class')
      qc.invalidateQueries({ queryKey: ['class-subjects', effectiveClassId] })
      qc.invalidateQueries({ queryKey: ['class-subjects'] })
      qc.invalidateQueries({ queryKey: ['assignments'] })
      qc.invalidateQueries({ queryKey: ['assignments-options'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to remove subject'),
  })

  const selectedClass = classes.find((c) => c.id === effectiveClassId)
  const hasClasses = classes.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-4 w-4" /> Class Subjects Configuration
        </CardTitle>
        <CardDescription>
          Choose which subjects each class OFFERS. A subject must be offered for a
          class before teachers can be assigned to it or results can be entered.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="cs-class">Class</Label>
            <Select value={effectiveClassId} onValueChange={setClassId} disabled={!hasClasses}>
              <SelectTrigger id="cs-class" className="w-full sm:w-[280px]">
                <SelectValue placeholder={hasClasses ? 'Select a class' : 'No classes available'} />
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
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="cs-search">Search subjects</Label>
            <Input
              id="cs-search"
              placeholder="Filter by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </div>

        {!effectiveClassId ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No classes available. Create classes first from the Classes module.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{offered.length}</span>{' '}
                subject{offered.length === 1 ? '' : 's'} offered for{' '}
                <span className="font-medium text-foreground">{selectedClass?.name}</span>
              </p>
              {isFetching && !isLoading && (
                <span className="text-xs text-muted-foreground">Updating…</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Offered subjects */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Offered subjects</h3>
                  <Badge variant="secondary">{offered.length}</Badge>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-md border bg-card">
                  {isLoading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : offeredFiltered.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-6 text-center">
                      {q
                        ? 'No offered subjects match your search.'
                        : 'No subjects offered yet. Add some from the available list.'}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {offeredFiltered.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-3 p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.name}</p>
                            {s.code ? (
                              <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                                {s.code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">No code</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeMutation.mutate(s.classSubjectId)}
                            disabled={removeMutation.isPending}
                            className="shrink-0 text-destructive hover:text-destructive"
                            aria-label={`Remove ${s.name}`}
                          >
                            <X className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Available to add */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Available to add</h3>
                  <Badge variant="secondary">{available.length}</Badge>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-md border bg-card">
                  {availableFiltered.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-6 text-center">
                      {q
                        ? 'No available subjects match your search.'
                        : 'All subjects in the library are already offered for this class.'}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {availableFiltered.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-3 p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.name}</p>
                            {s.code ? (
                              <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                                {s.code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">No code</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addMutation.mutate(s.id)}
                            disabled={addMutation.isPending}
                            className="shrink-0"
                            aria-label={`Add ${s.name}`}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SubjectFormDialog({
  open,
  onOpenChange,
  mode,
  subject,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  subject?: Subject | null
}) {
  // Only render the dialog body when open so the form state resets on each open.
  if (!open) return null
  return (
    <SubjectFormDialogInner
      key={mode === 'edit' ? subject?.id ?? 'edit' : 'create'}
      mode={mode}
      subject={subject}
      onOpenChange={onOpenChange}
    />
  )
}

function SubjectFormDialogInner({
  onOpenChange,
  mode,
  subject,
}: {
  mode: 'create' | 'edit'
  subject?: Subject | null
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(subject?.name ?? '')
  const [code, setCode] = useState(subject?.code ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim().toUpperCase(),
        code: code.trim() ? code.trim().toUpperCase() : null,
      }
      if (mode === 'create') return api.post('/api/subjects', body)
      return api.put(`/api/subjects/${subject!.id}`, body)
    },
    onSuccess: () => {
      toast.success(mode === 'create' ? 'Subject created' : 'Subject updated')
      qc.invalidateQueries({ queryKey: ['principal', 'subjects'] })
      qc.invalidateQueries({ queryKey: ['class-subjects'] })
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save subject'),
  })

  function submit() {
    if (!name.trim()) {
      toast.error('Subject name is required')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create subject' : 'Edit subject'}
          </DialogTitle>
          <DialogDescription>
            Subject names must be unique (e.g. Mathematics, English Language, Biology).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Subject name</Label>
            <Input
              id="sub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mathematics"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-code">Code (optional)</Label>
            <Input
              id="sub-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MTH"
              className="uppercase"
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending
              ? 'Saving…'
              : mode === 'create'
                ? 'Create'
                : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
