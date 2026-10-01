import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ConditionBar } from '../components/condition-bar'
import { DownloadButton } from '../components/download-button'
import { EmptyState } from '../components/ui/empty-state'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { StatTile } from '../components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { exportSegmentsGeojson, fetchRoadsAnalysis } from '../lib/api'
import { formatKm, formatPercent, formatRoughness, titleCase } from '../lib/format'
import { useApi } from '../lib/hooks'

export const Route = createFileRoute('/dashboard/analysis')({
  component: AnalysisPage,
})

function AnalysisPage() {
  const roads = useApi(fetchRoadsAnalysis, [])
  const [exportError, setExportError] = useState<string | null>(null)

  const rows = roads.data?.rows ?? []
  const mapped = rows.reduce((sum, row) => sum + row.mapped_km, 0)
  const poor = rows.reduce((sum, row) => sum + row.poor_km, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analysis"
        description="Measured road condition grouped by the surface type drivers declared for each trip."
        actions={
          <DownloadButton label="Export segments (GeoJSON)" download={() => exportSegmentsGeojson()} onError={setExportError} />
        }
      />

      {roads.error ? <Notice tone="error">{roads.error}</Notice> : null}
      {exportError ? <Notice tone="error">{exportError}</Notice> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Trips" value={roads.data ? roads.data.total_trips.toLocaleString() : '—'} />
        <StatTile label="Distance driven" value={roads.data ? formatKm(roads.data.total_distance_km) : '—'} />
        <StatTile label="Mapped" value={roads.data ? formatKm(mapped) : '—'} tone="primary" />
        <StatTile
          label="Poor share"
          value={roads.data ? formatPercent(poor, mapped) : '—'}
          hint={roads.data ? `${formatKm(poor)} poor` : undefined}
          tone={poor > 0 ? 'destructive' : 'default'}
        />
      </div>

      {roads.loading && !roads.data ? (
        <p className="text-sm text-muted-foreground">Loading analysis...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No trips to analyse yet" description="Per-surface condition appears once trips have been processed." />
      ) : (
        <div className="flat-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Road surface</TableHead>
                <TableHead className="text-right">Trips</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead className="text-right">Mapped</TableHead>
                <TableHead className="text-right">Avg roughness</TableHead>
                <TableHead className="text-right">Good</TableHead>
                <TableHead className="text-right">Fair</TableHead>
                <TableHead className="text-right">Poor</TableHead>
                <TableHead className="min-w-[140px]">Condition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.road_surface}>
                  <TableCell className="font-medium text-foreground">{titleCase(row.road_surface)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.trips.toLocaleString()}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatKm(row.distance_km)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatKm(row.mapped_km)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatRoughness(row.avg_roughness)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatKm(row.good_km)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatKm(row.fair_km)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatKm(row.poor_km)}</TableCell>
                  <TableCell>
                    <ConditionBar good={row.good_km} fair={row.fair_km} poor={row.poor_km} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Surface is what the driver selected before the trip; condition comes from measured roughness per ~50 m segment.
      </p>
    </div>
  )
}
