import { createFileRoute } from '@tanstack/react-router'
import { Activity, AlertTriangle, CheckCircle2, HardDrive, Route as RouteIcon, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchTrips, type TripListItem } from '../lib/api'
import { captureScore, deriveAlerts, deriveDevices, formatDate, formatDistance } from '../lib/dashboard'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
})

function DashboardOverview() {
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchTrips()
      .then((response) => {
        if (cancelled) return
        setTrips(response.items)
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const devices = useMemo(() => deriveDevices(trips), [trips])
  const alerts = useMemo(() => deriveAlerts(trips), [trips])
  const score = captureScore(trips)
  const uploaded = trips.filter((trip) => trip.status === 'UPLOADED').length
  const samples = trips.reduce((total, trip) => total + trip.total_samples_received, 0)
  const distance = trips.reduce((total, trip) => total + (trip.total_distance ?? 0), 0)
  const latestTrips = trips.slice(0, 6)

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="border-zinc-900">
          <CardContent className="py-4 text-sm text-foreground">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <Badge>Capture state</Badge>
                <CardTitle className="mt-4 text-3xl">Network readiness</CardTitle>
                <CardDescription>
                  One operational score from finalized trips, metadata completeness, and upload health.
                </CardDescription>
              </div>
              <div className="border border-border bg-secondary px-5 py-4 text-right">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Score</p>
                <p className="mt-1 text-4xl font-semibold">{score}%</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-3 border border-border bg-background">
              <div className="h-full bg-zinc-900" style={{ width: `${score}%` }} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric icon={Activity} label="Trips" value={String(trips.length)} detail={`${uploaded} finalized`} />
              <Metric icon={Smartphone} label="Devices" value={String(devices.length)} detail="Unique collectors" />
              <Metric icon={HardDrive} label="Samples" value={samples.toLocaleString()} detail="Stored readings" />
              <Metric icon={RouteIcon} label="Distance" value={formatDistance(distance)} detail="Reported coverage" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>System alerts</CardTitle>
            <CardDescription>What needs attention before the next field session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <AlertRow icon={CheckCircle2} title="No active alerts" detail="Uploads and metadata look clean." />
            ) : (
              alerts.slice(0, 4).map((alert) => (
                <AlertRow key={alert.id} icon={AlertTriangle} title={alert.title} detail={alert.detail} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Recent trip timeline</CardTitle>
            <CardDescription>Latest records reaching the shared backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading trips...</p>
            ) : latestTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trips uploaded yet.</p>
            ) : (
              latestTrips.map((trip) => <TripTimelineItem key={trip.trip_id} trip={trip} />)
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Device health</CardTitle>
            <CardDescription>Most recent collection devices by last activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {devices.slice(0, 5).map((device) => (
              <div key={device.id} className="border border-border bg-secondary/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{device.model}</p>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{device.id}</p>
                  </div>
                  <Badge variant={device.status === 'attention' ? 'destructive' : 'outline'}>{device.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">{device.trips} trips</span>
                  <span className="text-right text-muted-foreground">{device.samples.toLocaleString()} samples</span>
                </div>
              </div>
            ))}
            {devices.length === 0 ? <p className="text-sm text-muted-foreground">No devices yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="border border-border bg-card p-4">
      <Icon className="size-5 text-muted-foreground" />
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function AlertRow({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof AlertTriangle
  title: string
  detail: string
}) {
  return (
    <div className="flex gap-3 border border-border bg-secondary/40 p-4">
      <Icon className="mt-0.5 size-4 text-foreground" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function TripTimelineItem({ trip }: { trip: TripListItem }) {
  return (
    <div className="grid gap-3 border border-border bg-card p-4 md:grid-cols-[1fr_160px_120px] md:items-center">
      <div className="min-w-0">
        <p className="truncate font-mono text-xs font-semibold">{trip.trip_id}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {trip.device_model ?? 'Unknown device'} / {trip.upload_source}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{formatDate(trip.start_time)}</p>
      <Badge variant={trip.status === 'UPLOADED' ? 'success' : trip.status === 'FAILED' ? 'destructive' : 'warning'}>
        {trip.status}
      </Badge>
    </div>
  )
}
