import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { StatTile } from '../components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
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
  const latestTrips = trips.slice(0, 8)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description="Capture readiness and the latest activity from the field network."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatTile label="Readiness" value={`${score}%`} tone="primary" hint="Upload + metadata score" />
        <StatTile label="Trips" value={trips.length.toLocaleString()} hint={`${uploaded} finalized`} />
        <StatTile label="Uploaded" value={uploaded.toLocaleString()} />
        <StatTile label="Devices" value={devices.length.toLocaleString()} hint="Unique collectors" />
        <StatTile label="Samples" value={samples.toLocaleString()} />
        <StatTile label="Distance" value={formatDistance(distance)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flat-panel overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Recent trips</h2>
            <p className="text-sm text-muted-foreground">Latest records reaching the shared backend.</p>
          </div>
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading trips...</p>
          ) : latestTrips.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No trips uploaded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Trip</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestTrips.map((trip) => (
                  <TableRow key={trip.trip_id}>
                    <TableCell>
                      <Link
                        to="/dashboard/trips/$tripId"
                        params={{ tripId: trip.trip_id }}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {trip.trip_id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {trip.device_model ?? 'Unknown device'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(trip.start_time)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          trip.status === 'UPLOADED'
                            ? 'success'
                            : trip.status === 'FAILED'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {trip.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="space-y-4">
          <div className="flat-panel">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">Alerts</h2>
            </div>
            <div className="divide-y divide-border">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  <p className="text-sm text-muted-foreground">No active alerts.</p>
                </div>
              ) : (
                alerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="flex gap-2.5 px-4 py-3">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${severityDot(alert.severity)}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{alert.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flat-panel">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">Device health</h2>
            </div>
            <div className="divide-y divide-border">
              {devices.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No devices yet.</p>
              ) : (
                devices.slice(0, 5).map((device) => (
                  <div key={device.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{device.model}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{device.id}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {device.trips} trips · {device.samples.toLocaleString()} samples
                      </p>
                      <Badge variant={device.status === 'attention' ? 'destructive' : 'outline'}>
                        {device.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function severityDot(severity: 'critical' | 'warning' | 'info') {
  if (severity === 'critical') return 'bg-destructive'
  if (severity === 'warning') return 'bg-warning'
  return 'bg-primary'
}
