'use client'
import { useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api, ApiError } from '@/lib/api-client'
import { Plus, Trash2, Save, RotateCcw, TriangleAlert } from 'lucide-react'
import { DEFAULT_GRADE_BOUNDARIES } from '@/lib/results'

type Boundary = { min: number; max: number; grade: string; order: number }

type Row = {
  id: string // local id only
  min: string
  max: string
  grade: string
  order: string
}

let _rowCounter = 0
function newRow(partial?: Partial<Row>): Row {
  _rowCounter += 1
  return {
    id: `local-${Date.now()}-${_rowCounter}`,
    min: '',
    max: '',
    grade: '',
    order: '',
    ...partial,
  }
}

function toRows(boundaries: Boundary[] | undefined): Row[] {
  if (!boundaries || boundaries.length === 0) return []
  return boundaries
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((b) => ({
      id: `srv-${b.min}-${b.max}`,
      min: String(b.min),
      max: String(b.max),
      grade: b.grade,
      order: String(b.order),
    }))
}

type GradingResponse = {
  items: { id: string; min: number; max: number; grade: string; order: number }[]
}

type SaveResponse = {
  ok: boolean
  items: Boundary[]
  warnings?: string[]
}

export function PrincipalGrading() {
  const qc = useQueryClient()
  const { data, dataUpdatedAt, isLoading } = useQuery<GradingResponse>({
    queryKey: ['grading'],
    queryFn: () => api.get<GradingResponse>('/api/grading'),
  })

  // serverWarnings live in the parent because they come from the save response
  const [serverWarnings, setServerWarnings] = useState<string[]>([])

  const saveMutation = useMutation({
    mutationFn: (body: Boundary[]) => api.put<SaveResponse>('/api/grading', { items: body }),
    onSuccess: (res) => {
      toast.success('Grading scale updated')
      setServerWarnings(res.warnings ?? [])
      qc.invalidateQueries({ queryKey: ['grading'] })
    },
    onError: (e: ApiError) => toast.error(e.message),
  })

  const initialRows = useMemo(() => toRows(data?.items), [data?.items])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grading Scale</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the grade boundaries used to convert term totals into letter grades. Boundaries should cover 0–100 without overlaps.
        </p>
      </div>

      <GradeBoundaryEditor
        key={dataUpdatedAt}
        initialRows={initialRows}
        isLoading={isLoading}
        serverWarnings={serverWarnings}
        onSave={(parsed) => saveMutation.mutate(parsed)}
        saving={saveMutation.isPending}
      />
    </div>
  )
}

function GradeBoundaryEditor({
  initialRows,
  isLoading,
  serverWarnings,
  onSave,
  saving,
}: {
  initialRows: Row[]
  isLoading: boolean
  serverWarnings: string[]
  onSave: (parsed: Boundary[]) => void
  saving: boolean
}) {
  // Initialise state from server rows once per mount. The parent remounts this
  // component (via `key`) when server data changes, so this stays clean.
  const [rows, setRows] = useState<Row[]>(initialRows)

  // Local validation + warnings computed from current rows
  const localWarnings = useMemo(() => {
    const w: string[] = []
    const parsed = rows
      .map((r, i) => {
        const min = Number(r.min)
        const max = Number(r.max)
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
          w.push(`Row ${i + 1}: min and max must be numbers`)
          return null
        }
        if (min < 0 || max > 100 || min > max) {
          w.push(`Row ${i + 1}: range must satisfy 0 ≤ min ≤ max ≤ 100`)
          return null
        }
        if (!r.grade.trim()) {
          w.push(`Row ${i + 1}: grade is required`)
          return null
        }
        return { min, max, grade: r.grade.trim(), order: Number(r.order) || i }
      })
      .filter((x): x is Boundary => x !== null)

    if (parsed.length === 0) {
      w.push('No valid rows yet')
      return { warnings: w, parsed: [] as Boundary[] }
    }

    const sorted = [...parsed].sort((a, b) => a.min - b.min)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      if (cur.min <= prev.max) {
        w.push(`Overlap: ${prev.grade} (${prev.min}-${prev.max}) and ${cur.grade} (${cur.min}-${cur.max})`)
      }
      if (cur.min > prev.max + 1) {
        w.push(`Gap between ${prev.grade} (max ${prev.max}) and ${cur.grade} (min ${cur.min})`)
      }
    }
    if (sorted[0].min > 0) w.push(`Scale does not start at 0 (starts at ${sorted[0].min})`)
    if (sorted[sorted.length - 1].max < 100) {
      w.push(`Scale does not reach 100 (ends at ${sorted[sorted.length - 1].max})`)
    }
    return { warnings: w, parsed }
  }, [rows])

  const canSave = rows.length > 0 && localWarnings.parsed.length === rows.length

  function updateRow(id: string, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }
  function addRow() {
    setRows((rs) => {
      const lastMax = rs.reduce((acc, r) => {
        const m = Number(r.max)
        return Number.isFinite(m) && m > acc ? m : acc
      }, -1)
      const nextMin = Math.max(0, lastMax + 1)
      const nextMax = Math.min(100, nextMin + 9)
      const nextOrder = String(rs.length)
      return [
        ...rs,
        newRow({
          min: String(nextMin),
          max: String(nextMax),
          grade: '',
          order: nextOrder,
        }),
      ]
    })
  }
  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id))
  }
  function resetToDefaults() {
    setRows(toRows(DEFAULT_GRADE_BOUNDARIES))
    toast.info('Reset to default boundaries — click Save to persist')
  }

  function handleSave() {
    if (!canSave) {
      toast.error('Please fix the validation errors before saving')
      return
    }
    onSave(localWarnings.parsed)
  }

  const allWarnings = [...localWarnings.warnings, ...serverWarnings]

  return (
    <>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">Rows: {rows.length}</Badge>
        <Badge variant={canSave ? 'default' : 'destructive'}>
          {canSave ? 'Valid' : 'Has errors'}
        </Badge>
        {allWarnings.length > 0 && (
          <Badge variant="outline">
            {allWarnings.length} warning{allWarnings.length === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base">Grade Boundaries</CardTitle>
              <CardDescription className="text-xs">
                Each row maps a total-score range to a grade. Order is preserved as-is.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                <RotateCcw className="h-4 w-4" />
                Reset to Default
              </Button>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
                <Save className="h-4 w-4" />
                Save Scale
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading grade boundaries…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Order</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        No grade boundaries. Click “Reset to Default” or “Add Row”.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, i) => {
                      const minNum = Number(r.min)
                      const maxNum = Number(r.max)
                      const validRange =
                        Number.isFinite(minNum) &&
                        Number.isFinite(maxNum) &&
                        minNum >= 0 &&
                        maxNum <= 100 &&
                        minNum <= maxNum
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              className="w-16 text-center"
                              value={r.order}
                              onChange={(e) => updateRow(r.id, 'order', e.target.value)}
                              aria-label={`Row ${i + 1} order`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="w-20"
                              value={r.grade}
                              maxLength={4}
                              onChange={(e) => updateRow(r.id, 'grade', e.target.value)}
                              aria-label={`Row ${i + 1} grade`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-20"
                              value={r.min}
                              onChange={(e) => updateRow(r.id, 'min', e.target.value)}
                              aria-label={`Row ${i + 1} min`}
                              aria-invalid={!validRange}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-20"
                              value={r.max}
                              onChange={(e) => updateRow(r.id, 'max', e.target.value)}
                              aria-label={`Row ${i + 1} max`}
                              aria-invalid={!validRange}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeRow(r.id)}
                              aria-label="Delete row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {allWarnings.length > 0 && (
        <Alert
          variant="default"
          className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700"
        >
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Validation warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
              {allWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="text-xs mt-2">
              You can still save the scale; ranges that don’t cover 0–100 or overlap will be applied as-is.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live Preview</CardTitle>
          <CardDescription className="text-xs">
            How a student’s term total maps to a grade with the current (unsaved or saved) scale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LivePreview rows={localWarnings.parsed} />
        </CardContent>
      </Card>
    </>
  )
}

function LivePreview({ rows }: { rows: Boundary[] }) {
  const samples = [0, 25, 39, 40, 49, 50, 59, 60, 69, 70, 79, 80, 100]
  function gradeFor(total: number): string {
    for (const r of rows) {
      if (total >= r.min && total <= r.max) return r.grade
    }
    return '—'
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Term Total</TableHead>
            <TableHead>Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((s) => (
            <TableRow key={s}>
              <TableCell className="font-mono">{s}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  {gradeFor(s)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
