'use client'
import { useState, type ReactNode } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { LogOut, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SchoolLogo } from '@/components/shell/school-logo'
import { InstallAppButton } from '@/components/pwa/install-app-button'

export type NavItem = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

function NavList({
  navItems,
  view,
  onNavigate,
  setView,
}: {
  navItems: NavItem[]
  view: string
  onNavigate?: () => void
  setView: (v: string) => void
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
      {navItems.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            setView(item.key)
            onNavigate?.()
          }}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors text-left',
            view === item.key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                view === item.key ? 'bg-primary-foreground/20' : 'bg-muted',
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  )
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4 border-b">
      <SchoolLogo className="h-9 w-9" />
      <div className="min-w-0">
        <p className="font-bold text-sm leading-tight truncate">RESCO eCard</p>
        <p className="text-[10px] text-muted-foreground leading-tight truncate">{subtitle}</p>
      </div>
    </div>
  )
}

function UserCard({ user, onLogout }: { user: any; onLogout: () => void }) {
  return (
    <div className="border-t px-3 py-3 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{user?.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-foreground"
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4 mr-2" /> Logout
      </Button>
    </div>
  )
}

export function ShellLayout({
  navItems,
  title,
  subtitle,
  children,
}: {
  navItems: NavItem[]
  title: string
  subtitle: string
  children: ReactNode
}) {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const logout = useAppStore((s) => s.logout)
  const user = useAppStore((s) => s.user)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-4 h-14">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Brand subtitle={subtitle} />
            <NavList
              navItems={navItems}
              view={view}
              setView={setView}
              onNavigate={() => setMobileOpen(false)}
            />
            <UserCard user={user} onLogout={logout} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <SchoolLogo className="h-7 w-7" />
          <span className="font-bold text-sm">{title}</span>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar min-h-[calc(100vh-3.5rem)] sticky top-0 self-start">
          <Brand subtitle={subtitle} />
          <NavList navItems={navItems} view={view} setView={setView} />
          <UserCard user={user} onLogout={logout} />
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">{children}</div>
          <footer className="mt-auto border-t bg-background py-3 px-4 text-center text-[11px] text-muted-foreground">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <SchoolLogo className="h-4 w-4" />
                RESCO eCard · Redeemer&apos;s Schools and College, Owotoro · Excellence, Knowledge, and Wisdom
              </span>
              <span className="hidden sm:inline text-border">·</span>
              <InstallAppButton variant="ghost" size="sm" className="h-6 text-[11px] px-2" label="Install app" />
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
