import { createFileRoute } from '@tanstack/react-router'
import { Layers, MapPin, Route as RouteIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchProcessingHealth, fetchRoadTraces, fetchTrips, type ProcessingHealthResponse, type TripListItem, type TripTrace } from '../lib/api'
import { formatDistance } from '../lib/dashboard'

export const Route = createFileRoute('/dashboard/map')({
  component: CoveragePage,
})

function CoveragePage() {
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [traces, setTraces] = useState<TripTrace[]>([])
  const [processingHealth, setProcessingHealth] = useState<ProcessingHealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTrips()
      .then((response) => setTrips(response.items))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load coverage data'))

    fetchRoadTraces()
      .then((response) => setTraces(response.traces))
      .catch(() => undefined)

    fetchProcessingHealth()
      .then((response) => setProcessingHealth(response))
      .catch(() => undefined)
  }, [])

  const bySurface = countTrips(trips, (trip) => trip.road_surface ?? 'UNSPECIFIED')
  const byVehicle = countTrips(trips, (trip) => trip.vehicle_type ?? 'UNSPECIFIED')
  const totalDistance = trips.reduce((sum, trip) => sum + (trip.total_distance ?? 0), 0)
  const uploaded = trips.filter((trip) => trip.status === 'UPLOADED').length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge>Coverage</Badge>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Road coverage</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Summary of collected distance, upload sources, road surfaces, and vehicle groups.
          </p>
        </div>
        <Badge variant="secondary">{uploaded}/{trips.length} finalized</Badge>
      </div>

      {error ? <Card><CardContent className="py-4 text-sm">{error}</CardContent></Card> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="size-4" />
              <CardTitle>Recorded road traces</CardTitle>
            </div>
            <CardDescription>
              Downsampled GPS traces from uploaded trips.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[360px] border border-border bg-secondary/30 p-3">
              <TraceCanvas traces={traces} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Metric label="Distance" value={formatDistance(totalDistance)} />
              <Metric label="Surfaces" value={String(bySurface.length)} />
              <Metric label="Vehicles" value={String(byVehicle.length)} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Distribution title="Road surfaces" rows={bySurface} total={trips.length} />
          <Distribution title="Vehicle groups" rows={byVehicle} total={trips.length} />
          <Card className="glass-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RouteIcon className="size-4" />
                <CardTitle>Processing health</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              {processingHealth ? (
                <div className="space-y-1">
                  <div>Status: {processingHealth.status}</div>
                  <div>Interval: {processingHealth.interval_seconds}s</div>
                  <div>Processed last run: {processingHealth.processed_trips_last_run}</div>
                  <div>Cleaned raw files: {processingHealth.cleaned_files_last_run}</div>
                  <div>
                    Next run: {processingHealth.next_run_at ? formatDate(processingHealth.next_run_at) : 'N/A'}
                  </div>
                </div>
              ) : (
                'Processing health not available.'
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function TraceCanvas({ traces }: { traces: TripTrace[] }) {
  if (traces.length === 0) {
    return <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">No trace data yet.</div>
  }

  const points = traces.flatMap((trace) => trace.points)
  const minLat = Math.min(...points.map((p) => p.lat))
  const maxLat = Math.max(...points.map((p) => p.lat))
  const minLon = Math.min(...points.map((p) => p.lon))
  const maxLon = Math.max(...points.map((p) => p.lon))
  const latRange = Math.max(0.00001, maxLat - minLat)
  const lonRange = Math.max(0.00001, maxLon - minLon)

  return (
    <svg viewBox="0 0 1000 500" className="h-[320px] w-full border border-border bg-card">
      {traces.map((trace, idx) => {
        const poly = trace.points
          .map((p) => {
            const x = ((p.lon - minLon) / lonRange) * 1000
            const y = 500 - ((p.lat - minLat) / latRange) * 500
            return `${x.toFixed(2)},${y.toFixed(2)}`
          })
          .join(' ')
        const color = `hsl(${(idx * 47) % 360} 75% 42%)`
        return <polyline key={trace.trip_id} points={poly} fill="none" stroke={color} strokeWidth="2" />
      })}
    </svg>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <Layers className="size-4 text-muted-foreground" />
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}

function Distribution({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Grouped from uploaded trip metadata.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : null}
        {rows.map(([label, count]) => (
          <div key={label} className="border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">{count}</p>
            </div>
            <div className="mt-3 h-2 border border-border bg-card">
              <div className="h-full bg-zinc-900" style={{ width: `${total > 0 ? Math.max(8, Math.round((count / total) * 100)) : 0}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function countTrips(trips: TripListItem[], getKey: (trip: TripListItem) => string) {
  const groups = new Map<string, number>()
  for (const trip of trips) {
    const key = getKey(trip)
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1])
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
