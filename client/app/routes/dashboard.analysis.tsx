import { createFileRoute } from '@tanstack/react-router'
import { BarChart3, Route as RouteIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchRoadsAnalysis, type RoadAnalysisRow } from '../lib/api'

export const Route = createFileRoute('/dashboard/analysis')({
  component: RoadAnalysisPage,
})

function RoadAnalysisPage() {
  const [rows, setRows] = useState<RoadAnalysisRow[]>([])
  const [totalTrips, setTotalTrips] = useState(0)
  const [totalDistanceKm, setTotalDistanceKm] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRoadsAnalysis()
      .then((response) => {
        setRows(response.rows)
        setTotalTrips(response.total_trips)
        setTotalDistanceKm(response.total_distance_km)
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load road analysis')
      })
  }, [])

  const topSurface = useMemo(() => rows[0]?.road_surface ?? 'N/A', [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge>Analysis</Badge>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Recorded roads</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Aggregated server-side summary of road surfaces captured by field trips.
          </p>
        </div>
        <Badge variant="secondary">Top surface: {topSurface}</Badge>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-4 text-sm text-foreground">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Total trips" value={String(totalTrips)} />
        <Metric title="Distance" value={`${totalDistanceKm.toFixed(1)} km`} />
        <Metric title="Surface groups" value={String(rows.length)} />
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RouteIcon className="size-4" />
            <CardTitle>Road surface distribution</CardTitle>
          </div>
          <CardDescription>Distance and sample volume grouped by road type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No road data yet.</p> : null}
          {rows.map((row) => {
            const width = totalDistanceKm > 0 ? Math.max(8, Math.round((row.distance_km / totalDistanceKm) * 100)) : 0
            return (
              <div key={row.road_surface} className="border border-border bg-secondary/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{prettySurface(row.road_surface)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.trips} trips • {row.samples.toLocaleString()} samples</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{row.distance_km.toFixed(1)} km</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full border border-border bg-secondary">
                  <div className="brand-gradient h-full rounded-full transition-[width] duration-700" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            <CardTitle>How it works</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          Data is aggregated on the server from the stored trip metadata. This is a light, fast analysis view that can
          later be expanded with route-level geo segments and map overlays.
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card className="glass-panel">
      <CardContent className="pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function prettySurface(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}
