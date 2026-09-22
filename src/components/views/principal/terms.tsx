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
  ClipboardList,
  CheckCircle2,
  Zap,
  CalendarDays,
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
}

type TermsResponse = {
  session: Session | null
  terms: Term[]
  currentSessionId: string | null
  currentTermId: string | null
}

type SessionsListResponse = {
  sessions: { id: string; name: string; isActive: boolean }[]
  currentSessionId: string | null
  currentTermId: string | null
}

export function PrincipalTerms() {
  const qc = useQueryClient()
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')

  // Fetch all sessions so principal can pick which to view
  const { data: sessionsData } = useQuery({
    queryKey: ['principal', 'sessions-list-min'],
    queryFn: () => api.get<SessionsListResponse>('/api/sessions'),
  })

  const fallbackSessionId =
    sessionsData?.currentSessionId ??
    sessionsData?.sessions.find((s) => s.isActive)?.id ??
    sessionsData?.sessions[0]?.id ??
    ''

  const sessionId = selectedSessionId || fallbackSessionId

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['principal', 'terms', sessionId],
    enabled: !!sessionId,
    queryFn: () =>
      api.get<TermsResponse>(`/api/terms`, { query: { sessionId } }),
  })

  const session = data?.session ?? null
  const terms = data?.terms ?? []
  const currentSessionId = data?.currentSessionId ?? null
  const currentTermId = data?.currentTermId ?? null

  const currentTerm = terms.find((t) => t.id === currentTermId)
  const isCurrentSession = session?.id === currentSessionId

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/terms/${id}/activate`),
    onSuccess: () => {
      toast.success('Term activated and set as current')
      qc.invalidateQueries({ queryKey: ['principal', 'terms'] })
      qc.invalidateQueries({ queryKey: ['principal', 'sessions'] })
      qc.invalidateQueries({ queryKey: ['principal', 'sessions-list-min'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to activate term'),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each session has three terms. Activate one to set it as the current term for the school.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Select
            value={sessionId}
            onValueChange={(v) => setSelectedSessionId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {(sessionsData?.sessions ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.isActive ? ' (active)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current term banner */}
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <span className="text-muted-foreground">Current: </span>
            <span className="font-semibold">
              {currentSessionId && sessionsData?.sessions.find((s) => s.id === currentSessionId)?.name}
              {currentTerm ? ` — ${currentTerm.name}` : ' — no term set'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            {session ? (
              <>
                Terms for <span className="text-muted-foreground font-normal">{session.name}</span>
              </>
            ) : (
              'Terms'
            )}
            <Badge variant="secondary">{terms.length}</Badge>
          </CardTitle>
          <CardDescription>
            Terms are auto-created when a session is created — they cannot be added or removed manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sessionId ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No session selected. Create a session first.
            </div>
          ) : isLoading || isFetching ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : terms.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No terms found for this session.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[60px]">Order</TableHead>
                    <TableHead className="min-w-[200px]">Term</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((t) => {
                    const isCurrent = t.id === currentTermId
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="tabular-nums">
                          <Badge variant="outline" className="font-mono">
                            {t.order}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {t.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          {t.isActive ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {isCurrent ? (
                              <Badge variant="outline" className="text-emerald-700">
                                Current term
                              </Badge>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={activateMutation.isPending}
                                  >
                                    <Zap className="h-3.5 w-3.5" />
                                    Set as current
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Activate {t.name}?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {isCurrentSession
                                        ? ''
                                        : `This will also activate the session "${session?.name}" as the current session. `}
                                      The current term will be set to <strong>{t.name}</strong> for the whole school.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => activateMutation.mutate(t.id)}
                                    >
                                      Activate
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
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
    </div>
  )
}
