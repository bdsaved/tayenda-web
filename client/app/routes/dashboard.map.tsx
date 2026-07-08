import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { StatTile } from '../components/ui/stat-tile'
import {
  fetchProcessingHealth,
  fetchRoadTraces,
  fetchTrips,
  type ProcessingHealthResponse,
  type TracePoint,
  type TripListItem,
  type TripTrace,
} from '../lib/api'
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
      <PageHeader
        title="Coverage"
        description="Collected distance, GPS traces, road surfaces, and vehicle groups."
        actions={<Badge variant="secondary">{uploaded}/{trips.length} finalized</Badge>}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Distance" value={formatDistance(totalDistance)} />
        <StatTile label="Surface groups" value={String(bySurface.length)} />
        <StatTile label="Vehicle groups" value={String(byVehicle.length)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="flat-panel p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">Coverage map</h2>
            <p className="text-sm text-muted-foreground">OpenStreetMap basemap with downsampled uploaded GPS traces.</p>
          </div>
          <TraceMap traces={traces} />
        </div>

        <div className="space-y-4">
          <Distribution title="Road surfaces" rows={bySurface} total={trips.length} />
          <Distribution title="Vehicle groups" rows={byVehicle} total={trips.length} />

          <div className="flat-panel">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">Processing health</h2>
            </div>
            <div className="px-4 py-3 text-sm text-muted-foreground">
              {processingHealth ? (
                <dl className="space-y-1.5">
                  <HealthRow label="Status" value={processingHealth.status} />
                  <HealthRow label="Interval" value={`${processingHealth.interval_seconds}s`} />
                  <HealthRow label="Processed last run" value={String(processingHealth.processed_trips_last_run)} />
                  <HealthRow label="Cleaned raw files" value={String(processingHealth.cleaned_files_last_run)} />
                  <HealthRow
                    label="Next run"
                    value={processingHealth.next_run_at ? formatDate(processingHealth.next_run_at) : 'N/A'}
                  />
                </dl>
              ) : (
                'Processing health not available.'
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  )
}

const MAP_WIDTH = 1000
const MAP_HEIGHT = 520
const TILE_SIZE = 256
const MIN_ZOOM = 4
const MAX_ZOOM = 17
const DEFAULT_CENTER = { lat: -13.2543, lon: 34.3015 }

type ProjectedPoint = {
  x: number
  y: number
}

type MapTile = {
  key: string
  x: number
  y: number
  url: string
}

function TraceMap({ traces }: { traces: TripTrace[] }) {
  const validTraces = useMemo(
    () =>
      traces
        .map((trace) => ({
          ...trace,
          points: trace.points.filter(isValidPoint),
        }))
        .filter((trace) => trace.points.length > 0),
    [traces],
  )
  const points = useMemo(() => validTraces.flatMap((trace) => trace.points), [validTraces])
  const fittedZoom = useMemo(() => fitZoom(points), [points])
  const center = useMemo(() => getMapCenter(points), [points])
  const [zoomOffset, setZoomOffset] = useState(0)

  useEffect(() => {
    setZoomOffset(0)
  }, [fittedZoom, validTraces.length])

  const zoom = clamp(fittedZoom + zoomOffset, MIN_ZOOM, MAX_ZOOM)
  const centerPoint = projectMercator(center, zoom)
  const view = {
    minX: centerPoint.x - MAP_WIDTH / 2,
    minY: centerPoint.y - MAP_HEIGHT / 2,
  }
  const tiles = getVisibleTiles(view.minX, view.minY, MAP_WIDTH, MAP_HEIGHT, zoom)

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-muted">
      <svg
        viewBox={`${view.minX} ${view.minY} ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="h-[360px] w-full sm:h-[430px]"
        role="img"
        aria-label="Coverage map with uploaded road traces"
      >
        <rect x={view.minX} y={view.minY} width={MAP_WIDTH} height={MAP_HEIGHT} fill="hsl(var(--muted))" />
        {tiles.map((tile) => (
          <image
            key={tile.key}
            href={tile.url}
            x={tile.x}
            y={tile.y}
            width={TILE_SIZE}
            height={TILE_SIZE}
            preserveAspectRatio="none"
          />
        ))}
        <rect
          x={view.minX}
          y={view.minY}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          fill="hsl(var(--background))"
          opacity="0.08"
        />
        {validTraces.map((trace, idx) => {
          const poly = trace.points
            .map((point) => {
              const projected = projectMercator(point, zoom)
              return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`
            })
            .join(' ')
          return (
            <polyline
              key={trace.trip_id}
              points={poly}
              fill="none"
              stroke={traceColor(trace.road_surface, idx)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.95"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
        {points.length > 0 ? (
          <circle
            cx={projectMercator(points[0], zoom).x}
            cy={projectMercator(points[0], zoom).y}
            r="5"
            fill="hsl(150 93% 28%)"
            stroke="white"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      <div className="absolute left-3 top-3 rounded-md border border-border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <p className="font-medium text-foreground">{validTraces.length} uploaded trace{validTraces.length === 1 ? '' : 's'}</p>
        <p className="text-muted-foreground">Zoom {zoom}</p>
      </div>

      <div className="absolute right-3 top-3 flex overflow-hidden rounded-md border border-border bg-background/90 shadow-sm backdrop-blur">
        <button
          type="button"
          className="px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          onClick={() => setZoomOffset((current) => current + 1)}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="border-l border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          onClick={() => setZoomOffset((current) => current - 1)}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          className="border-l border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
          onClick={() => setZoomOffset(0)}
        >
          Fit
        </button>
      </div>

      {validTraces.length === 0 ? (
        <div className="absolute inset-x-4 bottom-12 rounded-md border border-border bg-background/95 px-4 py-3 text-sm text-muted-foreground shadow-sm">
          No uploaded GPS traces yet. The basemap is shown for Malawi; finalized mobile trips will draw here after processing.
        </div>
      ) : null}

      <div className="absolute bottom-2 right-2 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">
        Map data {' '}
        <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>
      </div>
    </div>
  )
}

function isValidPoint(point: TracePoint) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -85 &&
    point.lat <= 85 &&
    point.lon >= -180 &&
    point.lon <= 180
  )
}

function getMapCenter(points: TracePoint[]) {
  if (points.length === 0) return DEFAULT_CENTER
  const lats = points.map((point) => point.lat)
  const lons = points.map((point) => point.lon)
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
  }
}

function fitZoom(points: TracePoint[]) {
  if (points.length <= 1) return 11

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const projected = points.map((point) => projectMercator(point, zoom))
    const spanX = Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x))
    const spanY = Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y))

    if (spanX <= MAP_WIDTH * 0.78 && spanY <= MAP_HEIGHT * 0.78) {
      return zoom
    }
  }

  return MIN_ZOOM
}

function projectMercator(point: TracePoint, zoom: number): ProjectedPoint {
  const lat = clamp(point.lat, -85, 85)
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const scale = TILE_SIZE * 2 ** zoom

  return {
    x: ((point.lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  }
}

function getVisibleTiles(minX: number, minY: number, width: number, height: number, zoom: number): MapTile[] {
  const maxTile = 2 ** zoom
  const startX = Math.floor(minX / TILE_SIZE)
  const endX = Math.floor((minX + width) / TILE_SIZE)
  const startY = clamp(Math.floor(minY / TILE_SIZE), 0, maxTile - 1)
  const endY = clamp(Math.floor((minY + height) / TILE_SIZE), 0, maxTile - 1)
  const tiles: MapTile[] = []

  for (let tileX = startX; tileX <= endX; tileX += 1) {
    for (let tileY = startY; tileY <= endY; tileY += 1) {
      const wrappedX = wrapTile(tileX, maxTile)
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        x: tileX * TILE_SIZE,
        y: tileY * TILE_SIZE,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
      })
    }
  }

  return tiles
}

function wrapTile(tileX: number, maxTile: number) {
  return ((tileX % maxTile) + maxTile) % maxTile
}

function traceColor(surface: string, index: number) {
  const key = surface.toUpperCase()
  if (key.includes('PAVED')) return 'hsl(150 93% 28%)'
  if (key.includes('GRAVEL')) return 'hsl(32 95% 44%)'
  if (key.includes('DIRT')) return 'hsl(18 72% 43%)'
  if (key.includes('MIXED')) return 'hsl(205 85% 42%)'
  const fallback = ['hsl(150 93% 28%)', 'hsl(205 85% 42%)', 'hsl(32 95% 44%)']
  return fallback[index % fallback.length]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function Distribution({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div className="flat-panel">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-3 px-4 py-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : null}
        {rows.map(([label, count]) => (
          <div key={label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">{label}</p>
              <p className="text-sm tabular-nums text-muted-foreground">{count}</p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
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
