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
import { BookOpen, Plus, Pencil, Trash2, FileText } from 'lucide-react'

type Subject = {
  id: string
  name: string
  code: string | null
  _count: { assignments: number; results: number }
}

export function PrincipalSubjects() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['principal', 'subjects'],
    queryFn: () => api.get<{ subjects: Subject[] }>('/api/subjects'),
  })

  const subjects = data?.subjects ?? []
  const filtered = search.trim()
    ? subjects.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.code ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : subjects

  const delMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/subjects/${id}`),
    onSuccess: () => {
      toast.success('Subject deleted')
      qc.invalidateQueries({ queryKey: ['principal', 'subjects'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete subject'),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the list of subjects taught across the school.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Subject
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> Subjects
            <Badge variant="secondary">{subjects.length}</Badge>
          </CardTitle>
          <CardDescription>
            Subjects can be assigned to teachers per class-arm from the Teacher Assignments module.
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
