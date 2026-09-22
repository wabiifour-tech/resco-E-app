'use client'
import { useState, useMemo } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  ClipboardList,
  Save,
  Search,
  X,
  GraduationCap,
  Users,
  BookOpen,
} from 'lucide-react'

// RESCO eCard — Principal Teacher Assignments view.
//
// The principal can configure a teacher's ENTIRE assignment set in one workflow:
//   1. Select teacher
//   2. Tick classes they teach
//   3. For each checked class: tick offered subjects + optionally class-teacher flag
//   4. Save → POST /api/assignments/bulk (idempotent "add these")
//
// Below the form: a grouped display of all current assignments (by teacher or by
// class) with per-subject remove (DELETE /api/assignments/[id]) and a
// class-teacher toggle (POST/DELETE /api/class-teachers).

type Assignment = {
  id: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  classId: string
  className: string
  classLevel: number
  isClassTeacher: boolean
  subjectId: string
  subjectName: string
  subjectCode: string | null
  createdAt: string
}

type ClassTeacher = {
  id: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  classId: string
  className: string
  classLevel: number
  createdAt: string
}

type TeacherOption = { id: string; name: string; email: string }
type ClassOption = {
  id: string
  name: string
  level: number
  category: string | null
}
type SubjectOption = { id: string; name: string; code: string | null }
type Options = {
  teachers: TeacherOption[]
  classes: ClassOption[]
  subjects: SubjectOption[]
  classSubjects: Record<string, string[]>
}

type ClassSelection = {
  classTeacher: boolean
  subjectIds: Set<string>
}

function toggleInSet<T>(set: Set<T>, value: T, on: boolean): Set<T> {
  const next = new Set(set)
  if (on) next.add(value)
  else next.delete(value)
  return next
}

type BulkResponse = {
  ok: boolean
  teacherId: string
  createdAssignments: number
  skippedAssignments: number
  createdClassTeacher: number
  skippedClassTeacher: number
}

type TeacherGroup = {
  teacherId: string
  teacherName: string
  teacherEmail: string
  classes: ClassGroupForTeacher[]
}

type ClassGroupForTeacher = {
  classId: string
  className: string
  classLevel: number
  isClassTeacher: boolean
  classTeacherRowId?: string
  subjects: { id: string; name: string; code: string | null }[]
}

type ClassGroup = {
  classId: string
  className: string
  classLevel: number
  teachers: {
    teacherId: string
    teacherName: string
    teacherEmail: string
    isClassTeacher: boolean
    classTeacherRowId?: string
    subjects: { id: string; name: string; code: string | null }[]
  }[]
}

export function PrincipalAssignments() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'by-teacher' | 'by-class'>(
    'by-teacher',
  )
  // Bulk form state
  const [teacherId, setTeacherId] = useState('')
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set())
  const [perClass, setPerClass] = useState<Record<string, ClassSelection>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: () =>
      api.get<{ assignments: Assignment[]; classTeachers: ClassTeacher[] }>(
        '/api/assignments',
      ),
  })

  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ['assignments-options'],
    queryFn: () => api.get<Options>('/api/assignments/options'),
  })

  const assignments = data?.assignments ?? []
  const classTeachers = data?.classTeachers ?? []

  // Lookup of subject master list (for the bulk form's offered-subject chips)
  const subjectMap = useMemo(() => {
    const m = new Map<string, SubjectOption>()
    for (const s of options?.subjects ?? []) m.set(s.id, s)
    return m
  }, [options?.subjects])

  // Sorted classes (level → name) for the form's checkbox grid
  const sortedClasses = useMemo(() => {
    const list = options?.classes ?? []
    return [...list].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level
      return a.name.localeCompare(b.name)
    })
  }, [options?.classes])

  // Classes grouped by category for the form (for visual order)
  const classesByCategory = useMemo(() => {
    const m = new Map<string, ClassOption[]>()
    for (const c of sortedClasses) {
      const key = c.category ?? 'Other'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(c)
    }
    return Array.from(m.entries())
  }, [sortedClasses])

  // ---- Bulk form handlers ----
  function toggleClass(id: string, on: boolean) {
    setSelectedClasses((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleClassTeacher(classId: string, on: boolean) {
    setPerClass((prev) => ({
      ...prev,
      [classId]: {
        classTeacher: on,
        subjectIds: prev[classId]?.subjectIds ?? new Set<string>(),
      },
    }))
  }

  function toggleSubject(classId: string, subjectId: string, on: boolean) {
    setPerClass((prev) => {
      const cur = prev[classId] ?? {
        classTeacher: false,
        subjectIds: new Set<string>(),
      }
      return {
        ...prev,
        [classId]: { ...cur, subjectIds: toggleInSet(cur.subjectIds, subjectId, on) },
      }
    })
  }

  function selectAllClass(classId: string) {
    const offered = options?.classSubjects[classId] ?? []
    setPerClass((prev) => {
      const cur = prev[classId] ?? {
        classTeacher: false,
        subjectIds: new Set<string>(),
      }
      return { ...prev, [classId]: { ...cur, subjectIds: new Set(offered) } }
    })
  }

  function clearClass(classId: string) {
    setPerClass((prev) => {
      const cur = prev[classId] ?? {
        classTeacher: false,
        subjectIds: new Set<string>(),
      }
      return { ...prev, [classId]: { ...cur, subjectIds: new Set<string>() } }
    })
  }

  function offeredSubjectsFor(classId: string): SubjectOption[] {
    const offered = options?.classSubjects[classId] ?? []
    return offered
      .map((sid) => subjectMap.get(sid))
      .filter((s): s is SubjectOption => !!s)
  }

  const selectedClassesList = sortedClasses.filter((c) =>
    selectedClasses.has(c.id),
  )
  const bulkValid =
    !!teacherId &&
    selectedClassesList.some(
      (c) => (perClass[c.id]?.subjectIds.size ?? 0) > 0 || perClass[c.id]?.classTeacher,
    )

  // ---- Mutations ----
  const bulkMutation = useMutation({
    mutationFn: () => {
      if (!teacherId) throw new Error('Please select a teacher.')
      const entries = Array.from(selectedClasses).map((classId) => ({
        classId,
        subjectIds: Array.from(perClass[classId]?.subjectIds ?? new Set<string>()),
        classTeacher: perClass[classId]?.classTeacher ?? false,
      }))
      const valid = entries.filter(
        (e) => e.subjectIds.length > 0 || e.classTeacher,
      )
      if (valid.length === 0)
        throw new Error('Select at least one subject or class-teacher flag.')
      return api.post<BulkResponse>('/api/assignments/bulk', {
        teacherId,
        entries: valid,
      })
    },
    onSuccess: (res) => {
      toast.success(
        `Saved — ${res.createdAssignments} assignment${
          res.createdAssignments === 1 ? '' : 's'
        } created (${res.skippedAssignments} skipped), ${res.createdClassTeacher} class-teacher set`,
      )
      setPerClass({})
      setSelectedClasses(new Set())
      qc.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: (e: { message?: string }) =>
      toast.error(e?.message ?? 'Failed to save assignments'),
  })

  const delMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assignments/${id}`),
    onSuccess: () => {
      toast.success('Assignment removed')
      qc.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: (e: { message?: string }) =>
      toast.error(e?.message ?? 'Failed to remove assignment'),
  })

  const makeClassTeacherMutation = useMutation({
    mutationFn: ({
      teacherId,
      classId,
    }: {
      teacherId: string
      classId: string
    }) => api.post('/api/class-teachers', { teacherId, classId }),
    onSuccess: () => {
      toast.success('Class teacher set')
      qc.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: (e: { message?: string }) =>
      toast.error(e?.message ?? 'Failed to set class teacher'),
  })

  const removeClassTeacherMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/class-teachers/${id}`),
    onSuccess: () => {
      toast.success('Class teacher removed')
      qc.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: (e: { message?: string }) =>
      toast.error(e?.message ?? 'Failed to remove class teacher'),
  })

  // ---- Grouped display: by-teacher ----
  const groupedByTeacher = useMemo<TeacherGroup[]>(() => {
    const map = new Map<string, TeacherGroup>()
    const perTeacherClassMap = new Map<string, Map<string, ClassGroupForTeacher>>()

    function ensure(teacherId: string, teacherName: string, teacherEmail: string) {
      if (!map.has(teacherId)) {
        map.set(teacherId, { teacherId, teacherName, teacherEmail, classes: [] })
        perTeacherClassMap.set(teacherId, new Map())
      }
      return map.get(teacherId)!
    }
    function ensureClass(
      group: TeacherGroup,
      classId: string,
      className: string,
      classLevel: number,
    ) {
      const inner = perTeacherClassMap.get(group.teacherId)!
      if (!inner.has(classId)) {
        const cg: ClassGroupForTeacher = {
          classId,
          className,
          classLevel,
          isClassTeacher: false,
          subjects: [],
        }
        inner.set(classId, cg)
        group.classes.push(cg)
      }
      return inner.get(classId)!
    }

    for (const a of assignments) {
      const g = ensure(a.teacherId, a.teacherName, a.teacherEmail)
      const cg = ensureClass(g, a.classId, a.className, a.classLevel)
      if (a.isClassTeacher) cg.isClassTeacher = true
      cg.subjects.push({
        id: a.subjectId,
        name: a.subjectName,
        code: a.subjectCode,
      })
    }
    // From class-teachers (a teacher may be class teacher of a class even without
    // any subject assignments there — we still need to show that class).
    for (const ct of classTeachers) {
      const g = ensure(ct.teacherId, ct.teacherName, ct.teacherEmail)
      const cg = ensureClass(g, ct.classId, ct.className, ct.classLevel)
      cg.isClassTeacher = true
      cg.classTeacherRowId = ct.id
    }
    // Also stamp classTeacherRowId onto classes that already came from assignments
    // (they had isClassTeacher=true from the assignment row, but not the row id).
    for (const ct of classTeachers) {
      const g = map.get(ct.teacherId)
      if (!g) continue
      const cg = perTeacherClassMap.get(ct.teacherId)?.get(ct.classId)
      if (cg) cg.classTeacherRowId = ct.id
    }
    const list = Array.from(map.values())
    list.sort((a, b) => a.teacherName.localeCompare(b.teacherName))
    for (const g of list) {
      g.classes.sort(
        (a, b) =>
          a.classLevel - b.classLevel || a.className.localeCompare(b.className),
      )
      for (const c of g.classes)
        c.subjects.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [assignments, classTeachers])

  // ---- Grouped display: by-class ----
  const groupedByClass = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, ClassGroup>()
    const perClassTeacherMap = new Map<
      string,
      Map<string, ClassGroup['teachers'][number]>
    >()

    function ensureClass(
      classId: string,
      className: string,
      classLevel: number,
    ) {
      if (!map.has(classId)) {
        map.set(classId, { classId, className, classLevel, teachers: [] })
        perClassTeacherMap.set(classId, new Map())
      }
      return map.get(classId)!
    }
    function ensureTeacher(
      cg: ClassGroup,
      teacherId: string,
      teacherName: string,
      teacherEmail: string,
    ) {
      const inner = perClassTeacherMap.get(cg.classId)!
      if (!inner.has(teacherId)) {
        const t: ClassGroup['teachers'][number] = {
          teacherId,
          teacherName,
          teacherEmail,
          isClassTeacher: false,
          subjects: [],
        }
        inner.set(teacherId, t)
        cg.teachers.push(t)
      }
      return inner.get(teacherId)!
    }

    for (const a of assignments) {
      const cg = ensureClass(a.classId, a.className, a.classLevel)
      const t = ensureTeacher(cg, a.teacherId, a.teacherName, a.teacherEmail)
      if (a.isClassTeacher) t.isClassTeacher = true
      t.subjects.push({
        id: a.subjectId,
        name: a.subjectName,
        code: a.subjectCode,
      })
    }
    for (const ct of classTeachers) {
      const cg = ensureClass(ct.classId, ct.className, ct.classLevel)
      const t = ensureTeacher(cg, ct.teacherId, ct.teacherName, ct.teacherEmail)
      t.isClassTeacher = true
      t.classTeacherRowId = ct.id
    }
    const list = Array.from(map.values())
    list.sort(
      (a, b) =>
        a.classLevel - b.classLevel || a.className.localeCompare(b.className),
    )
    for (const g of list) {
      g.teachers.sort((a, b) => a.teacherName.localeCompare(b.teacherName))
      for (const t of g.teachers)
        t.subjects.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [assignments, classTeachers])

  // ---- Search filter ----
  const q = search.trim().toLowerCase()
  function teacherMatches(group: TeacherGroup) {
    if (!q) return true
    if (group.teacherName.toLowerCase().includes(q)) return true
    return group.classes.some((c) => c.className.toLowerCase().includes(q))
  }
  function classMatches(group: ClassGroup) {
    if (!q) return true
    if (group.className.toLowerCase().includes(q)) return true
    return group.teachers.some((t) => t.teacherName.toLowerCase().includes(q))
  }
  function textMatches(haystack: string) {
    return !q || haystack.toLowerCase().includes(q)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teacher Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure each teacher&apos;s classes, subjects, and class-teacher
          responsibilities in one workflow.
        </p>
      </div>

      {/* Section 1 — Add / Update Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Add / Update Assignments
          </CardTitle>
          <CardDescription>
            Pick a teacher, the classes they teach, the subjects they cover in
            each class, and whether they serve as class teacher.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Select teacher */}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-teacher">Select Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger id="bulk-teacher" className="w-full sm:max-w-sm">
                <SelectValue placeholder="Choose a teacher" />
              </SelectTrigger>
              <SelectContent>
                {(options?.teachers ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.email ? ` (${t.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select classes */}
          {teacherId && (
            <div className="space-y-2">
              <Label>Select Classes</Label>
              {optionsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : sortedClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No classes configured yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {classesByCategory.map(([cat, list]) => (
                    <div key={cat} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {cat}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((c) => {
                          const checked = selectedClasses.has(c.id)
                          return (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent min-h-[44px]"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  toggleClass(c.id, !!v)
                                }
                              />
                              <span className="font-medium">{c.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Per-class sub-panels */}
          {teacherId && selectedClassesList.length > 0 && (
            <div className="space-y-4">
              <Label>Subjects &amp; Class-Teacher Role</Label>
              {selectedClassesList.map((c) => {
                const offered = offeredSubjectsFor(c.id)
                const sel = perClass[c.id]
                const classTeacher = sel?.classTeacher ?? false
                const selectedCount = sel?.subjectIds.size ?? 0
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="font-medium">{c.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {c.category ?? '—'}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border px-3 py-1.5 hover:bg-accent min-h-[44px]">
                        <Checkbox
                          checked={classTeacher}
                          onCheckedChange={(v) =>
                            toggleClassTeacher(c.id, !!v)
                          }
                        />
                        <span>Class Teacher</span>
                      </label>
                    </div>
                    <Separator />
                    {offered.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No subjects offered for this class yet — configure them
                        in Subject Management.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {selectedCount} of {offered.length} subject
                            {offered.length === 1 ? '' : 's'} selected
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => selectAllClass(c.id)}
                            >
                              Select all
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => clearClass(c.id)}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {offered.map((s) => {
                            const checked =
                              sel?.subjectIds.has(s.id) ?? false
                            return (
                              <label
                                key={s.id}
                                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer hover:bg-accent min-h-[40px] ${
                                  checked ? 'border-primary' : ''
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    toggleSubject(c.id, s.id, !!v)
                                  }
                                />
                                <span>{s.name}</span>
                                {s.code && (
                                  <span className="text-xs text-muted-foreground">
                                    ({s.code})
                                  </span>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 4: Save */}
          {teacherId && selectedClassesList.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
              <Button
                onClick={() => bulkMutation.mutate()}
                disabled={bulkMutation.isPending || !bulkValid}
              >
                <Save className="h-4 w-4" />
                {bulkMutation.isPending ? 'Saving…' : 'Save Assignments'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — Current Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Current Assignments
            <Badge variant="secondary">{assignments.length}</Badge>
          </CardTitle>
          <CardDescription>
            Existing teacher–class–subject assignments. Use the per-subject X
            to remove, and the class-teacher toggle to set or clear class-teacher
            responsibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by teacher or class…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                aria-label="Search assignments"
              />
            </div>
            <Tabs
              value={viewMode}
              onValueChange={(v) =>
                setViewMode(v as 'by-teacher' | 'by-class')
              }
            >
              <TabsList>
                <TabsTrigger value="by-teacher">By Teacher</TabsTrigger>
                <TabsTrigger value="by-class">By Class</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : viewMode === 'by-teacher' ? (
            groupedByTeacher.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {q
                  ? 'No assignments match your search.'
                  : "No assignments yet. Use the form above to add a teacher's assignments."}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByTeacher
                  .filter(teacherMatches)
                  .map((g) => {
                    const filteredClasses = g.classes.filter(
                      (c) =>
                        !q ||
                        c.className.toLowerCase().includes(q) ||
                        g.teacherName.toLowerCase().includes(q),
                    )
                    if (filteredClasses.length === 0) return null
                    return (
                      <div
                        key={g.teacherId}
                        className="rounded-lg border p-4 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                            {g.teacherName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {g.teacherName}
                            </p>
                            {g.teacherEmail && (
                              <p className="text-xs text-muted-foreground truncate">
                                {g.teacherEmail}
                              </p>
                            )}
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          {filteredClasses.map((c) => (
                            <div
                              key={c.classId}
                              className="rounded-md border p-3 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">
                                    {c.className}
                                  </span>
                                  {c.isClassTeacher && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800">
                                      <GraduationCap className="h-3 w-3 mr-1" />
                                      Class Teacher
                                    </Badge>
                                  )}
                                </div>
                                {c.isClassTeacher && c.classTeacherRowId ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      removeClassTeacherMutation.mutate(
                                        c.classTeacherRowId!,
                                      )
                                    }
                                    disabled={
                                      removeClassTeacherMutation.isPending
                                    }
                                  >
                                    Remove as class teacher
                                  </Button>
                                ) : !c.isClassTeacher ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      makeClassTeacherMutation.mutate({
                                        teacherId: g.teacherId,
                                        classId: c.classId,
                                      })
                                    }
                                    disabled={makeClassTeacherMutation.isPending}
                                  >
                                    Make class teacher
                                  </Button>
                                ) : null}
                              </div>
                              {c.subjects.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                  No subjects assigned in this class.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {c.subjects.map((s) => {
                                    const a = assignments.find(
                                      (x) =>
                                        x.teacherId === g.teacherId &&
                                        x.classId === c.classId &&
                                        x.subjectId === s.id,
                                    )
                                    return (
                                      <Badge
                                        key={s.id}
                                        variant="secondary"
                                        className="gap-1 pl-2 pr-1 py-1"
                                      >
                                        <span>{s.name}</span>
                                        <button
                                          type="button"
                                          onClick={() => a && delMutation.mutate(a.id)}
                                          disabled={delMutation.isPending}
                                          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                          aria-label={`Remove ${s.name} assignment`}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )
          ) : // by-class
          groupedByClass.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {q ? 'No assignments match your search.' : 'No assignments yet.'}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByClass
                .filter(classMatches)
                .map((g) => {
                  const filteredTeachers = g.teachers.filter(
                    (t) =>
                      !q ||
                      t.teacherName.toLowerCase().includes(q) ||
                      g.className.toLowerCase().includes(q),
                  )
                  if (filteredTeachers.length === 0) return null
                  return (
                    <div
                      key={g.classId}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{g.className}</span>
                        <Badge variant="secondary">
                          {g.teachers.length} teacher
                          {g.teachers.length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        {filteredTeachers.map((t) => (
                          <div
                            key={`${g.classId}-${t.teacherId}`}
                            className="rounded-md border p-3 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                                  {t.teacherName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">
                                  {t.teacherName}
                                </span>
                                {t.isClassTeacher && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800">
                                    <GraduationCap className="h-3 w-3 mr-1" />
                                    Class Teacher
                                  </Badge>
                                )}
                              </div>
                              {t.isClassTeacher && t.classTeacherRowId ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    removeClassTeacherMutation.mutate(
                                      t.classTeacherRowId!,
                                    )
                                  }
                                  disabled={removeClassTeacherMutation.isPending}
                                >
                                  Remove as class teacher
                                </Button>
                              ) : !t.isClassTeacher ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    makeClassTeacherMutation.mutate({
                                      teacherId: t.teacherId,
                                      classId: g.classId,
                                    })
                                  }
                                  disabled={makeClassTeacherMutation.isPending}
                                >
                                  Make class teacher
                                </Button>
                              ) : null}
                            </div>
                            {t.subjects.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">
                                No subjects assigned in this class.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {t.subjects.map((s) => {
                                  const a = assignments.find(
                                    (x) =>
                                      x.teacherId === t.teacherId &&
                                      x.classId === g.classId &&
                                      x.subjectId === s.id,
                                  )
                                  return (
                                    <Badge
                                      key={s.id}
                                      variant="secondary"
                                      className="gap-1 pl-2 pr-1 py-1"
                                    >
                                      <span>{s.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => a && delMutation.mutate(a.id)}
                                        disabled={delMutation.isPending}
                                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                        aria-label={`Remove ${s.name} assignment`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
