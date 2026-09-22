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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Layers, Plus, Pencil, Trash2, X, Users } from 'lucide-react'

type ClassArm = {
  id: string
  name: string
  fullName: string
  classId: string
}
type ClassWithArms = {
  id: string
  name: string
  level: number
  arms: ClassArm[]
  _count: { students: number }
}

export function PrincipalClasses() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [managedClass, setManagedClass] = useState<ClassWithArms | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['principal', 'classes'],
    queryFn: () => api.get<{ classes: ClassWithArms[] }>('/api/classes'),
  })
  const classes = data?.classes ?? []

  const createMutation = useMutation({
    mutationFn: (body: { name: string; level: number }) =>
      api.post('/api/classes', body),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes &amp; Arms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage school classes (JSS1, SS1, etc.) and their arms (A, B).
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
            Each class has multiple arms. Arms are uniquely identified by their full name (e.g. JSS1A).
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
            <div className="space-y-3">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base">{cls.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Level {cls.level}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Users className="h-3 w-3" /> {cls._count.students} students
                      </Badge>
                    </div>
                    {cls.arms.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No arms — add at least one arm to assign teachers and students.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {cls.arms.map((arm) => (
                          <Badge key={arm.id} variant="outline" className="font-mono">
                            {arm.fullName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManagedClass(cls)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Manage
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
                            This removes the class and all of its arms ({cls.arms.length}).
                            Teacher assignments linked to those arms will also be removed.
                            This action cannot be undone.
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
          )}
        </CardContent>
      </Card>

      <ManageArmsDialog
        cls={managedClass}
        onOpenChange={(open) => !open && setManagedClass(null)}
      />
    </div>
  )
}

function CreateClassDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (v: { name: string; level: number }) => void
  pending: boolean
}) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('0')

  function submit() {
    const trimmed = name.trim().toUpperCase()
    if (!trimmed) {
      toast.error('Class name is required')
      return
    }
    const lvl = Number(level)
    onSubmit({ name: trimmed, level: Number.isFinite(lvl) ? lvl : 0 })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setName('')
          setLevel('0')
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
            e.g. JSS1, JSS2, SS1, SS3. You can add arms (A, B, C) afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cls-name">Class name</Label>
            <Input
              id="cls-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="JSS1"
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
              Lower level = earlier in lists. Use 1 for JSS1, 4 for SS1, etc.
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

function ManageArmsDialog({
  cls,
  onOpenChange,
}: {
  cls: ClassWithArms | null
  onOpenChange: (v: boolean) => void
}) {
  // When closed, render nothing — this guarantees a fresh state when cls changes.
  if (!cls) return null
  return <ManageArmsDialogInner key={cls.id} cls={cls} onOpenChange={onOpenChange} />
}

function ManageArmsDialogInner({
  cls,
  onOpenChange,
}: {
  cls: ClassWithArms
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [armName, setArmName] = useState('')
  const [editName, setEditName] = useState(cls.name)
  const [editLevel, setEditLevel] = useState(String(cls.level))

  const addArm = useMutation({
    mutationFn: (name: string) =>
      api.post(`/api/classes/${cls.id}/arms`, { name }),
    onSuccess: () => {
      toast.success('Arm added')
      qc.invalidateQueries({ queryKey: ['principal', 'classes'] })
      setArmName('')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to add arm'),
  })

  const removeArm = useMutation({
    mutationFn: (armId: string) =>
      api.delete(`/api/classes/${cls.id}/arms/${armId}`),
    onSuccess: () => {
      toast.success('Arm removed')
      qc.invalidateQueries({ queryKey: ['principal', 'classes'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to remove arm'),
  })

  const saveClass = useMutation({
    mutationFn: () =>
      api.put(`/api/classes/${cls.id}`, {
        name: editName.trim().toUpperCase(),
        level: Number(editLevel) || 0,
      }),
    onSuccess: () => {
      toast.success('Class updated')
      qc.invalidateQueries({ queryKey: ['principal', 'classes'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update class'),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage {cls.name}</DialogTitle>
          <DialogDescription>
            Edit class details and manage arms. Arm full names are auto-generated as
            <span className="font-mono"> {'{Class}{Arm}'}</span> (e.g. JSS1A).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
            {/* Edit class */}
            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Class details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-level">Level</Label>
                  <Input
                    id="edit-level"
                    type="number"
                    min={0}
                    max={20}
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => saveClass.mutate()}
                disabled={saveClass.isPending || !editName.trim()}
              >
                {saveClass.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>

            {/* Arms list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Arms ({cls.arms.length})
                </p>
              </div>
              {cls.arms.length === 0 ? (
                <p className="text-xs text-muted-foreground">No arms yet.</p>
              ) : (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {cls.arms.map((arm) => (
                    <li
                      key={arm.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="font-mono font-medium">{arm.fullName}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {arm.fullName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Any teacher assignments for this arm will be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeArm.mutate(arm.id)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={armName}
                  onChange={(e) => setArmName(e.target.value)}
                  placeholder="A"
                  className="w-24"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && armName.trim()) {
                      addArm.mutate(armName.trim())
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (armName.trim()) addArm.mutate(armName.trim().toUpperCase())
                  }}
                  disabled={addArm.isPending || !armName.trim()}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4" /> Add Arm
                </Button>
              </div>
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
