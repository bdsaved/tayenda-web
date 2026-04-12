import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  Search,
  Trash2,
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
import { Input } from '../components/ui/input'

export const Route = createFileRoute('/dashboard/trips')({
  component: TripAuditsComponent,
})

const trips = [
  {
    id: 'TRP-01J9-AX31',
    device: 'Pixel 8',
    operator: 'RFLMWCOM',
    time: 'Apr 11, 2026 - 14:30',
    iri: '3.2 (Fair)',
    status: 'Completed',
    icon: CheckCircle2,
    tone: 'success' as const,
  },
  {
    id: 'TRP-01J9-BQ77',
    device: 'Samsung S24',
    operator: 'User_01',
    time: 'Apr 11, 2026 - 12:15',
    iri: 'Pending ML',
    status: 'Uploading',
    icon: Clock,
    tone: 'warning' as const,
  },
  {
    id: 'TRP-01J9-CZ14',
    device: 'Pixel 7',
    operator: 'User_05',
    time: 'Apr 10, 2026 - 18:45',
    iri: '1.8 (Good)',
    status: 'Completed',
    icon: CheckCircle2,
    tone: 'success' as const,
  },
  {
    id: 'TRP-01J9-DM42',
    device: 'iPhone 15',
    operator: 'Admin',
    time: 'Apr 10, 2026 - 09:10',
    iri: 'N/A',
    status: 'Failed',
    icon: AlertCircle,
    tone: 'destructive' as const,
  },
] as const

function TripAuditsComponent() {
  return (
    <div className="section-enter space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="w-fit">Trip audits</Badge>
          <h2 className="mt-3 font-display text-4xl text-foreground">Field session review</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Validate uploads, inspect device metadata, and take action on failed or incomplete trips.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[260px]">
            <Search className="absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <Input placeholder="Search trip ID..." className="pl-11" />
          </div>
          <Button variant="outline">
            <Filter className="size-4" />
            Filters
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden bg-white/86">
        <CardHeader className="border-b border-border/70 pb-5">
          <CardTitle>Recent uploads</CardTitle>
          <CardDescription>
            Showing the latest audited sessions queued for review and export.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          <table className="min-w-full text-left">
            <thead className="bg-secondary/45">
              <tr>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Trip identifier
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Device / operator
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Start time
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Quality (IRI)
                </th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {trips.map((trip) => (
                <TripRow key={trip.id} {...trip} />
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-border/70 bg-secondary/35 px-6 py-4">
            <p className="text-sm text-muted-foreground">Showing 4 of 1,284 trips</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TripRow({
  id,
  device,
  operator,
  time,
  iri,
  status,
  icon: Icon,
  tone,
}: {
  id: string
  device: string
  operator: string
  time: string
  iri: string
  status: string
  icon: LucideIcon
  tone: 'success' | 'warning' | 'destructive'
}) {
  return (
    <tr className="group transition-colors hover:bg-secondary/25">
      <td className="px-6 py-4 font-mono text-xs font-semibold text-primary">{id}</td>
      <td className="px-6 py-4">
        <p className="text-sm font-semibold text-foreground">{device}</p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {operator}
        </p>
      </td>
      <td className="px-6 py-4 text-sm text-muted-foreground">{time}</td>
      <td className="px-6 py-4">
        <Badge variant={iri.includes('Good') ? 'success' : iri.includes('Fair') ? 'warning' : 'outline'}>
          {iri}
        </Badge>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Icon className="size-4" />
          <Badge variant={tone}>{status}</Badge>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <Button variant="ghost" size="icon" title="View details">
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Download samples">
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Delete trip">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
