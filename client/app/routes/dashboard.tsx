import { Link, Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Activity,
  Bell,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
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
          <div className="border-b border-sidebar-border px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="border border-white/20 bg-white px-2 py-1 text-sm font-bold text-sidebar">
                TY
              </div>
              <div>
                <p className="text-sm font-semibold">Tayenda</p>
                <p className="text-xs text-slate-300">Road capture console</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <StatusTile label="API" value={health} />
              <StatusTile label="Role" value={user?.role ?? 'operator'} />
            </div>
          </div>

          <nav className="space-y-1 p-3">
            {navItems.map((item) => (
              <SidebarItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
          </nav>

          <div className="mt-auto border-t border-sidebar-border p-4">
            <div className="mb-3 border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold text-white">{user?.full_name ?? user?.username ?? 'Operator'}</p>
              <p className="mt-1 text-xs text-slate-300">{user?.email ?? 'Signed in'}</p>
            </div>
            <Button variant="secondary" className="w-full" onClick={logout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 px-3 py-3 md:px-6 md:py-5">
          <div className="mb-4 border border-border bg-card px-4 py-4 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tayenda</p>
                <p className="text-sm font-semibold text-foreground">Road capture console</p>
              </div>
              <Badge variant={health === 'healthy' ? 'success' : 'warning'}>API {health}</Badge>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Live operations
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
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

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/15 bg-white/10 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function SidebarItem({
  to,
  icon: Icon,
  label,
}: {
  to: '/dashboard' | '/dashboard/map' | '/dashboard/trips' | '/dashboard/devices' | '/dashboard/alerts' | '/dashboard/settings'
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border px-3 py-3 text-sm font-medium transition-colors"
      activeProps={{ className: 'border-white/20 bg-white/12 text-white' }}
      inactiveProps={{
        className: 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/8 hover:text-white',
      }}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  )
}

function SidebarChip({
  to,
  label,
}: {
  to: '/dashboard' | '/dashboard/map' | '/dashboard/trips' | '/dashboard/devices' | '/dashboard/alerts' | '/dashboard/settings'
  label: string
}) {
  return (
    <Link
      to={to}
      className="whitespace-nowrap border px-4 py-2 text-sm transition-colors"
      activeProps={{ className: 'border-zinc-900 bg-zinc-900 text-white' }}
      inactiveProps={{ className: 'border-border bg-card text-muted-foreground' }}
    >
      {label}
    </Link>
  )
}
