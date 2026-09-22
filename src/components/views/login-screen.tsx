'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { GraduationCap, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      <main className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg mb-4 ring-4 ring-emerald-100">
              <GraduationCap className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">RESCO eCard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Redeemer&apos;s Schools and College, Owotoro
            </p>
            <p className="text-xs text-muted-foreground/80 italic mt-1">
              Excellence, Knowledge, and Wisdom
            </p>
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

          <p className="text-center text-[11px] text-muted-foreground mt-4">
            © {new Date().getFullYear()} Redeemer&apos;s Schools and College. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  )
}
