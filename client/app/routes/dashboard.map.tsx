import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { MapLegend, MapView, type MapHazard } from '../components/map/map-view'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { Select } from '../components/ui/select'
import { fetchHazardClusters, fetchSegments, fetchTracks } from '../lib/api'
import { RANGE_OPTIONS, type RangeKey, formatDistance, rangeSince } from '../lib/format'
import { useApi } from '../lib/hooks'

type MapSearch = { lat?: number; lon?: number; z?: number }

function toNumber(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) ? number : undefined
}

export const Route = createFileRoute('/dashboard/map')({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    lat: toNumber(search.lat),
    lon: toNumber(search.lon),
    z: toNumber(search.z),
  }),
  component: MapPage,
})

const SEGMENT_LIMIT = 20000
const TRACK_LIMIT = 50

function MapPage() {
  const { lat, lon, z } = Route.useSearch()
  const [range, setRange] = useState<RangeKey>('all')
  const [condition, setCondition] = useState('')
  const [showHazards, setShowHazards] = useState(true)
  const [showRoutes, setShowRoutes] = useState(false)

  // Recompute `since` only when the range changes so it is stable across renders.
  const since = useMemo(() => rangeSince(range), [range])
  const segments = useApi(() => fetchSegments({ since, condition: condition || undefined, limit: SEGMENT_LIMIT }), [since, condition])
  const hazards = useApi(() => fetchHazardClusters({ since, limit: 500 }), [since])
  // Routes are opt-in: only fetched while the layer is switched on.
  const routes = useApi(
    () => (showRoutes ? fetchTracks({ since, limit: TRACK_LIMIT }) : Promise.resolve(null)),
    [showRoutes, since],
  )
  const tracks = (showRoutes && routes.data?.features) || []

  const features = segments.data?.features ?? []
  const mapHazards = useMemo<MapHazard[]>(
    () =>
      (hazards.data?.items ?? []).map((cluster) => ({
        id: cluster.id,
        lat: cluster.lat,
        lon: cluster.lon,
        kind: cluster.kind,
        source: cluster.source,
        tripCount: cluster.trip_count,
        observations: cluster.observations,
        magnitude: cluster.max_magnitude,
        lastSeen: cluster.last_seen,
        tripId: cluster.trip_ids[0] ?? null,
      })),
    [hazards.data],
  )
  const mappedMetres = useMemo(() => features.reduce((sum, f) => sum + (f.properties.length_m ?? 0), 0), [features])
  const center: [number, number] | null = lat != null && lon != null ? [lat, lon] : null
  const loading = segments.loading || hazards.loading
  // Refit once both layers have loaded for the current filters.
  const fitKey = loading ? undefined : `${range}|${condition}|${features.length}|${mapHazards.length}`

  return (
    <div className="space-y-4">
      <PageHeader
        title="Road condition map"
        description="Each ~50 m segment is coloured by measured roughness. Click a segment or hazard for details."
      />

      {segments.error ? <Notice tone="error">{segments.error}</Notice> : null}
      {hazards.error ? <Notice tone="error">Hazards: {hazards.error}</Notice> : null}
      {showRoutes && routes.error ? <Notice tone="error">Routes: {routes.error}</Notice> : null}
      {features.length >= SEGMENT_LIMIT ? (
        <Notice tone="warning">
          Showing the first {SEGMENT_LIMIT.toLocaleString()} segments. Narrow the date range or condition to see the rest.
        </Notice>
      ) : null}

      <div className="flat-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <Select value={range} onChange={(event) => setRange(event.target.value as RangeKey)} className="w-auto" aria-label="Date range">
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select value={condition} onChange={(event) => setCondition(event.target.value)} className="w-auto" aria-label="Condition">
            <option value="">All conditions</option>
            <option value="GOOD">Good only</option>
            <option value="FAIR">Fair only</option>
            <option value="POOR">Poor only</option>
          </Select>
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={showHazards}
              onChange={(event) => setShowHazards(event.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Show hazards
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={showRoutes}
              onChange={(event) => setShowRoutes(event.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Routes
            {showRoutes && routes.loading ? <span className="text-muted-foreground">(loading)</span> : null}
            {showRoutes && !routes.loading && tracks.length >= TRACK_LIMIT ? (
              <span className="text-muted-foreground">(latest {TRACK_LIMIT})</span>
            ) : null}
          </label>
          <p className="ml-auto text-sm text-muted-foreground tabular-nums">
            {loading
              ? 'Loading...'
              : `${features.length.toLocaleString()} segments · ${formatDistance(mappedMetres)}${showHazards ? ` · ${mapHazards.length} hazards` : ''}`}
          </p>
        </div>

        <MapView
          segments={features}
          hazards={showHazards ? mapHazards : []}
          tracks={tracks}
          tracksInteractive
          center={center}
          zoom={z}
          fitKey={fitKey}
          className="h-[60vh] min-h-[360px] w-full"
        />

        <div className="border-t border-border px-4 py-2.5">
          <MapLegend showHazards={showHazards} showRoute={showRoutes} />
        </div>
      </div>

      {!loading && features.length === 0 && !segments.error ? (
        <Notice>No processed road segments in this range yet. Trips appear here once the server has processed them.</Notice>
      ) : null}
    </div>
  )
}
