import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

import { ConditionBar } from '../components/condition-bar'
import { Badge } from '../components/ui/badge'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { StatTile } from '../components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { fetchHazardClusters, fetchSummary, fetchTrips } from '../lib/api'
import {
  formatCoord,
  formatDate,
  formatDistance,
  formatKm,
  formatPercent,
  formatRelative,
  hazardSourceLabel,
  statusLabel,
  statusVariant,
  titleCase,
} from '../lib/format'
import { useApi } from '../lib/hooks'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
})

function DashboardOverview() {
  const summary = useApi(fetchSummary, [])
  const trips = useApi(() => fetchTrips({ limit: 8 }), [])
  const hazards = useApi(() => fetchHazardClusters({ limit: 5 }), [])

  const s = summary.data
  const hazardTotal = s ? s.hazards_detected + s.hazards_tagged : 0
  const error = summary.error ?? trips.error ?? hazards.error

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description={
          s?.last_upload_at ? `Last upload ${formatRelative(s.last_upload_at)} (${formatDate(s.last_upload_at)}).` : 'Road condition across the mapped network.'
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Trips" value={s ? s.trips_total.toLocaleString() : '—'} hint={s ? `${s.trips_processed.toLocaleString()} processed` : undefined} />
        <StatTile label="Mapped" value={s ? formatKm(s.mapped_km) : '—'} hint={s ? `of ${formatKm(s.distance_km)} driven` : undefined} tone="primary" />
        <StatTile
          label="Poor road"
          value={s ? formatPercent(s.poor_km, s.mapped_km) : '—'}
          hint={s ? `${formatKm(s.poor_km)} of mapped` : undefined}
          tone={s && s.poor_km > 0 ? 'destructive' : 'default'}
        />
        <StatTile
          label="Hazards"
          value={s ? hazardTotal.toLocaleString() : '—'}
          hint={s ? `${s.hazards_detected.toLocaleString()} detected · ${s.hazards_tagged.toLocaleString()} tagged` : undefined}
        />
        <StatTile label="Devices" value={s ? s.devices_total.toLocaleString() : '—'} />
        <StatTile
          label="Uploads needing attention"
          value={s ? `${s.trips_pending} / ${s.trips_failed}` : '—'}
          hint="pending / failed"
          tone={s && s.trips_failed > 0 ? 'destructive' : s && s.trips_pending > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="flat-panel px-4 py-3.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Condition of mapped road</h2>
          <Link to="/dashboard/map" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Open map <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {s && s.mapped_km > 0 ? (
          <ConditionBar good={s.good_km} fair={s.fair_km} poor={s.poor_km} showLegend barClassName="h-3" />
        ) : (
          <p className="text-sm text-muted-foreground">{summary.loading ? 'Loading...' : 'No processed road segments yet.'}</p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flat-panel min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Recent trips</h2>
            <Link to="/dashboard/trips" className="text-sm font-medium text-primary hover:underline">
              All trips
            </Link>
          </div>
          {trips.loading && !trips.data ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading trips...</p>
          ) : !trips.data || trips.data.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No trips uploaded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Start</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.data.items.map((trip) => (
                  <TableRow key={trip.trip_id}>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        to="/dashboard/trips/$tripId"
                        params={{ tripId: trip.trip_id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {formatDate(trip.start_time)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{trip.device_model ?? 'Unknown device'}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatDistance(trip.total_distance)}</TableCell>
                    <TableCell>
                      <ConditionBar good={trip.good_m} fair={trip.fair_m} poor={trip.poor_m} unit="m" />
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(trip.status)}>{statusLabel(trip.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flat-panel min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Most-confirmed hazards</h2>
            <Link to="/dashboard/hazards" className="text-sm font-medium text-primary hover:underline">
              All hazards
            </Link>
          </div>
          <div className="divide-y divide-border">
            {hazards.loading && !hazards.data ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading hazards...</p>
            ) : !hazards.data || hazards.data.items.length === 0 ? (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <p className="text-sm text-muted-foreground">No hazards recorded yet.</p>
              </div>
            ) : (
              hazards.data.items.slice(0, 5).map((hazard) => (
                <div key={`${hazard.source}-${hazard.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {titleCase(hazard.kind)}{' '}
                      <span className="font-normal text-muted-foreground">· {hazardSourceLabel(hazard.source)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hazard.trip_count} trip{hazard.trip_count === 1 ? '' : 's'} · last {formatRelative(hazard.last_seen)} ·{' '}
                      <span className="font-mono">{formatCoord(hazard.lat, hazard.lon)}</span>
                    </p>
                  </div>
                  <Link
                    to="/dashboard/map"
                    search={{ lat: hazard.lat, lon: hazard.lon, z: 17 }}
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    Map
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
