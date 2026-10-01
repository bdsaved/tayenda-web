import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, RotateCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ConditionBar } from '../components/condition-bar'
import { DownloadButton } from '../components/download-button'
import { MapLegend, MapView, type MapHazard } from '../components/map/map-view'
import { RoughnessChart } from '../components/roughness-chart'
import { RoutePlayback } from '../components/route-playback'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { Notice } from '../components/ui/notice'
import { StatTile } from '../components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  deleteTrip,
  downloadTripRaw,
  errorMessage,
  fetchProcessingHealth,
  fetchTrip,
  fetchTripHazards,
  fetchTripSegments,
  fetchTripTrack,
  reprocessTrip,
} from '../lib/api'
import {
  HAZARD_COLORS,
  formatCoord,
  formatDate,
  formatDistance,
  formatDuration,
  formatRoughness,
  formatSpeed,
  hazardSourceLabel,
  statusLabel,
  statusVariant,
  titleCase,
} from '../lib/format'
import { useApi } from '../lib/hooks'

export const Route = createFileRoute('/dashboard/trips_/$tripId')({
  component: TripDetailPage,
})

function TripDetailPage() {
  const { tripId } = Route.useParams()
  const navigate = useNavigate()
  const detail = useApi(() => fetchTrip(tripId), [tripId])
  const segments = useApi(() => fetchTripSegments(tripId), [tripId])
  const hazards = useApi(() => fetchTripHazards(tripId), [tripId])
  const track = useApi(() => fetchTripTrack(tripId), [tripId])
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null)
  // Thresholds for the chart; the page still works without them.
  const health = useApi(fetchProcessingHealth, [])

  const [actionNotice, setActionNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const trip = detail.data?.trip
  const notes = detail.data?.notes ?? trip?.notes ?? null
  const features = segments.data?.features ?? []
  const hazardItems = hazards.data?.items ?? []
  const mapHazards = useMemo<MapHazard[]>(
    () =>
      hazardItems.map((hazard) => ({
        id: hazard.id,
        lat: hazard.lat,
        lon: hazard.lon,
        kind: hazard.kind,
        source: hazard.source,
        tripCount: 1,
        magnitude: hazard.magnitude,
        lastSeen: hazard.ts,
        tripId: null,
      })),
    [hazardItems],
  )
  const route = track.data ?? null
  const routeTracks = useMemo(() => (route ? [route] : []), [route])
  const endpoints = route
    ? {
        start: { lon: route.properties.start[0], lat: route.properties.start[1], ts: route.properties.start_ts },
        end: { lon: route.properties.end[0], lat: route.properties.end[1], ts: route.properties.end_ts },
      }
    : null
  const routeGaps = route ? Math.max(0, route.geometry.coordinates.length - 1) : 0
  const routeMissing = !track.loading && !track.error && track.data === null
  const mapLoading = segments.loading || hazards.loading || track.loading

  async function handleReprocess() {
    setReprocessing(true)
    setActionNotice(null)
    try {
      const response = await reprocessTrip(tripId)
      setActionNotice({ tone: 'success', text: `Reprocessing queued (status: ${statusLabel(response.status)}).` })
      detail.reload()
      segments.reload()
      hazards.reload()
    } catch (error) {
      setActionNotice({ tone: 'error', text: errorMessage(error, 'Reprocess failed') })
    } finally {
      setReprocessing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTrip(tripId)
      await navigate({ to: '/dashboard/trips' })
    } catch (error) {
      setDeleting(false)
      setConfirmDelete(false)
      setActionNotice({ tone: 'error', text: errorMessage(error, 'Delete failed') })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/trips">
              <ArrowLeft className="size-4" />
              Trips
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{trip ? formatDate(trip.start_time) : 'Trip'}</h1>
              {trip ? <Badge variant={statusVariant(trip.status)}>{statusLabel(trip.status)}</Badge> : null}
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">{tripId}</p>
          </div>
        </div>
        {trip ? (
          <div className="flex flex-wrap items-center gap-2">
            <DownloadButton
              label="Download raw"
              download={() => downloadTripRaw(tripId)}
              disabled={!trip.raw_available}
              disabledReason="Raw data past retention"
              onError={(message) => setActionNotice(message ? { tone: 'error', text: message } : null)}
            />
            <Button variant="outline" size="sm" onClick={handleReprocess} disabled={reprocessing}>
              <RotateCw className={`size-4 ${reprocessing ? 'animate-spin' : ''}`} />
              Reprocess
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive">
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {detail.error ? <Notice tone="error">{detail.error}</Notice> : null}
      {actionNotice ? <Notice tone={actionNotice.tone}>{actionNotice.text}</Notice> : null}
      {notes ? (
        <Notice tone={trip?.status === 'FAILED' ? 'error' : 'info'}>
          <span className="font-medium">Processing notes: </span>
          {notes}
        </Notice>
      ) : null}

      {trip ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatTile label="Distance" value={formatDistance(trip.total_distance)} />
            <StatTile label="Avg speed" value={formatSpeed(trip.avg_speed)} />
            <StatTile label="Avg roughness" value={formatRoughness(trip.roughness_avg)} />
            <StatTile
              label="Hazards"
              value={(trip.hazard_count + trip.tag_count).toLocaleString()}
              hint={`${trip.hazard_count} detected · ${trip.tag_count} tagged`}
            />
            <StatTile label="Samples" value={trip.total_samples_received.toLocaleString()} hint={`${trip.total_chunks_received}/${Math.max(trip.total_chunks_expected, 1)} chunks`} />
          </div>

          <div className="flat-panel px-4 py-3.5">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Condition along this trip</h2>
            {trip.good_m + trip.fair_m + trip.poor_m > 0 ? (
              <ConditionBar good={trip.good_m} fair={trip.fair_m} poor={trip.poor_m} unit="m" showLegend barClassName="h-3" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {trip.processed_at ? 'No mapped segments (no usable GPS/speed data).' : 'Not processed yet.'}
              </p>
            )}
          </div>
        </>
      ) : !detail.error ? (
        <p className="text-sm text-muted-foreground">Loading trip...</p>
      ) : null}

      <div className="flat-panel overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Route</h2>
          {route ? (
            <p className="text-sm tabular-nums text-muted-foreground">
              <span className="text-foreground">{formatDate(route.properties.start_ts)}</span>
              {' → '}
              <span className="text-foreground">{formatDate(route.properties.end_ts)}</span>
              {' · '}
              {formatDuration(route.properties.duration_s)}
              {' · '}
              {formatDistance(route.properties.distance_m)}
              {routeGaps > 0 ? ` · ${routeGaps} recording gap${routeGaps === 1 ? '' : 's'}` : ''}
            </p>
          ) : null}
        </div>
        {segments.error ? <Notice tone="error" className="m-4">{segments.error}</Notice> : null}
        {track.error ? <Notice tone="error" className="m-4">Route: {track.error}</Notice> : null}
        {routeMissing ? (
          <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
            Full route unavailable (raw data past retention). Showing scored segments only.
          </p>
        ) : null}
        <MapView
          segments={features}
          hazards={mapHazards}
          tracks={routeTracks}
          endpoints={endpoints}
          cursor={cursor}
          fitKey={mapLoading ? undefined : `${features.length}|${mapHazards.length}|${route ? 1 : 0}`}
          className="h-[420px] w-full"
        />
        {route?.properties.timestamps ? (
          <div className="border-t border-border px-4 py-3">
            <RoutePlayback track={route} onCursor={setCursor} />
          </div>
        ) : null}
        <div className="border-t border-border px-4 py-2.5">
          <MapLegend showRoute={Boolean(route)} />
        </div>
      </div>

      <div className="flat-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Roughness along trip</h2>
          <p className="text-sm text-muted-foreground">
            RMS vertical acceleration per segment vs distance from start. Dashed lines are the FAIR/POOR thresholds.
          </p>
        </div>
        <div className="px-4 py-3">
          {segments.loading && !segments.data ? (
            <p className="py-6 text-sm text-muted-foreground">Loading segments...</p>
          ) : (
            <RoughnessChart
              segments={features}
              fairThreshold={health.data?.roughness_fair}
              poorThreshold={health.data?.roughness_poor}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flat-panel min-w-0 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Hazards on this trip</h2>
          </div>
          {hazards.error ? <Notice tone="error" className="m-4">{hazards.error}</Notice> : null}
          {hazardItems.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">{hazards.loading ? 'Loading...' : 'No hazards on this trip.'}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Magnitude</TableHead>
                  <TableHead className="text-right">Speed</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hazardItems.map((hazard) => (
                  <TableRow key={`${hazard.source}-${hazard.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(hazard.ts)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`size-2.5 border border-white shadow ${hazard.source === 'tagged' ? 'rotate-45 rounded-[1px]' : 'rounded-full'}`}
                          style={{ background: HAZARD_COLORS[hazard.source] ?? HAZARD_COLORS.detected }}
                        />
                        <span className="font-medium text-foreground">{titleCase(hazard.kind)}</span>
                      </span>
                      <p className="text-xs text-muted-foreground">{hazardSourceLabel(hazard.source)}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {hazard.magnitude != null ? `${hazard.magnitude.toFixed(1)} m/s²` : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatSpeed(hazard.speed)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        to="/dashboard/map"
                        search={{ lat: hazard.lat, lon: hazard.lon, z: 18 }}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {formatCoord(hazard.lat, hazard.lon)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {trip ? (
          <div className="flat-panel min-w-0 p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">Details</h2>
            <dl className="space-y-2.5">
              <DetailRow label="Device" value={trip.device_model ?? '—'} />
              <DetailRow label="Device ID" value={trip.device_id} mono />
              <DetailRow label="Operator" value={trip.operator_name ?? '—'} />
              <DetailRow label="Upload source" value={trip.upload_source} />
              <DetailRow label="Vehicle" value={titleCase(trip.vehicle_type)} />
              <DetailRow label="Mount" value={titleCase(trip.mount_type)} />
              <DetailRow label="Road surface (declared)" value={titleCase(trip.road_surface)} />
              <DetailRow label="Sampling profile" value={titleCase(trip.sampling_profile)} />
              <DetailRow label="Mount quality" value={trip.mount_quality != null ? trip.mount_quality.toFixed(2) : '—'} />
              <DetailRow label="Started" value={formatDate(trip.start_time)} />
              <DetailRow label="Ended" value={formatDate(trip.end_time)} />
              <DetailRow label="Received" value={formatDate(trip.created_at)} />
              <DetailRow label="Finalized" value={formatDate(trip.finalized_at)} />
              <DetailRow label="Processed" value={formatDate(trip.processed_at)} />
              <DetailRow label="Server trip ID" value={trip.server_trip_id} mono />
            </dl>

            {detail.data?.quality_flags && Object.keys(detail.data.quality_flags).length > 0 ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Quality flags</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs text-foreground">
                  {JSON.stringify(detail.data.quality_flags, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this trip?"
        description="This permanently deletes the trip and its processed segments and hazards from the server. It cannot be undone."
        confirmLabel="Delete trip"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`break-all text-right text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
