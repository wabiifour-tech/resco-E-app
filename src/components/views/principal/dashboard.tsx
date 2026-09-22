'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users,
  GraduationCap,
  Layers,
  BookOpen,
  CalendarDays,
  ClipboardList,
  MessageSquareQuote,
  BarChart3,
  FileSpreadsheet,
  ClipboardCheck,
  FileText,
  ScrollText,
  Settings,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  School,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'

// ─── Types ──────────────────────────────────────────────────────────────────

type PrincipalDashboard = {
  counts: {
    teachers: number
    teachersActive: number
    students: number
    studentsActive: number
    classes: number
    subjects: number
  }
  current: {
    sessionName: string | null
    termName: string | null
    sessionId: string | null
    termId: string | null
  }
  results: {
    saved: number
    submitted: number
    approved: number
    needsCorrection: number
    total: number
  }
}

// ─── Quick links ────────────────────────────────────────────────────────────

type QuickLink = {
  view: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const QUICK_LINKS: QuickLink[] = [
  { view: 'teachers', label: 'Teachers', description: 'Manage staff accounts', icon: Users },
  { view: 'students', label: 'Students', description: 'Manage student records', icon: GraduationCap },
  { view: 'classes', label: 'Classes', description: 'Manage school classes', icon: Layers },
  { view: 'subjects', label: 'Subjects', description: 'Subject catalogue', icon: BookOpen },
  { view: 'sessions', label: 'Sessions & Terms', description: 'Academic sessions', icon: CalendarDays },
  { view: 'assignments', label: 'Assignments', description: 'Teacher → class/subject', icon: ClipboardList },
  { view: 'remarks', label: 'Remarks', description: 'Predefined remarks', icon: MessageSquareQuote },
  { view: 'grading', label: 'Grading', description: 'Grade boundaries', icon: BarChart3 },
  { view: 'results', label: 'Results', description: 'Browse all results', icon: FileSpreadsheet },
  { view: 'approvals', label: 'Approvals', description: 'Review submitted results', icon: ClipboardCheck },
  { view: 'report-cards', label: 'Report Cards', description: 'Generate report cards', icon: FileText },
  { view: 'audit', label: 'Audit Logs', description: 'Activity trail', icon: ScrollText },
  { view: 'settings', label: 'Settings', description: 'School settings', icon: Settings },
]

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'text-muted-foreground',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  sub?: string
  accent?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          {sub ? <p className={`mt-1 text-xs ${accent}`}>{sub}</p> : null}
        </div>
        <div className="rounded-lg bg-muted p-2.5 shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Results status row ──────────────────────────────────────────────────────

function ResultsStatusRow({
  data,
  isLoading,
}: {
  data?: PrincipalDashboard
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const items = [
    {
      label: 'Pending (Saved)',
      value: data?.results.saved ?? 0,
      icon: FileSpreadsheet,
      accent: 'bg-muted text-muted-foreground',
      dot: 'bg-slate-400',
    },
    {
      label: 'Submitted',
      value: data?.results.submitted ?? 0,
      icon: Send,
      accent: 'bg-amber-100 text-amber-700',
      dot: 'bg-amber-500',
    },
    {
      label: 'Approved',
      value: data?.results.approved ?? 0,
      icon: CheckCircle2,
      accent: 'bg-emerald-100 text-emerald-700',
      dot: 'bg-emerald-500',
    },
    {
      label: 'Needs Correction',
      value: data?.results.needsCorrection ?? 0,
      icon: AlertCircle,
      accent: 'bg-rose-100 text-rose-700',
      dot: 'bg-rose-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex flex-col gap-2 rounded-lg border bg-card p-4"
        >
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${it.accent}`}>
              <it.icon className="h-4 w-4" />
            </span>
            <span className={`h-2 w-2 rounded-full ${it.dot}`} aria-hidden />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight">{it.value}</p>
            <p className="text-xs text-muted-foreground">{it.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function PrincipalDashboard() {
  const setView = useAppStore((s) => s.setView)
  const user = useAppStore((s) => s.user)

  const { data, isLoading } = useQuery<PrincipalDashboard>({
    queryKey: ['dashboard', 'principal'],
    queryFn: () => api.get<PrincipalDashboard>('/api/dashboard/principal'),
    staleTime: 30_000,
  })

  const sessionName = data?.current.sessionName
  const termName = data?.current.termName
  const hasActiveSession = Boolean(sessionName && termName)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user?.name ?? 'Principal'} — here is your school overview.
        </p>
      </div>

      {/* Current session/term banner */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700">
              <School className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Current Academic Period
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-5 w-48" />
              ) : hasActiveSession ? (
                <p className="text-base font-semibold">
                  {sessionName} &middot; {termName}
                </p>
              ) : (
                <p className="text-base font-semibold text-amber-600">
                  No active session/term configured
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('settings')}
            className="self-start sm:self-auto"
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage in Settings
          </Button>
        </CardContent>
      </Card>

      {/* Entity counts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          School Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))
          ) : (
            <>
              <StatCard
                icon={Users}
                label="Teachers"
                value={data?.counts.teachers ?? 0}
                sub={`${data?.counts.teachersActive ?? 0} active`}
                accent="text-emerald-600"
              />
              <StatCard
                icon={GraduationCap}
                label="Students"
                value={data?.counts.students ?? 0}
                sub={`${data?.counts.studentsActive ?? 0} active`}
                accent="text-emerald-600"
              />
              <StatCard
                icon={Layers}
                label="Classes"
                value={data?.counts.classes ?? 0}
              />
              <StatCard
                icon={BookOpen}
                label="Subjects"
                value={data?.counts.subjects ?? 0}
              />
            </>
          )}
        </div>
      </section>

      {/* Results summary */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Results Summary
          </h2>
          {hasActiveSession ? (
            <Badge variant="secondary" className="font-normal">
              {sessionName} &middot; {termName}
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal text-amber-600">
              No active period
            </Badge>
          )}
        </div>
        <ResultsStatusRow data={data} isLoading={isLoading} />
      </section>

      {/* Quick links */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {QUICK_LINKS.map((q) => (
            <button
              key={q.view}
              type="button"
              onClick={() => setView(q.view)}
              className="group flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Open ${q.label}`}
            >
              <div className="rounded-lg bg-muted p-2.5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <q.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium leading-tight">{q.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {q.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {isLoading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading dashboard data…
          </>
        ) : (
          <>Data refreshed automatically. Counts reflect the current academic period.</>
        )}
      </p>
    </div>
  )
}
