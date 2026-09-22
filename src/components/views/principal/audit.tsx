'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  History,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCcw,
  Globe,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ApiError, api } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditItem = {
  id: string
  userId: string | null
  userName: string
  userRole: string
  action: string
  context: string | null // JSON string
  ipAddress: string | null
  createdAt: string
}

type AuditResponse = {
  items: AuditItem[]
  total: number
  page: number
  pageSize: number
  actions: string[]
  users: { id: string; name: string; role: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LAGOS_TIMEZONE = 'Africa/Lagos'

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: LAGOS_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return iso
  }
}

function formatDateInput(iso: string): string {
  // For <input type=date> — strip time portion only.
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function prettyContext(raw: string | null): string {
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function humanContext(raw: string | null): string {
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw)
    // Prefer the most readable fields from the audit context.
    const parts: string[] = []
    if (parsed.studentName) parts.push(`Student: ${parsed.studentName}`)
    if (parsed.subjectName) parts.push(`Subject: ${parsed.subjectName}`)
    if (parsed.className) parts.push(`Class: ${parsed.className}`)
    if (parsed.termName) parts.push(`Term: ${parsed.termName}`)
    if (parsed.sessionName) parts.push(`Session: ${parsed.sessionName}`)
    if (parsed.teacherName) parts.push(`Teacher: ${parsed.teacherName}`)
    if (parsed.email) parts.push(`Email: ${parsed.email}`)
    if (parsed.reason) parts.push(`Reason: "${parsed.reason}"`)
    if (parts.length > 0) return parts.join(' · ')
    // Fall back to JSON string for non-result audit logs.
    return JSON.stringify(parsed)
      .replace(/[{}"]/g, '')
      .replace(/,/g, ', ')
      .slice(0, 120)
  } catch {
    return raw.slice(0, 120)
  }
}

function actionBadgeClass(action: string): string {
  // Group similar audit events by colour family (no indigo/blue).
  if (action.startsWith('RESULT_APPROVED'))
    return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent'
  if (action.startsWith('RESULT_'))
    return 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent'
  if (
    action.startsWith('TEACHER_') ||
    action === 'PASSWORD_CHANGED'
  )
    return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-transparent'
  if (action.startsWith('STUDENT_'))
    return 'bg-amber-50 text-amber-700 hover:bg-amber-50 border-transparent'
  if (
    action.startsWith('CLASS_') ||
    action.startsWith('SUBJECT_') ||
    action.startsWith('SESSION_') ||
    action.startsWith('TERM_')
  )
    return 'bg-muted text-foreground hover:bg-muted border-transparent'
  if (action === 'LOGIN' || action === 'LOGOUT')
    return 'bg-foreground/5 text-foreground hover:bg-foreground/5 border-transparent'
  return ''
}

// ─── API helper ────────────────────────────────────────────────────────────────

async function fetchAudit(params: {
  action?: string
  userId?: string
  q?: string
  from?: string
  to?: string
  page: number
  pageSize: number
}): Promise<AuditResponse> {
  return api.get<AuditResponse>('/api/audit', {
    query: {
      action: params.action,
      userId: params.userId,
      q: params.q,
      from: params.from,
      to: params.to,
      page: params.page,
      pageSize: params.pageSize,
    },
  })
}

// ─── Expandable row ────────────────────────────────────────────────────────────

function AuditRow({ item }: { item: AuditItem }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <TableCell className="align-top whitespace-nowrap text-xs">
          <div className="flex items-center gap-1">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {formatTimestamp(item.createdAt)}
          </div>
        </TableCell>
        <TableCell className="align-top">
          <div className="font-medium">{item.userName}</div>
          <div className="text-xs text-muted-foreground">{item.userRole}</div>
        </TableCell>
        <TableCell className="align-top">
          <Badge className={actionBadgeClass(item.action)}>
            {item.action}
          </Badge>
        </TableCell>
        <TableCell className="align-top max-w-[420px]">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {humanContext(item.context)}
          </p>
        </TableCell>
        <TableCell className="align-top text-xs text-muted-foreground whitespace-nowrap">
          {item.ipAddress ?? '—'}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5}>
            <div className="py-2 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Full audit context
              </div>
              <pre className="text-xs bg-background border rounded-md p-3 overflow-x-auto max-h-80">
                {prettyContext(item.context)}
              </pre>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">ID:</span>{' '}
                  <code className="text-[10px]">{item.id}</code>
                </span>
                {item.userId && (
                  <span>
                    <span className="font-medium text-foreground">
                      User ID:
                    </span>{' '}
                    <code className="text-[10px]">{item.userId}</code>
                  </span>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Mobile card ────────────────────────────────────────────────────────────────

function AuditMobileCard({ item }: { item: AuditItem }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border bg-background"
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{item.userName}</p>
            <p className="text-xs text-muted-foreground">{item.userRole}</p>
          </div>
          <Badge className={actionBadgeClass(item.action)}>
            {item.action}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatTimestamp(item.createdAt)}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {humanContext(item.context)}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {item.ipAddress ?? '—'}
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9">
              {open ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Hide
                </>
              ) : (
                <>
                  <ChevronRight className="h-3.5 w-3.5" /> Details
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <div className="px-3 pb-3 border-t pt-3">
          <pre className="text-xs bg-muted/50 border rounded-md p-3 overflow-x-auto max-h-80">
            {prettyContext(item.context)}
          </pre>
          <div className="text-[10px] text-muted-foreground mt-2 break-all">
            ID: {item.id}
            {item.userId ? ` · User: ${item.userId}` : ''}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Main view ──────────────────────────────────────────────────────────────────

export function PrincipalAudit() {
  // Filter state
  const [action, setAction] = useState<string>('ALL')
  const [userId, setUserId] = useState<string>('ALL')
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  // Run query whenever filters/page change.
  const { data, isLoading, isFetching, error } = useQuery<AuditResponse>({
    queryKey: ['audit', action, userId, q, from, to, page, pageSize],
    queryFn: () =>
      fetchAudit({
        action: action !== 'ALL' ? action : undefined,
        userId: userId !== 'ALL' ? userId : undefined,
        q: q.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize,
      }),
    staleTime: 5_000,
  })

  // Surface fetch errors as toasts (non-blocking).
  useEffect(() => {
    if (error && error instanceof ApiError) {
      toast.error(error.message)
    }
  }, [error])

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const actions = data?.actions ?? []
  const users = data?.users ?? []

  // Whenever a filter changes (not page), reset to page 1. We do this in
  // the change handlers (not in a useEffect) to avoid cascading renders.
  function handleActionChange(v: string) {
    setAction(v)
    setPage(1)
  }
  function handleUserChange(v: string) {
    setUserId(v)
    setPage(1)
  }
  function handleFromChange(v: string) {
    setFrom(v)
    setPage(1)
  }
  function handleToChange(v: string) {
    setTo(v)
    setPage(1)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setQ(qInput.trim())
    setPage(1)
  }

  function handleReset() {
    setAction('ALL')
    setUserId('ALL')
    setQ('')
    setQInput('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every important action in RESCO eCard is recorded here — logins,
          result approvals, teacher & student changes, settings updates. Times
          shown in Africa/Lagos timezone.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="a-action" className="text-xs">
                Action
              </Label>
              <Select value={action} onValueChange={handleActionChange}>
                <SelectTrigger id="a-action" className="w-full min-h-[44px]">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All actions</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-user" className="text-xs">
                User
              </Label>
              <Select value={userId} onValueChange={handleUserChange}>
                <SelectTrigger id="a-user" className="w-full min-h-[44px]">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-from" className="text-xs">
                From
              </Label>
              <Input
                id="a-from"
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="min-h-[44px]"
                max={to || undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-to" className="text-xs">
                To
              </Label>
              <Input
                id="a-to"
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="min-h-[44px]"
                min={from || undefined}
              />
            </div>
          </form>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search context, user, or action…"
                className="pl-9 min-h-[44px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setQ(qInput.trim())
                  }
                }}
                aria-label="Search audit log"
              />
            </div>
            <Button type="button" onClick={handleSearchSubmit} className="min-h-[44px]">
              <Filter className="h-4 w-4" />
              Apply
            </Button>
            {(action !== 'ALL' ||
              userId !== 'ALL' ||
              q ||
              from ||
              to) && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="min-h-[44px]"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
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
              ) : total === 0 ? (
                'No audit entries match your filters'
              ) : (
                <>
                  Showing{' '}
                  <span className="font-medium text-foreground">
                    {showingFrom}–{showingTo}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-foreground">{total}</span>{' '}
                  entries
                </>
              )}
            </p>
            <Badge variant="outline" className="hidden sm:inline-flex">
              <History className="h-3 w-3" />
              Most recent first
            </Badge>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <History className="h-8 w-8" />
              <p className="text-sm">
                No audit entries match your filters. Try widening the date
                range or clearing the action/user filter.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Context</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <AuditRow key={it.id} item={it} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y p-3 space-y-2">
                {items.map((it) => (
                  <AuditMobileCard key={it.id} item={it} />
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {total > pageSize && (
            <div className="border-t p-3">
              <Pagination>
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (page > 1) setPage((p) => p - 1)
                      }}
                      aria-disabled={page === 1}
                      className={
                        page === 1
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm px-3 py-2">
                      Page {page} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (page < totalPages) setPage((p) => p + 1)
                      }}
                      aria-disabled={page === totalPages}
                      className={
                        page === totalPages
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
