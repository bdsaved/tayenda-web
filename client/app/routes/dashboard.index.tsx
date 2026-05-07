import { createFileRoute } from '@tanstack/react-router'
import { Activity, CircleAlert, Database, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchHealth, fetchTrips, type TripListItem } from '../lib/api'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
})

type OverviewState = {
  trips: TripListItem[]
  health: string
  loading: boolean
  error: string | null
}

function DashboardOverview() {
  const [state, setState] = useState<OverviewState>({
    trips: [],
    health: 'checking',
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [tripsResponse, healthResponse] = await Promise.all([fetchTrips(), fetchHealth()])
        if (cancelled) return
        setState({
          trips: tripsResponse.items,
          health: healthResponse.status,
          loading: false,
          error: null,
        })
      } catch (error) {
        if (cancelled) return
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load dashboard data',
        }))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const trips = state.trips
  const uploadedTrips = trips.filter((trip) => trip.status === 'UPLOADED').length
  const uploadIssues = trips.filter((trip) => trip.status !== 'UPLOADED').length
  const activeDevices = new Set(trips.map((trip) => trip.device_id)).size
  const samplesCaptured = trips.reduce((total, trip) => total + trip.total_samples_received, 0)
  const recentTrips = trips.slice(0, 5)

  return (
    <div className="section-enter space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="w-fit">Overview</Badge>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Shared sync status
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            The mobile uploader and the web intake form now land in the same trip store, so this
            view reflects the real end-to-end status instead of fixed placeholders.
          </p>
        </div>
        <Badge variant={state.health === 'healthy' ? 'success' : 'warning'}>
          API {state.health}
        </Badge>
      </div>

      {state.error ? (
        <Card className="border-rose-300">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-rose-700">
            <CircleAlert className="size-4" />
            <span>{state.error}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Trips recorded" value={String(trips.length)} detail="All mobile and web uploads" icon={Activity} />
        <MetricCard label="Trips synced" value={String(uploadedTrips)} detail="Finished and finalized" icon={Database} />
        <MetricCard label="Active devices" value={String(activeDevices)} detail="Unique device identities" icon={Smartphone} />
        <MetricCard label="Upload issues" value={String(uploadIssues)} detail="Pending or incomplete work" icon={CircleAlert} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Recent trip activity</CardTitle>
            <CardDescription>Latest uploads reaching the shared dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.loading ? (
              <p className="text-sm text-muted-foreground">Loading trip activity...</p>
            ) : recentTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trips have been uploaded yet.</p>
            ) : (
              recentTrips.map((trip) => (
                <div key={trip.trip_id} className="grid gap-2 border border-border bg-secondary/40 p-4 md:grid-cols-[1.2fr_0.8fr_0.6fr]">
                  <div>
                    <p className="font-mono text-xs font-medium text-primary">{trip.trip_id}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {trip.device_model ?? 'Unknown device'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {trip.operator_name ?? 'Mobile sync'} / {trip.upload_source}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatDate(trip.start_time)}</p>
                    <p className="text-sm text-muted-foreground">
                      {trip.total_samples_received.toLocaleString()} samples
                    </p>
                  </div>
                  <div className="flex items-start justify-start md:justify-end">
                    <Badge variant={statusVariant(trip.status)}>{trip.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline notes</CardTitle>
            <CardDescription>Quick operational summary from current records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow label="Samples stored" value={samplesCaptured.toLocaleString()} />
            <SummaryRow label="Latest upload source" value={recentTrips[0]?.upload_source ?? 'none'} />
            <SummaryRow label="Trips awaiting review" value={String(uploadIssues)} />
            <SummaryRow label="Health state" value={state.health} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Activity
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <div className="border border-border bg-secondary p-2">
          <Icon className="size-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-secondary/40 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'UPLOADED') return 'success'
  if (status === 'FAILED') return 'destructive'
  if (status === 'UPLOADING' || status === 'PENDING') return 'warning'
  return 'outline'
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
