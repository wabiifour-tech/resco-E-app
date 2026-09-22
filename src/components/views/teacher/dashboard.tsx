'use client'

import { useQuery } from '@tanstack/react-query'
import {
  School,
  Layers,
  BookOpen,
  FileSpreadsheet,
  Send,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  ListChecks,
  GraduationCap,
  FileText,
  ArrowRight,
  Loader2,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'

// ─── Types ──────────────────────────────────────────────────────────────────

type Assignment = {
  classArmId: string
  classArmName: string
  subjectId: string
  subjectName: string
}

type TeacherDashboard = {
  teacher: { name: string; email: string }
  current: {
    sessionName: string | null
    termName: string | null
    sessionId: string | null
    termId: string | null
  }
  assignments: Assignment[]
  classArms: { id: string; fullName: string }[]
  subjects: { id: string; name: string }[]
  results: {
    saved: number
    submitted: number
    approved: number
    needsCorrection: number
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
  {
    view: 'results-entry',
    label: 'Enter Results',
    description: 'Record CA, exam & remarks',
    icon: ClipboardList,
  },
  {
    view: 'my-students',
    label: 'My Students',
    description: 'Browse students in your arms',
    icon: GraduationCap,
  },
  {
    view: 'report-cards',
    label: 'Report Cards',
    description: 'View student report cards',
    icon: FileText,
  },
]

// ─── Results status row ──────────────────────────────────────────────────────

function ResultsStatusRow({ data }: { data?: TeacherDashboard }) {
  const items = [
    {
      label: 'Saved (Drafts)',
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

export function TeacherDashboard() {
  const setView = useAppStore((s) => s.setView)
  const user = useAppStore((s) => s.user)

  const { data, isLoading } = useQuery<TeacherDashboard>({
    queryKey: ['dashboard', 'teacher'],
    queryFn: () => api.get<TeacherDashboard>('/api/dashboard/teacher'),
    staleTime: 30_000,
  })

  const sessionName = data?.current.sessionName
  const termName = data?.current.termName
  const hasActiveSession = Boolean(sessionName && termName)
  const hasAssignments = (data?.assignments.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Hello, {data?.teacher.name ?? user?.name ?? 'Teacher'} — pick up where you left off.
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
        </CardContent>
      </Card>

      {/* Workflow hint */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900">
                Result Entry Workflow
              </p>
              <p className="mt-1 text-sm text-emerald-800/80">
                Select Class &rarr; Select Subject &rarr; Enter Results (CA out of 30, Exam out of 70)
              </p>
            </div>
          </div>
          <Button
            onClick={() => setView('results-entry')}
            className="self-start sm:self-auto"
          >
            Enter Results
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Results summary */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            My Results Summary
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
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : hasAssignments ? (
          <ResultsStatusRow data={data} />
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                You have no class/subject assignments yet. Please contact the principal.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Assignments overview */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-muted-foreground" />
              My Class Arms
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.classArms.length ? (
              <ScrollArea className="max-h-64">
                <div className="flex flex-wrap gap-2 pr-2">
                  {data.classArms.map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="px-3 py-1 text-sm"
                    >
                      {c.fullName}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                No class arms assigned.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              My Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.subjects.length ? (
              <ScrollArea className="max-h-64">
                <div className="flex flex-wrap gap-2 pr-2">
                  {data.subjects.map((s) => (
                    <Badge
                      key={s.id}
                      variant="secondary"
                      className="px-3 py-1 text-sm"
                    >
                      {s.name}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">
                No subjects assigned.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Assignments detail (table-like) */}
      {data?.assignments.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Assignment Detail
              <Badge variant="outline" className="ml-1 font-normal">
                {data.assignments.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              <ul className="divide-y pr-2">
                {data.assignments.map((a, i) => (
                  <li
                    key={`${a.classArmId}-${a.subjectId}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{a.subjectName}</p>
                        <p className="text-xs text-muted-foreground">
                          Class arm: {a.classArmName}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setView('results-entry')}
                    >
                      Open
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {/* Quick links */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Quick Links</h2>
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
            Loading your dashboard…
          </>
        ) : (
          <>Results summary covers only the class/subject combos assigned to you.</>
        )}
      </p>
    </div>
  )
}
