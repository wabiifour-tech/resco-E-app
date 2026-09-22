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
  CalendarRange,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Zap,
  FileText,
} from 'lucide-react'

type Term = {
  id: string
  name: string
  order: number
  isActive: boolean
}

type Session = {
  id: string
  name: string
  isActive: boolean
  terms: Term[]
  _count: { results: number }
}

type SessionsResponse = {
  sessions: Session[]
  currentSessionId: string | null
  currentTermId: string | null
}

export function PrincipalSessions() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['principal', 'sessions'],
    queryFn: () => api.get<SessionsResponse>('/api/sessions'),
  })

  const sessions = data?.sessions ?? []
  const currentSessionId = data?.currentSessionId ?? null
  const currentTermId = data?.currentTermId ?? null

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/sessions/${id}/activate`),
    onSuccess: () => {
      toast.success('Session activated')
      qc.invalidateQueries({ queryKey: ['principal', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['principal', 'terms'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to activate session'),
  })

  const delMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/sessions/${id}`),
    onSuccess: () => {
      toast.success('Session deleted')
      qc.invalidateQueries({ queryKey: ['principal', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['principal', 'terms'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to delete session'),
  })

  const currentSession = sessions.find((s) => s.id === currentSessionId)
  const currentTerm = currentSession?.terms.find((t) => t.id === currentTermId)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and activate sessions like 2026/2027. Each new session auto-creates the three terms.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Session
        </Button>
      </div>

      {/* Current session banner */}
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-sm">
            <span className="text-muted-foreground">Current: </span>
            <span className="font-semibold">
              {currentSession ? currentSession.name : 'No active session'}
              {currentTerm ? ` — ${currentTerm.name}` : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" /> All Sessions
            <Badge variant="secondary">{sessions.length}</Badge>
          </CardTitle>
          <CardDescription>
            Only one session can be active at a time. Activating a session also makes it the &quot;current&quot; session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No sessions yet. Create the first academic session.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Session</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Terms</TableHead>
                    <TableHead className="min-w-[100px] text-right">Results</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => {
                    const isCurrent = s.id === currentSessionId
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            {s.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          {s.isActive ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {s.terms.map((t) => t.name).join(', ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s._count.results}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {!isCurrent ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={activateMutation.isPending}
                                  >
                                    <Zap className="h-3.5 w-3.5" /> Activate
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Activate {s.name}?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will deactivate all other sessions and set {s.name} as the current session.
                                      The current term will be reset (you can re-pick one from the Terms module).
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => activateMutation.mutate(s.id)}
                                    >
                                      Activate
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <Badge variant="outline" className="text-emerald-700">
                                Current
                              </Badge>
                            )}
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
                                    {s.isActive
                                      ? 'Deactivate or switch the active session before deleting it.'
                                      : s._count.results > 0
                                        ? `Cannot delete — ${s._count.results} result(s) reference this session.`
                                        : 'This permanently removes the session and its three terms.'}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => delMutation.mutate(s.id)}
                                    disabled={s.isActive || s._count.results > 0}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

      <SessionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
      <SessionFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        mode="edit"
        session={editing}
      />
    </div>
  )
}

function SessionFormDialog({
  open,
  onOpenChange,
  mode,
  session,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  session?: Session | null
}) {
  if (!open) return null
  return (
    <SessionFormDialogInner
      key={mode === 'edit' ? session?.id ?? 'edit' : 'create'}
      mode={mode}
      session={session}
      onOpenChange={onOpenChange}
    />
  )
}

function SessionFormDialogInner({
  onOpenChange,
  mode,
  session,
}: {
  mode: 'create' | 'edit'
  session?: Session | null
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(session?.name ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const body = { name: name.trim() }
      if (mode === 'create') return api.post('/api/sessions', body)
      return api.put(`/api/sessions/${session!.id}`, body)
    },
    onSuccess: () => {
      toast.success(mode === 'create' ? 'Session created' : 'Session renamed')
      qc.invalidateQueries({ queryKey: ['principal', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['principal', 'terms'] })
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save session'),
  })

  function submit() {
    if (!name.trim()) {
      toast.error('Session name is required')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create academic session' : 'Rename academic session'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'A new session automatically creates the three terms (First, Second, Third).'
              : 'Session name must be unique (e.g. 2026/2027).'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ses-name">Session name</Label>
          <Input
            id="ses-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2026/2027"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
