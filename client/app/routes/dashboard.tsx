import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  RefreshCw,
  Settings,
  Smartphone,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Notice } from '../components/ui/notice'
import { fetchCurrentUser, fetchHealth, getApiBaseUrl, type UserResponse } from '../lib/api'
import { clearSession, getStoredUser, isLoggedIn, storeUser } from '../lib/auth'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
})

type NavPath =
  | '/dashboard'
  | '/dashboard/map'
  | '/dashboard/hazards'
  | '/dashboard/trips'
  | '/dashboard/devices'
  | '/dashboard/analysis'
  | '/dashboard/settings'

const navItems: { to: NavPath; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/map', label: 'Map', icon: MapIcon },
  { to: '/dashboard/hazards', label: 'Hazards', icon: AlertTriangle },
  { to: '/dashboard/trips', label: 'Trips', icon: Activity },
  { to: '/dashboard/devices', label: 'Devices', icon: Smartphone },
  { to: '/dashboard/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const HEALTH_POLL_MS = 30_000

function sectionTitle(pathname: string) {
  const match = [...navItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return match?.label ?? 'Overview'
}

function DashboardLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<UserResponse | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)

  // Session gate. A 401 anywhere is handled centrally in lib/api (clears the
  // session and returns to login), so network failures never log the user out.
  useEffect(() => {
    if (!isLoggedIn()) {
      void navigate({ to: '/login', replace: true })
      return
    }
    setUser(getStoredUser())
    setReady(true)
    fetchCurrentUser()
      .then((current) => {
        setUser(current)
        storeUser(current)
      })
      .catch(() => undefined)
  }, [navigate])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const check = () =>
      fetchHealth()
        .then(() => !cancelled && setOnline(true))
        .catch(() => !cancelled && setOnline(false))
    void check()
    const timer = setInterval(check, HEALTH_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [ready])

  function logout() {
    clearSession()
    void navigate({ to: '/login' })
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
            T
          </div>
          <p className="text-sm font-medium text-foreground">Checking session</p>
        </div>
      </div>
    )
  }

  const displayName = user?.full_name || user?.username || 'Operator'

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
          <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              T
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Tayenda</p>
              <p className="text-xs text-muted-foreground">Operator console</p>
            </div>
          </div>

          <nav className="space-y-0.5 p-2">
            {navItems.map((item) => (
              <SidebarItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
          </nav>

          <div className="mt-auto border-t border-sidebar-border p-3">
            <div className="mb-2 flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.role ?? 'operator'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground lg:hidden">
                T
              </div>
              <h1 className="text-base font-semibold text-foreground">{sectionTitle(pathname)}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={online === false ? 'destructive' : online ? 'success' : 'outline'}>
                <span
                  className={`size-1.5 rounded-full ${online === false ? 'bg-destructive' : online ? 'bg-success live-dot' : 'bg-muted-foreground'}`}
                />
                {online === false ? 'API offline' : online ? 'API online' : 'Checking API'}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()} aria-label="Refresh">
                <RefreshCw className="size-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={logout} aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-6 md:py-6">
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {navItems.map((item) => (
                  <SidebarChip key={item.to} to={item.to} label={item.label} />
                ))}
              </div>

              {online === false ? (
                <Notice tone="warning" className="mb-4 flex items-start gap-2">
                  <WifiOff className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Can't reach the API at <span className="font-mono text-xs">{getApiBaseUrl()}</span>. Data shown may be
                    stale; retrying every 30 seconds.
                  </span>
                </Notice>
              ) : null}

              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({ to, icon: Icon, label }: { to: NavPath; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/dashboard' }}
      className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
      activeProps={{
        className: 'bg-accent/60 font-medium text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary))]',
      }}
      inactiveProps={{
        className: 'text-muted-foreground hover:bg-muted hover:text-foreground',
      }}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  )
}

function SidebarChip({ to, label }: { to: NavPath; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/dashboard' }}
      className="whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
      activeProps={{ className: 'border-primary bg-primary text-primary-foreground' }}
      inactiveProps={{ className: 'border-border bg-card text-muted-foreground hover:border-primary/40' }}
    >
      {label}
    </Link>
  )
}
