import { Link, createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Gauge, Route as RouteIcon, Smartphone, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { StatTile } from '../components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { fetchRoadsAnalysis, fetchTrips, type RoadAnalysisRow, type TripListItem } from '../lib/api'
import { captureScore, formatDate } from '../lib/dashboard'
import { statusVariant } from './dashboard.trips'

export const Route = createFileRoute('/dashboard/analysis')({
  component: RoadAnalysisPage,
})

type SurfaceVehicleRow = {
  surface: string
  vehicles: Record<string, { trips: number; distanceKm: number }>
  totalTrips: number
  totalDistanceKm: number
}

type TimelineBucket = {
  key: string
  label: string
  sortTime: number
  trips: number
  distanceKm: number
  samples: number
}

type WatchItem = {
  trip: TripListItem
  score: number
  reasons: string[]
}

const SURFACE_COLORS = [
  'hsl(150 93% 28%)',
  'hsl(205 85% 42%)',
  'hsl(32 95% 44%)',
  'hsl(18 72% 43%)',
  'hsl(262 58% 48%)',
]

function RoadAnalysisPage() {
  const [rows, setRows] = useState<RoadAnalysisRow[]>([])
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [totalTrips, setTotalTrips] = useState(0)
  const [totalDistanceKm, setTotalDistanceKm] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchRoadsAnalysis(), fetchTrips()])
      .then(([analysis, tripResponse]) => {
        if (cancelled) return
        setRows(analysis.rows)
        setTotalTrips(analysis.total_trips)
        setTotalDistanceKm(analysis.total_distance_km)
        setTrips(tripResponse.items)
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load road analysis')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const topSurface = rows[0]?.road_surface ?? 'N/A'
  const uploadedTrips = trips.filter((trip) => trip.status === 'UPLOADED')
  const failedTrips = trips.filter((trip) => trip.status === 'FAILED')
  const activeTrips = trips.filter((trip) => trip.status === 'PENDING' || trip.status === 'UPLOADING' || trip.status === 'STORED' || trip.status === 'PROCESSING')
  const totalSamples = trips.reduce((sum, trip) => sum + trip.total_samples_received, 0)
  const avgKmPerTrip = totalTrips > 0 ? totalDistanceKm / totalTrips : 0
  const readiness = captureScore(trips)
  const sampleDensity = totalDistanceKm > 0 ? Math.round(totalSamples / totalDistanceKm) : 0

  const timeline = useMemo(() => buildTimeline(trips), [trips])
  const matrix = useMemo(() => buildSurfaceVehicleMatrix(trips), [trips])
  const vehicles = useMemo(() => collectVehicles(matrix), [matrix])
  const watchlist = useMemo(() => buildWatchlist(trips), [trips])
  const statusRows = useMemo(() => buildStatusRows(trips), [trips])
  const topDevice = useMemo(() => getTopDevice(trips), [trips])
  const longestTrip = useMemo(() => getLongestTrip(uploadedTrips), [uploadedTrips])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analysis"
        description="Operational readout for coverage, upload quality, device contribution, and data gaps."
        actions={<Badge variant="secondary">Top surface: {prettySurface(topSurface)}</Badge>}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatTile label="Readiness" value={`${readiness}%`} tone="primary" hint="Upload + metadata score" />
        <StatTile label="Trips" value={loading ? '...' : totalTrips.toLocaleString()} hint={`${uploadedTrips.length} uploaded`} />
        <StatTile label="Distance" value={`${totalDistanceKm.toFixed(1)} km`} hint={`${avgKmPerTrip.toFixed(1)} km/trip`} />
        <StatTile label="Samples" value={totalSamples.toLocaleString()} hint={`${sampleDensity.toLocaleString()} / km`} />
        <StatTile label="In progress" value={String(activeTrips.length)} />
        <StatTile label="Failed" value={String(failedTrips.length)} tone={failedTrips.length > 0 ? 'destructive' : 'default'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <SurfaceMix rows={rows} totalDistanceKm={totalDistanceKm} />
            <StatusFunnel rows={statusRows} totalTrips={trips.length} />
          </div>

          <TimelinePanel buckets={timeline} />
          <SurfaceVehicleMatrix rows={matrix} vehicles={vehicles} />
        </div>

        <div className="space-y-4">
          <InsightPanel
            topDevice={topDevice}
            longestTrip={longestTrip}
            sampleDensity={sampleDensity}
            rows={rows}
          />
          <WatchlistPanel items={watchlist} />
        </div>
      </div>
    </div>
  )
}

function SurfaceMix({ rows, totalDistanceKm }: { rows: RoadAnalysisRow[]; totalDistanceKm: number }) {
  const background = conicGradient(rows, totalDistanceKm)

  return (
    <div className="flat-panel p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Surface mix</h2>
        <p className="text-sm text-muted-foreground">Distance share by tagged road surface.</p>
      </div>

      <div className="flex items-center gap-5">
        <div
          className="grid size-36 shrink-0 place-items-center rounded-full border border-border"
          style={{ background }}
          aria-label="Road surface distance share"
        >
          <div className="grid size-20 place-items-center rounded-full border border-border bg-background text-center shadow-sm">
            <span className="text-sm font-semibold text-foreground">{totalDistanceKm.toFixed(0)} km</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No road data yet.</p> : null}
          {rows.slice(0, 5).map((row, index) => (
            <div key={row.road_surface} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: SURFACE_COLORS[index % SURFACE_COLORS.length] }} />
                <span className="truncate text-sm text-foreground">{prettySurface(row.road_surface)}</span>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {row.distance_km.toFixed(1)} km
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusFunnel({ rows, totalTrips }: { rows: { label: string; value: number; tone: string }[]; totalTrips: number }) {
  return (
    <div className="flat-panel p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Upload funnel</h2>
        <p className="text-sm text-muted-foreground">Where trips are sitting in the pipeline.</p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const width = totalTrips > 0 ? Math.max(row.value > 0 ? 4 : 0, Math.round((row.value / totalTrips) * 100)) : 0
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">{row.label}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{row.value}</p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelinePanel({ buckets }: { buckets: TimelineBucket[] }) {
  const maxDistance = Math.max(1, ...buckets.map((bucket) => bucket.distanceKm))

  return (
    <div className="flat-panel p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Collection timeline</h2>
          <p className="text-sm text-muted-foreground">Recent capture volume by day.</p>
        </div>
        <Badge variant="outline">{buckets.length} active days</Badge>
      </div>
      {buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timeline data yet.</p>
      ) : (
        <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1">
          {buckets.map((bucket) => {
            const height = Math.max(12, Math.round((bucket.distanceKm / maxDistance) * 160))
            return (
              <div key={bucket.label} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end rounded-md bg-muted">
                  <div
                    className="w-full rounded-md bg-primary"
                    style={{ height }}
                    title={`${bucket.distanceKm.toFixed(1)} km, ${bucket.trips} trips`}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-medium text-foreground">{bucket.label}</p>
                  <p className="text-[11px] text-muted-foreground">{bucket.trips} trips</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SurfaceVehicleMatrix({ rows, vehicles }: { rows: SurfaceVehicleRow[]; vehicles: string[] }) {
  return (
    <div className="flat-panel overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Surface x vehicle matrix</h2>
        <p className="text-sm text-muted-foreground">Distance coverage by vehicle category and road type.</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">No matrix data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Surface</TableHead>
                {vehicles.map((vehicle) => (
                  <TableHead key={vehicle}>{prettySurface(vehicle)}</TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.surface}>
                  <TableCell className="font-medium text-foreground">{prettySurface(row.surface)}</TableCell>
                  {vehicles.map((vehicle) => {
                    const cell = row.vehicles[vehicle]
                    return (
                      <TableCell key={vehicle} className="text-muted-foreground">
                        {cell ? `${cell.distanceKm.toFixed(1)} km` : '-'}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right text-muted-foreground">
                    {row.totalDistanceKm.toFixed(1)} km
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function InsightPanel({
  topDevice,
  longestTrip,
  sampleDensity,
  rows,
}: {
  topDevice: { id: string; model: string; trips: number; distanceKm: number } | null
  longestTrip: TripListItem | null
  sampleDensity: number
  rows: RoadAnalysisRow[]
}) {
  const topSurface = rows[0]

  return (
    <div className="flat-panel">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Notable signals</h2>
      </div>
      <div className="divide-y divide-border">
        <InsightRow
          icon={Smartphone}
          label="Most active device"
          value={topDevice ? topDevice.model : 'N/A'}
          detail={topDevice ? `${topDevice.trips} trips · ${topDevice.distanceKm.toFixed(1)} km` : 'No device data yet'}
        />
        <InsightRow
          icon={RouteIcon}
          label="Longest uploaded trip"
          value={longestTrip ? `${kmFromTrip(longestTrip).toFixed(1)} km` : 'N/A'}
          detail={longestTrip ? `${longestTrip.trip_id.slice(0, 8)} · ${formatDate(longestTrip.start_time)}` : 'No uploaded trips yet'}
        />
        <InsightRow
          icon={Gauge}
          label="Sample density"
          value={`${sampleDensity.toLocaleString()} / km`}
          detail="Higher density gives the backend more signal to work with."
        />
        <InsightRow
          icon={TrendingUp}
          label="Leading surface"
          value={topSurface ? prettySurface(topSurface.road_surface) : 'N/A'}
          detail={topSurface ? `${topSurface.distance_km.toFixed(1)} km · ${topSurface.samples.toLocaleString()} samples` : 'No road data yet'}
        />
      </div>
    </div>
  )
}

function InsightRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Smartphone
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function WatchlistPanel({ items }: { items: WatchItem[] }) {
  return (
    <div className="flat-panel">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Quality watchlist</h2>
        <p className="text-sm text-muted-foreground">Trips most likely to need inspection or retry.</p>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">No quality issues detected.</p>
        ) : (
          items.slice(0, 6).map((item) => (
            <div key={item.trip.trip_id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/dashboard/trips/$tripId"
                    params={{ tripId: item.trip.trip_id }}
                    className="font-mono text-xs font-medium text-primary hover:underline"
                  >
                    {item.trip.trip_id}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.reasons.join(' · ')}
                  </p>
                </div>
                <Badge variant={statusVariant(item.trip.status)}>{item.trip.status}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5" />
                <span>Priority score {item.score}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function buildStatusRows(trips: TripListItem[]) {
  const count = (statuses: string[]) => trips.filter((trip) => statuses.includes(trip.status)).length
  return [
    { label: 'Uploaded', value: count(['UPLOADED']), tone: 'bg-success' },
    { label: 'Processing', value: count(['PROCESSING', 'STORED']), tone: 'bg-primary' },
    { label: 'Syncing', value: count(['PENDING', 'UPLOADING']), tone: 'bg-warning' },
    { label: 'Failed', value: count(['FAILED']), tone: 'bg-destructive' },
  ]
}

function buildTimeline(trips: TripListItem[]): TimelineBucket[] {
  const buckets = new Map<string, TimelineBucket>()
  for (const trip of trips) {
    const date = new Date(trip.start_time)
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    const label = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
    const sortTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const existing = buckets.get(key) ?? { key, label, sortTime, trips: 0, distanceKm: 0, samples: 0 }
    existing.trips += 1
    existing.distanceKm += kmFromTrip(trip)
    existing.samples += trip.total_samples_received
    buckets.set(key, existing)
  }

  return [...buckets.values()]
    .sort((a, b) => a.sortTime - b.sortTime)
    .slice(-14)
}

function buildSurfaceVehicleMatrix(trips: TripListItem[]): SurfaceVehicleRow[] {
  const rows = new Map<string, SurfaceVehicleRow>()
  for (const trip of trips) {
    const surface = trip.road_surface ?? 'UNSPECIFIED'
    const vehicle = trip.vehicle_type ?? 'UNSPECIFIED'
    const distanceKm = kmFromTrip(trip)
    const row = rows.get(surface) ?? {
      surface,
      vehicles: {},
      totalTrips: 0,
      totalDistanceKm: 0,
    }
    const cell = row.vehicles[vehicle] ?? { trips: 0, distanceKm: 0 }
    cell.trips += 1
    cell.distanceKm += distanceKm
    row.vehicles[vehicle] = cell
    row.totalTrips += 1
    row.totalDistanceKm += distanceKm
    rows.set(surface, row)
  }

  return [...rows.values()].sort((a, b) => b.totalDistanceKm - a.totalDistanceKm)
}

function collectVehicles(rows: SurfaceVehicleRow[]) {
  const totals = new Map<string, number>()
  for (const row of rows) {
    for (const [vehicle, cell] of Object.entries(row.vehicles)) {
      totals.set(vehicle, (totals.get(vehicle) ?? 0) + cell.distanceKm)
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vehicle]) => vehicle)
}

function buildWatchlist(trips: TripListItem[]): WatchItem[] {
  return trips
    .map((trip) => {
      const reasons: string[] = []
      let score = 0

      if (trip.status === 'FAILED') {
        reasons.push('failed upload')
        score += 50
      }
      if (trip.status === 'PENDING' || trip.status === 'UPLOADING' || trip.status === 'STORED' || trip.status === 'PROCESSING') {
        reasons.push('not finalized')
        score += 25
      }
      if (trip.status === 'UPLOADED' && trip.total_samples_received < 250) {
        reasons.push('short capture')
        score += 20
      }
      if (!trip.road_surface || !trip.vehicle_type || !trip.mount_type || !trip.sampling_profile) {
        reasons.push('missing metadata')
        score += 15
      }
      if ((trip.total_chunks_expected ?? 0) > 0 && trip.total_chunks_received < trip.total_chunks_expected) {
        reasons.push('incomplete chunks')
        score += 30
      }

      return { trip, score, reasons }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.trip.created_at - a.trip.created_at)
}

function getTopDevice(trips: TripListItem[]) {
  const devices = new Map<string, { id: string; model: string; trips: number; distanceKm: number }>()
  for (const trip of trips) {
    const device = devices.get(trip.device_id) ?? {
      id: trip.device_id,
      model: trip.device_model ?? 'Unknown device',
      trips: 0,
      distanceKm: 0,
    }
    device.trips += 1
    device.distanceKm += kmFromTrip(trip)
    devices.set(trip.device_id, device)
  }
  return [...devices.values()].sort((a, b) => b.distanceKm - a.distanceKm)[0] ?? null
}

function getLongestTrip(trips: TripListItem[]) {
  return [...trips].sort((a, b) => kmFromTrip(b) - kmFromTrip(a))[0] ?? null
}

function kmFromTrip(trip: TripListItem) {
  const distance = trip.total_distance ?? 0
  return distance > 1000 ? distance / 1000 : distance
}

function conicGradient(rows: RoadAnalysisRow[], totalDistanceKm: number) {
  if (rows.length === 0 || totalDistanceKm <= 0) {
    return 'conic-gradient(hsl(var(--muted)) 0 100%)'
  }

  let cursor = 0
  const parts = rows.slice(0, 5).map((row, index) => {
    const start = cursor
    const share = (row.distance_km / totalDistanceKm) * 100
    cursor += share
    return `${SURFACE_COLORS[index % SURFACE_COLORS.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`
  })

  if (cursor < 100) {
    parts.push(`hsl(var(--muted)) ${cursor.toFixed(2)}% 100%`)
  }

  return `conic-gradient(${parts.join(', ')})`
}

function prettySurface(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}
