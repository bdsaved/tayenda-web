import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  ArrowUpRight,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Map as MapIcon,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { cn } from '../lib/utils'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
})

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/map', label: 'Corridor map', icon: MapIcon },
  { to: '/dashboard/trips', label: 'Trip audits', icon: Activity },
] as const

function DashboardLayout() {
  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="section-enter">
          <Card className="flex h-full flex-col overflow-hidden border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="space-y-4 border-b border-sidebar-border px-6 py-6">
              <Badge className="w-fit border-white/10 bg-white/10 text-white">
                Operator workspace
              </Badge>
              <div>
                <h1 className="font-display text-3xl text-white">Tayenda</h1>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Clean route intelligence for field teams, planners, and QA review.
                </p>
              </div>
            </div>

            <nav className="space-y-2 px-4 py-6">
              {navItems.map((item) => (
                <SidebarItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
              ))}
            </nav>

            <div className="mt-auto space-y-4 border-t border-sidebar-border px-6 py-6">
              <div className="rounded-[24px] bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Active corridor
                </p>
                <p className="mt-2 text-lg font-semibold text-white">M1 North Spine</p>
                <p className="mt-1 text-sm text-slate-300">
                  Monitoring uploads, validation lag, and segment quality drift.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full justify-between border-white/15 bg-white/6 text-white hover:bg-white/12"
              >
                Sign out
                <LogOut className="size-4" />
              </Button>
            </div>
          </Card>
        </aside>

        <main className="section-enter min-w-0">
          <div className="flex h-full flex-col gap-4">
            <Card className="border-white/70 bg-white/75 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Malawi Road Assessment
                  </p>
                  <h2 className="mt-2 font-display text-3xl text-foreground">
                    Manager console
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">Live telemetry window</Badge>
                  <div className="rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm text-muted-foreground">
                    RFLMWCOM Admin
                  </div>
                  <Button>
                    Export digest
                    <ArrowUpRight className="size-4" />
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
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium transition-all',
          isActive
            ? 'bg-white text-sidebar shadow-[0_18px_40px_-24px_rgba(248,250,252,0.85)]'
            : 'text-slate-300 hover:bg-white/8 hover:text-white',
        )
      }
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
      className={({ isActive }) =>
        cn(
          'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'border-primary/20 bg-primary text-primary-foreground'
            : 'border-border/70 bg-white/70 text-muted-foreground',
        )
      }
    >
      {label}
    </Link>
  )
}
