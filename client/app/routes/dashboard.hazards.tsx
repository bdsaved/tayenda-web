import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DownloadButton } from '../components/download-button'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { Select } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { exportHazardsCsv, fetchHazardClusters, fetchTrips, type TripListItem } from '../lib/api'
import {
  HAZARD_COLORS,
  HAZARD_KINDS,
  RANGE_OPTIONS,
  type RangeKey,
  formatCoord,
  formatDate,
  formatRelative,
  hazardSourceLabel,
  rangeSince,
  statusLabel,
  statusVariant,
  titleCase,
} from '../lib/format'
import { useApi } from '../lib/hooks'

export const Route = createFileRoute('/dashboard/hazards')({
  component: HazardsPage,
})

const DAY_MS = 24 * 60 * 60 * 1000

function HazardsPage() {
  const [source, setSource] = useState('')
  const [kind, setKind] = useState('')
  const [range, setRange] = useState<RangeKey>('all')
  const [exportError, setExportError] = useState<string | null>(null)

  const since = useMemo(() => rangeSince(range), [range])
  const filters = { source: source || undefined, kind: kind || undefined, since }
  const hazards = useApi(() => fetchHazardClusters({ ...filters, limit: 500 }), [source, kind, since])
  const items = hazards.data?.items ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hazards"
        description="Detected jolts and driver-tagged hazards, clustered by location. Most-confirmed first."
        actions={<DownloadButton label="Export CSV" download={() => exportHazardsCsv(filters)} onError={setExportError} />}
      />

      {hazards.error ? <Notice tone="error">{hazards.error}</Notice> : null}
      {exportError ? <Notice tone="error">{exportError}</Notice> : null}

      <div className="flat-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <Select value={source} onChange={(event) => setSource(event.target.value)} className="w-auto" aria-label="Source">
            <option value="">All sources</option>
            <option value="detected">Detected</option>
            <option value="tagged">Driver tagged</option>
          </Select>
          <Select value={kind} onChange={(event) => setKind(event.target.value)} className="w-auto" aria-label="Kind">
            <option value="">All kinds</option>
            {HAZARD_KINDS.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </Select>
          <Select value={range} onChange={(event) => setRange(event.target.value as RangeKey)} className="w-auto" aria-label="Date range">
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="ml-auto text-sm text-muted-foreground">
            {hazards.loading ? 'Loading...' : `${items.length.toLocaleString()} cluster${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {hazards.loading && !hazards.data ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Loading hazards...</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No hazards match these filters"
            description="Jolts detected by the processor and hazards tagged by drivers appear here."
            className="m-4"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Confirmations</TableHead>
                <TableHead className="text-right">Max magnitude</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((hazard, index) => (
                <TableRow key={`${hazard.source}-${hazard.id}`}>
                  <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium text-foreground">{titleCase(hazard.kind)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                      <span
                        className={`size-2.5 border border-white shadow ${hazard.source === 'tagged' ? 'rotate-45 rounded-[1px]' : 'rounded-full'}`}
                        style={{ background: HAZARD_COLORS[hazard.source] ?? HAZARD_COLORS.detected }}
                      />
                      {hazardSourceLabel(hazard.source)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium text-foreground">{hazard.trip_count}</span>
                    <span className="text-muted-foreground"> trip{hazard.trip_count === 1 ? '' : 's'}</span>
                    {hazard.observations !== hazard.trip_count ? (
                      <p className="text-xs text-muted-foreground">{hazard.observations} observations</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {hazard.max_magnitude != null ? `${hazard.max_magnitude.toFixed(1)} m/s²` : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="text-foreground">{formatRelative(hazard.last_seen)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(hazard.last_seen)}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="font-mono text-xs text-muted-foreground">{formatCoord(hazard.lat, hazard.lon)}</p>
                    <Link
                      to="/dashboard/map"
                      search={{ lat: hazard.lat, lon: hazard.lon, z: 17 }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View on map
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <UploadIssues />
    </div>
  )
}

function UploadIssues() {
  const issues = useApi(async () => {
    const cutoff = Date.now() - DAY_MS
    const [failed, pending, uploading] = await Promise.all([
      fetchTrips({ status: 'FAILED', limit: 50 }),
      fetchTrips({ status: 'PENDING', until: cutoff, limit: 50 }),
      fetchTrips({ status: 'UPLOADING', until: cutoff, limit: 50 }),
    ])
    const stuck = [...pending.items, ...uploading.items].filter((trip) => trip.created_at < cutoff)
    return {
      rows: [...failed.items, ...stuck].sort((a, b) => b.created_at - a.created_at),
      failedTotal: failed.total,
    }
  }, [])

  const rows: TripListItem[] = issues.data?.rows ?? []

  return (
    <div className="flat-panel overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Upload issues</h2>
        <p className="text-sm text-muted-foreground">Failed trips and uploads stuck incomplete for more than 24 hours.</p>
      </div>
      {issues.error ? <Notice tone="error" className="m-4">{issues.error}</Notice> : null}
      {issues.loading && !issues.data ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2.5 px-4 py-4">
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          <p className="text-sm text-muted-foreground">No upload issues.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Trip</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((trip) => (
              <TableRow key={trip.trip_id}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    to="/dashboard/trips/$tripId"
                    params={{ tripId: trip.trip_id }}
                    className="font-mono text-xs font-medium text-primary hover:underline"
                  >
                    {trip.trip_id}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatDate(trip.created_at)}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{trip.device_model ?? trip.device_id}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {trip.total_chunks_received}/{Math.max(trip.total_chunks_expected, 1)} chunks
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(trip.status)}>{statusLabel(trip.status)}</Badge>
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {trip.notes ? (
                    <span className="inline-flex gap-1.5">
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                      {trip.notes}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
