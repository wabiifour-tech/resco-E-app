'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { api, ApiError } from '@/lib/api-client'
import { Plus, Pencil, Trash2, MessageSquareQuote } from 'lucide-react'

export const REMARK_CATEGORIES = [
  'Excellent Performance',
  'Very Good Performance',
  'Average Performance',
  'Needs Improvement',
  'Conduct',
] as const

type Remark = {
  id: string
  category: string
  text: string
  active: boolean
  createdAt: string
}

type GroupedResponse = {
  grouped: { category: string; items: Remark[] }[]
  items: Remark[]
}

export function PrincipalRemarks() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Remark | null>(null)
  const [deleteId, setDeleteId] = useState<Remark | null>(null)
  const [form, setForm] = useState<{ category: string; text: string; active: boolean }>({
    category: REMARK_CATEGORIES[0],
    text: '',
    active: true,
  })

  const { data, isLoading, error } = useQuery<GroupedResponse>({
    queryKey: ['remarks'],
    queryFn: () => api.get<GroupedResponse>('/api/remarks'),
  })

  const createMutation = useMutation({
    mutationFn: (body: { category: string; text: string; active: boolean }) =>
      api.post<Remark>('/api/remarks', body),
    onSuccess: () => {
      toast.success('Remark added')
      qc.invalidateQueries({ queryKey: ['remarks'] })
      setDialogOpen(false)
    },
    onError: (e: ApiError) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { category: string; text: string; active: boolean } }) =>
      api.put<Remark>(`/api/remarks/${id}`, body),
    onSuccess: () => {
      toast.success('Remark updated')
      qc.invalidateQueries({ queryKey: ['remarks'] })
      setDialogOpen(false)
    },
    onError: (e: ApiError) => toast.error(e.message),
  })

  const toggleMutation = useMutation({
    mutationFn: (r: Remark) => api.patch<Remark>(`/api/remarks/${r.id}`, { active: !r.active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['remarks'] })
      toast.success('Remark status updated')
    },
    onError: (e: ApiError) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/remarks/${id}`),
    onSuccess: () => {
      toast.success('Remark deleted')
      qc.invalidateQueries({ queryKey: ['remarks'] })
      setDeleteId(null)
    },
    onError: (e: ApiError) => toast.error(e.message),
  })

  function openAdd() {
    setEditing(null)
    setForm({ category: REMARK_CATEGORIES[0], text: '', active: true })
    setDialogOpen(true)
  }
  function openEdit(r: Remark) {
    setEditing(r)
    setForm({ category: r.category, text: r.text, active: r.active })
    setDialogOpen(true)
  }
  function submit() {
    if (!form.text.trim()) {
      toast.error('Remark text is required')
      return
    }
    if (editing) {
      editMutation.mutate({ id: editing.id, body: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const grouped = data?.grouped ?? []
  const totalActive = (data?.items ?? []).filter((r) => r.active).length
  const totalAll = (data?.items ?? []).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Remarks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Predefined teacher remarks grouped by category. Active remarks appear in the report-card remark picker.
          </p>
        </div>
        <Button onClick={openAdd} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Add Remark
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">Total: {totalAll}</Badge>
        <Badge>Active: {totalActive}</Badge>
        <Badge variant="outline">Inactive: {totalAll - totalActive}</Badge>
        <Badge variant="outline">Categories: {grouped.length}</Badge>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading remarks…</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load remarks: {(error as Error).message}
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
            <MessageSquareQuote className="h-8 w-8" />
            <p className="text-sm">No remarks defined yet. Click “Add Remark” to create the first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map((g) => (
            <Card key={g.category} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{g.category}</CardTitle>
                  <Badge variant="outline">{g.items.length}</Badge>
                </div>
                <CardDescription className="text-xs">
                  {g.items.filter((r) => r.active).length} active
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 max-h-96 overflow-y-auto pr-3">
                <ul className="space-y-2">
                  {g.items.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-border p-3 bg-card-foreground/[0.02] flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${r.active ? '' : 'text-muted-foreground line-through'}`}>
                          {r.text}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {r.active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={r.active}
                          onCheckedChange={() => toggleMutation.mutate(r)}
                          disabled={toggleMutation.isPending}
                          aria-label={`Toggle active for remark ${r.text}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(r)}
                          aria-label="Edit remark"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(r)}
                          aria-label="Delete remark"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Remark' : 'Add Remark'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the category, text, and active state.'
                : 'Create a predefined remark teachers can attach to a student’s report card.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remark-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="remark-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {REMARK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remark-text">Remark text</Label>
              <Textarea
                id="remark-text"
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder="e.g. Excellent performance. Keep it up."
                rows={3}
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground text-right">{form.text.length}/500</p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="remark-active">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive remarks are hidden from teachers.</p>
              </div>
              <Switch
                id="remark-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={createMutation.isPending || editMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Add Remark'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete remark?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete:
              <span className="block italic mt-1">“{deleteId?.text}”</span>
              If it is in use by existing results, deletion will be blocked — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
