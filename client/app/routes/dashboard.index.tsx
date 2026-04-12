import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Map,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Separator } from '../components/ui/separator'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
})

const stats = [
  {
    title: 'Trips ingested',
    value: '1,284',
    note: '+12% over the last 30 days',
    icon: Activity,
  },
  {
    title: 'Active devices',
    value: '42',
    note: '7 devices uploaded in the last hour',
    icon: Smartphone,
  },
  {
    title: 'Average IRI',
    value: '3.8',
    note: 'Across verified corridor segments',
    icon: Map,
  },
  {
    title: 'Critical hazards',
    value: '7',
    note: '2 requiring immediate inspection',
    icon: AlertTriangle,
  },
] as const

const recentSegments = [
  { id: 'M1-1042', corridor: 'Blantyre - Lilongwe', iri: '2.1', status: 'Stable' },
  { id: 'S122-188', corridor: 'Dedza connector', iri: '3.9', status: 'Watchlist' },
  { id: 'T301-044', corridor: 'Mzuzu freight link', iri: '4.6', status: 'Escalate' },
  { id: 'M5-901', corridor: 'Salima lakeshore', iri: '2.7', status: 'Stable' },
] as const

const systemHealth = [
  { label: 'API and ingest', status: 'Online', tone: 'success' as const },
  { label: 'ML scoring queue', status: 'Healthy', tone: 'success' as const },
  { label: 'Database cluster', status: 'Review', tone: 'warning' as const },
  { label: 'Cold storage sync', status: 'Online', tone: 'success' as const },
] as const

function DashboardOverview() {
  return (
    <div className="section-enter space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="w-fit">Overview</Badge>
          <h2 className="mt-3 font-display text-4xl text-foreground">
            Real-time network posture
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Focus the team on verified uploads, segment quality drift, and where
            corridor maintenance needs attention next.
          </p>
        </div>
        <Button variant="outline">
          Open incident queue
          <ArrowUpRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="bg-white/86">
          <CardHeader>
            <CardTitle>Recently scored segments</CardTitle>
            <CardDescription>
              Deterministic snapshot of the latest corridor samples ready for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentSegments.map((segment, index) => (
              <div key={segment.id}>
                <div className="flex flex-col gap-3 rounded-[24px] bg-secondary/45 p-4 md:flex-row md:items-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-primary shadow-sm">
                    {segment.id.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{segment.id}</p>
                    <p className="text-sm text-muted-foreground">{segment.corridor}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">IRI {segment.iri}</p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Quality score
                      </p>
                    </div>
                    <Badge
                      variant={
                        segment.status === 'Escalate'
                          ? 'destructive'
                          : segment.status === 'Watchlist'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {segment.status}
                    </Badge>
                  </div>
                </div>
                {index < recentSegments.length - 1 ? <Separator className="mt-4" /> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/86">
          <CardHeader>
            <CardTitle>System health</CardTitle>
            <CardDescription>
              Core services behind upload, scoring, and storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemHealth.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-[22px] bg-secondary/45 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">Operational status</p>
                </div>
                <Badge variant={item.tone === 'warning' ? 'warning' : 'success'}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string
  value: string
  note: string
  icon: LucideIcon
}) {
  return (
    <Card className="bg-white/86">
      <CardContent className="flex items-start justify-between gap-4 py-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-3 text-4xl font-semibold text-foreground">{value}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
        </div>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}
