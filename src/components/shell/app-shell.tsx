'use client'
import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { LoginScreen } from '@/components/views/login-screen'
import { PrincipalShell } from '@/components/shell/principal-shell'
import { TeacherShell } from '@/components/shell/teacher-shell'
import { Loader2 } from 'lucide-react'
import { SchoolLogo } from '@/components/shell/school-logo'

export function AppShell() {
  const user = useAppStore((s) => s.user)
  const loadingAuth = useAppStore((s) => s.loadingAuth)
  const setUser = useAppStore((s) => s.setUser)
  const setLoadingAuth = useAppStore((s) => s.setLoadingAuth)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{ user: any | null }>('/api/auth/me')
        if (!cancelled) setUser(res.user ?? null)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoadingAuth(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setUser, setLoadingAuth])

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <SchoolLogo className="h-14 w-14" />
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading RESCO eCard...
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  if (user.role === 'PRINCIPAL') return <PrincipalShell />
  return <TeacherShell />
}
