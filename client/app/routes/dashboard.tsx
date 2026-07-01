import { Link, Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Activity,
  Bell,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  BarChart3,
  RefreshCw,
  Settings,
  Smartphone,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { fetchCurrentUser, fetchHealth, type UserResponse } from '../lib/api'
import { clearSession, getStoredUser, isLoggedIn } from '../lib/auth'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
})

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/trips', label: 'Trips', icon: Activity },
  { to: '/dashboard/devices', label: 'Devices', icon: Smartphone },
  { to: '/dashboard/map', label: 'Coverage', icon: MapIcon },
  { to: '/dashboard/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
] as const

function DashboardLayout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserResponse | null>(() => getStoredUser())
  const [health, setHealth] = useState('checking')

  useEffect(() => {
    if (!isLoggedIn()) {
      void navigate({ to: '/' })
      return
    }

    void Promise.all([fetchCurrentUser(), fetchHealth()])
      .then(([currentUser, healthResponse]) => {
        setUser(currentUser)
        setHealth(healthResponse.status)
      })
      .catch(() => {
        clearSession()
        void navigate({ to: '/' })
      })
  }, [navigate])

  function logout() {
    clearSession()
    void navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-background/80">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
          <div className="status-line h-1" />
          <div className="border-b border-sidebar-border px-5 py-6">
            <div className="flex items-center gap-3">
              <div className="brand-gradient flex size-10 items-center justify-center rounded-xl text-base font-bold text-white shadow-[0_10px_24px_-10px_hsl(160_84%_40%/0.9)]">
                T
              </div>
              <div>
                <p className="font-display text-base font-semibold tracking-tight text-white">Tayenda</p>
                <p className="text-xs text-slate-400">Green mobility console</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <StatusTile label="API" value={health} live={health === 'healthy'} />
              <StatusTile label="Role" value={user?.role ?? 'operator'} />
            </div>
          </div>

          <nav className="space-y-1 p-3">
            {navItems.map((item) => (
              <SidebarItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
          </nav>

          <div className="mt-auto border-t border-sidebar-border p-4">
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-sidebar-accent/20 text-sm font-semibold text-sidebar-accent">
                {(user?.full_name ?? user?.username ?? 'O').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user?.full_name ?? user?.username ?? 'Operator'}</p>
                <p className="truncate text-xs text-slate-400">{user?.email ?? 'Signed in'}</p>
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={logout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 px-3 py-3 md:px-6 md:py-5">
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 lg:hidden">
            <div className="brand-gradient flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white">T</div>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-foreground">Tayenda</p>
              <p className="text-xs text-muted-foreground">Green mobility console</p>
            </div>
            <Badge variant={health === 'healthy' ? 'success' : 'warning'}>API {health}</Badge>
          </div>

          <div className="glass-panel mb-4 flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/70">
                Live operations
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={health === 'healthy' ? 'success' : 'warning'}>API {health}</Badge>
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3 lg:hidden">
            {navItems.map((item) => (
              <SidebarChip key={item.to} to={item.to} label={item.label} />
            ))}
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  )
}

function StatusTile({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-white">
        {live ? <span className="size-1.5 rounded-full bg-sidebar-accent live-dot" /> : null}
        {value}
      </p>
    </div>
  )
}

function SidebarItem({
  to,
  icon: Icon,
  label,
}: {
  to:
    | '/dashboard'
    | '/dashboard/map'
    | '/dashboard/analysis'
    | '/dashboard/trips'
    | '/dashboard/devices'
    | '/dashboard/alerts'
    | '/dashboard/settings'
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all"
      activeProps={{ className: 'border-white/10 bg-white/10 text-white shadow-[inset_2px_0_0_0_hsl(var(--sidebar-accent))]' }}
      inactiveProps={{
        className: 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white',
      }}
    >
      <Icon className="size-4 transition-colors group-hover:text-sidebar-accent" />
      <span>{label}</span>
    </Link>
  )
}

function SidebarChip({
  to,
  label,
}: {
  to:
    | '/dashboard'
    | '/dashboard/map'
    | '/dashboard/analysis'
    | '/dashboard/trips'
    | '/dashboard/devices'
    | '/dashboard/alerts'
    | '/dashboard/settings'
  label: string
}) {
  return (
    <Link
      to={to}
      className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors"
      activeProps={{ className: 'border-primary bg-primary text-primary-foreground' }}
      inactiveProps={{ className: 'border-border bg-card text-muted-foreground hover:border-primary/40' }}
    >
      {label}
    </Link>
  )
}
