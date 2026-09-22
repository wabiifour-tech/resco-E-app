'use client'
import { useMemo, useRef, useState } from 'react'
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
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, ApiError } from '@/lib/api-client'
import {
  Save,
  Upload,
  Trash2,
  School,
  Image as ImageIcon,
  CalendarDays,
  PenLine,
} from 'lucide-react'

type SchoolSettings = {
  id: string
  schoolName: string
  address: string
  phone: string | null
  motto: string
  logoDataUrl: string | null
  principalName: string | null
  principalSignatureDataUrl: string | null
  currentSessionId: string | null
  currentTermId: string | null
}

type Term = { id: string; name: string; sessionId: string; order: number }
type Session = { id: string; name: string; terms: Term[] }

type SettingsResponse = {
  settings: SchoolSettings
  currentTerm: { id: string; name: string; sessionId: string; order: number } | null
  sessions: Session[]
}

const MAX_FILE_BYTES = 1024 * 1024 // 1MB raw file
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

export function PrincipalSettings() {
  const qc = useQueryClient()
  const { data, dataUpdatedAt, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsResponse>('/api/settings'),
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">School Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure identity, branding, and the active academic session. These values appear on every generated report card.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading settings…</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load settings: {(error as Error).message}
          </CardContent>
        </Card>
      ) : data ? (
        <SettingsForm key={dataUpdatedAt} initial={data} invalidate={() => qc.invalidateQueries({ queryKey: ['settings'] })} />
      ) : null}
    </div>
  )
}

function SettingsForm({
  initial,
  invalidate,
}: {
  initial: SettingsResponse
  invalidate: () => void
}) {
  const qc = useQueryClient()
  const { settings, currentTerm, sessions } = initial

  // Identity form state, initialised once per mount from server data.
  const [form, setForm] = useState({
    schoolName: settings.schoolName ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    motto: settings.motto ?? '',
    principalName: settings.principalName ?? '',
  })
  // Pending image data URLs (string = new image to send, '' = cleared)
  const [logoPending, setLogoPending] = useState<string | null>(null)
  const [sigPending, setSigPending] = useState<string | null>(null)
  const [logoErr, setLogoErr] = useState<string | null>(null)
  const [sigErr, setSigErr] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string>(settings.currentSessionId ?? '')
  const [termId, setTermId] = useState<string>(settings.currentTermId ?? '')

  const saveIdentityMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.put<{ settings: SchoolSettings }>('/api/settings', body),
    onSuccess: () => {
      toast.success('School settings saved')
      invalidate()
    },
    onError: (e: ApiError) => toast.error(e.message),
  })

  const saveSessionMutation = useMutation({
    mutationFn: (body: { currentSessionId: string | null; currentTermId: string | null }) =>
      api.put<{ settings: SchoolSettings; currentTerm: Term | null }>('/api/settings', body),
    onSuccess: () => {
      toast.success('Current academic session and term updated')
      invalidate()
      qc.invalidateQueries({ queryKey: ['active-session-term'] })
    },
    onError: (e: ApiError) => toast.error(e.message),
  })

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId],
  )
  const availableTerms = currentSession?.terms ?? []

  function handleFile(
    file: File | undefined,
    setter: (url: string | null) => void,
    errSetter: (s: string | null) => void,
    label: string,
  ) {
    errSetter(null)
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      errSetter(`${label}: must be PNG, JPEG, SVG, or WebP`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      errSetter(`${label}: file too large (max 1MB)`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') setter(result)
      else errSetter(`${label}: failed to read file`)
    }
    reader.onerror = () => errSetter(`${label}: failed to read file`)
    reader.readAsDataURL(file)
  }

  function saveIdentity() {
    if (!form.schoolName.trim()) {
      toast.error('School name is required')
      return
    }
    saveIdentityMutation.mutate({
      schoolName: form.schoolName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      motto: form.motto.trim(),
      principalName: form.principalName.trim(),
      ...(logoPending !== null ? { logoDataUrl: logoPending } : {}),
      ...(sigPending !== null ? { principalSignatureDataUrl: sigPending } : {}),
    })
  }

  function saveSessionTerm() {
    if (!sessionId) {
      toast.error('Please select an academic session')
      return
    }
    saveSessionMutation.mutate({
      currentSessionId: sessionId,
      currentTermId: termId || null,
    })
  }

  // Display values: pending (if any) override stored
  const logoSrc = logoPending !== null ? (logoPending === '' ? null : logoPending) : settings.logoDataUrl
  const sigSrc =
    sigPending !== null ? (sigPending === '' ? null : sigPending) : settings.principalSignatureDataUrl

  return (
    <>
      {/* Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">School Identity</CardTitle>
              <CardDescription className="text-xs">
                Basic details displayed on the report-card header.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="school-name">School Name</Label>
            <Input
              id="school-name"
              value={form.schoolName}
              onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
              placeholder="Redeemer's Schools and College"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="school-address">Address</Label>
            <Textarea
              id="school-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Owotoro, Oyo State, Nigeria"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school-phone">Phone</Label>
            <Input
              id="school-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school-motto">Motto</Label>
            <Input
              id="school-motto"
              value={form.motto}
              onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))}
              placeholder="Excellence, Knowledge, and Wisdom"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="principal-name">Principal Name</Label>
            <Input
              id="principal-name"
              value={form.principalName}
              onChange={(e) => setForm((f) => ({ ...f, principalName: e.target.value }))}
              placeholder="e.g. Mr. B. Adeyemi"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo & Signature */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Logo &amp; Principal Signature</CardTitle>
              <CardDescription className="text-xs">
                PNG, JPEG, SVG, or WebP. Max 1MB each. Stored in-app — no external uploads.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <ImageUpload
            title="School Logo"
            src={logoSrc}
            pending={logoPending !== null && logoPending !== ''}
            error={logoErr}
            onFile={(f) => handleFile(f, setLogoPending, setLogoErr, 'Logo')}
            onClear={() => setLogoPending('')}
            aspect="aspect-square"
          />
          <ImageUpload
            title="Principal Signature"
            src={sigSrc}
            pending={sigPending !== null && sigPending !== ''}
            error={sigErr}
            onFile={(f) => handleFile(f, setSigPending, setSigErr, 'Signature')}
            onClear={() => setSigPending('')}
            aspect="aspect-[3/1]"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveIdentity} disabled={saveIdentityMutation.isPending}>
          <Save className="h-4 w-4" />
          Save Identity &amp; Branding
        </Button>
      </div>

      <Separator />

      {/* Current session / term */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Current Academic Session &amp; Term</CardTitle>
              <CardDescription className="text-xs">
                Selecting here drives which session/term teachers enter results against by default.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Active Session: {currentSession?.name ?? '—'}
            </Badge>
            <Badge variant="outline">
              Active Term: {currentTerm?.name ?? '—'}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-select">Academic Session</Label>
              <Select
                value={sessionId}
                onValueChange={(v) => {
                  setSessionId(v)
                  setTermId('') // reset term when session changes
                }}
              >
                <SelectTrigger id="session-select" className="w-full">
                  <SelectValue placeholder="Select academic session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No sessions available
                    </SelectItem>
                  ) : (
                    sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-select">Term</Label>
              <Select
                value={termId}
                onValueChange={setTermId}
                disabled={!currentSession}
              >
                <SelectTrigger id="term-select" className="w-full">
                  <SelectValue placeholder={currentSession ? 'Select term' : 'Pick a session first'} />
                </SelectTrigger>
                <SelectContent>
                  {availableTerms.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No terms for this session
                    </SelectItem>
                  ) : (
                    availableTerms.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSessionTerm} disabled={saveSessionMutation.isPending}>
              <Save className="h-4 w-4" />
              Save Current Session/Term
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function ImageUpload({
  title,
  src,
  pending,
  error,
  onFile,
  onClear,
  aspect,
}: {
  title: string
  src: string | null
  pending: boolean
  error: string | null
  onFile: (f: File | undefined) => void
  onClear: () => void
  aspect: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        {src && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
      <div
        className={`relative ${aspect} w-full rounded-md border border-dashed bg-muted/30 flex items-center justify-center overflow-hidden`}
      >
        {src ? (
          <img src={src} alt={title} className="h-full w-full object-contain" />
        ) : (
          <div className="text-center text-xs text-muted-foreground p-4">
            <PenLine className="h-5 w-5 mx-auto mb-1" />
            No image set
          </div>
        )}
        {pending && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="text-[10px]">
              Pending save
            </Badge>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? undefined)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {src ? 'Replace' : 'Upload'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
