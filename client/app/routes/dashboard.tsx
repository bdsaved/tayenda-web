import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Activity, LayoutDashboard, Map as MapIcon, RefreshCw, type LucideIcon } from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
})

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/trips', label: 'Trips', icon: Activity },
  { to: '/dashboard/map', label: 'Coverage', icon: MapIcon },
] as const

function DashboardLayout() {
  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="section-enter">
          <Card className="flex h-full flex-col border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="border-b border-sidebar-border px-5 py-5">
              <Badge className="w-fit border-white/15 bg-sidebar-accent text-white">Workspace</Badge>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Tayenda</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Shared mobile and web trip operations for collection, recovery, and audit.
              </p>
            </div>

            <nav className="space-y-1 px-3 py-4">
              {navItems.map((item) => (
                <SidebarItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
              ))}
            </nav>

            <div className="mt-auto border-t border-sidebar-border px-5 py-5">
              <div className="border border-sidebar-border bg-sidebar-accent p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Active mode
                </p>
                <p className="mt-2 text-sm text-white">Live trip sync and manual web import</p>
              </div>
            </div>
          </Card>
        </aside>

        <main className="section-enter min-w-0">
          <div className="flex h-full flex-col gap-4">
            <Card className="px-5 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Malawi road quality operations
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    Operator dashboard
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Flat web review</Badge>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    <RefreshCw className="size-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </Card>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => (
                <SidebarChip key={item.to} to={item.to} label={item.label} />
              ))}
            </div>

            <div className="min-h-0 flex-1">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function SidebarItem({
  to,
  icon: Icon,
  label,
}: {
  to: '/dashboard' | '/dashboard/map' | '/dashboard/trips'
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border px-3 py-3 text-sm transition-colors"
      activeProps={{ className: 'border-white/10 bg-white text-sidebar' }}
      inactiveProps={{
        className: 'border-transparent text-slate-300 hover:border-white/10 hover:bg-sidebar-accent hover:text-white',
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
  to: '/dashboard' | '/dashboard/map' | '/dashboard/trips'
  label: string
}) {
  return (
    <Link
      to={to}
      className="whitespace-nowrap border px-4 py-2 text-sm transition-colors"
      activeProps={{ className: 'border-primary bg-primary text-primary-foreground' }}
      inactiveProps={{ className: 'border-border bg-card text-muted-foreground' }}
    >
      {label}
    </Link>
  )
}
