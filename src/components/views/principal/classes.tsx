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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Layers, Plus, Pencil, Trash2, Users } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string
  name: string
  level: number
  category: string | null
  studentCount: number
}

type ClassInput = {
  name: string
  level: number
  category: string
}

const CATEGORY_ORDER = [
  'Early Years',
  'Nursery',
  'Primary',
  'Junior Secondary',
  'Senior Secondary',
] as const

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Early Years': 'Pre-Nursery stage (e.g. KG)',
  Nursery: 'Nursery 1 and Nursery 2',
  Primary: 'Primary 1 through Primary 6',
  'Junior Secondary': 'JSS 1 through JSS 3',
  'Senior Secondary': 'SS 1 through SS 3',
}

function categoryOf(c: ClassRow): string {
  return c.category ?? 'Other'
}

export function PrincipalClasses() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['principal', 'classes'],
    queryFn: () => api.get<{ classes: ClassRow[] }>('/api/classes'),
  })
  const classes = data?.classes ?? []

  const createMutation = useMutation({
    mutationFn: (body: ClassInput) => api.post('/api/classes', body),
    onSuccess: () => {
      toast.success('Class created')
      qc.invalidateQueries({ queryKey: ['principal', 'classes'] })
      setCreateOpen(false)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create class'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/classes/${id}`),
    onSuccess: () => {
      toast.success('Class deleted')
      qc.invalidateQueries({ queryKey: ['principal', 'classes'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete class'),
  })

  // Group classes by category (preserving the canonical category order).
  const grouped = (() => {
    const map = new Map<string, ClassRow[]>()
    for (const c of classes) {
      const cat = categoryOf(c)
      const list = map.get(cat) ?? []
      list.push(c)
      map.set(cat, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    }
    const orderedCats = Array.from(map.keys()).sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number])
      const ib = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number])
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })
    return orderedCats.map((cat) => ({ category: cat, items: map.get(cat)! }))
  })()

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the school&apos;s flat class list — KG, Nursery, Primary, JSS, SS.
            Students and teachers are assigned directly to a class.
          </p>
        </div>
        <CreateClassDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={(v) => createMutation.mutate(v)}
          pending={createMutation.isPending}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" /> All Classes
            <Badge variant="secondary">{classes.length}</Badge>
          </CardTitle>
          <CardDescription>
            Classes are grouped by category. Each class holds one student roll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No classes yet. Create the first class to begin.
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ category, items }) => (
                <section key={category} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">{category}</h3>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_DESCRIPTIONS[category] ?? ''}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex flex-col gap-2 rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-base">
                            {cls.name}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            Level {cls.level}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Users className="h-3 w-3" /> {cls.studentCount} students
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(cls)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {cls.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the class. Students,
                                  teacher assignments, and results linked to it
                                  may also be affected. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(cls.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditClassDialog
        cls={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  )
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateClassDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (v: ClassInput) => void
  pending: boolean
}) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('0')
  const [category, setCategory] = useState<string>('Primary')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Class name is required')
      return
    }
    const lvl = Number(level)
    onSubmit({
      name: trimmed,
      level: Number.isFinite(lvl) ? lvl : 0,
      category,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setName('')
          setLevel('0')
          setCategory('Primary')
        }
        onOpenChange(v)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New Class
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new class</DialogTitle>
          <DialogDescription>
            e.g. KG, Nursery 1, Primary 3, JSS 1, SS 2. Students belong directly
            to this class.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cls-name">Class name</Label>
            <Input
              id="cls-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="JSS 1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cls-level">Level (ordering)</Label>
            <Input
              id="cls-level"
              type="number"
              min={0}
              max={20}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower level = earlier in lists. Use 1 for KG, 2 for Nursery 1, etc.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cls-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="cls-category" className="w-full">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {CATEGORY_DESCRIPTIONS[category] ?? ''}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Creating…' : 'Create Class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditClassDialog({
  cls,
  onOpenChange,
}: {
  cls: ClassRow | null
  onOpenChange: (v: boolean) => void
}) {
  if (!cls) return null
  return <EditClassDialogInner key={cls.id} cls={cls} onOpenChange={onOpenChange} />
}

function EditClassDialogInner({
  cls,
  onOpenChange,
}: {
  cls: ClassRow
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(cls.name)
  const [level, setLevel] = useState(String(cls.level))
  const [category, setCategory] = useState<string>(cls.category ?? 'Primary')

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/api/classes/${cls.id}`, {
        name: name.trim(),
        level: Number(level) || 0,
        category,
      }),
    onSuccess: () => {
      toast.success('Class updated')
      qc.invalidateQueries({ queryKey: ['principal', 'classes'] })
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update class'),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {cls.name}</DialogTitle>
          <DialogDescription>
            Update the class name, level, or category.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Class name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-level">Level</Label>
            <Input
              id="edit-level"
              type="number"
              min={0}
              max={20}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="edit-category" className="w-full">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
