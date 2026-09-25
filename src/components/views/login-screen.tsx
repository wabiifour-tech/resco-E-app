'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { InstallAppButton } from '@/components/pwa/install-app-button'

type Branding = {
  schoolName: string
  address: string
  motto: string
  logoUrl: string
  principalName: string | null
}

export function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch public school branding so the login page shows the real school logo
  // (instead of a generic placeholder) + the configured school name/motto.
  const { data: branding } = useQuery<Branding>({
    queryKey: ['branding'],
    queryFn: () => api.get<Branding>('/api/branding'),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    document.title = 'RESCO eCard | Login'
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<{ user: any }>('/api/auth/login', { email, password })
      setUser(res.user)
      toast.success(`Welcome back, ${res.user.name}`)
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Login failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const schoolName = branding?.schoolName ?? "Redeemer's Schools and College"
  const motto = branding?.motto ?? 'Excellence, Knowledge, and Wisdom'
  const logoUrl = branding?.logoUrl ?? '/school-logo.png'

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      <main className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-24 w-24 rounded-full bg-white shadow-lg mb-4 ring-4 ring-emerald-100 flex items-center justify-center overflow-hidden">
              <img
                src={logoUrl}
                alt={`${schoolName} logo`}
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">RESCO eCard</h1>
            <p className="text-sm text-muted-foreground mt-1">{schoolName}</p>
            <p className="text-xs text-muted-foreground/80 italic mt-1">{motto}</p>
          </div>

          <Card className="shadow-xl border-border/60">
            <CardHeader className="space-y-1 pb-2">
              <h2 className="text-xl font-semibold text-center">Sign in to your account</h2>
              <p className="text-xs text-center text-muted-foreground">
                Staff access only. Students do not have accounts.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@resco.edu.ng"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...
                    </>
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-0">
              <Separator />
              <p className="text-[11px] text-muted-foreground text-center flex items-center gap-1 justify-center">
                <ShieldCheck className="h-3 w-3" /> Passwords are securely hashed. Contact the
                principal to reset a forgotten password.
              </p>
            </CardFooter>
          </Card>

          <div className="flex flex-col items-center gap-2 mt-2">
            <p className="text-[11px] text-muted-foreground">Install RESCO eCard on your device</p>
            <InstallAppButton variant="outline" size="sm" label="Download App" />
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-4">
            © {new Date().getFullYear()} Redeemer&apos;s Schools and College. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  )
}
