import { createFileRoute } from '@tanstack/react-router'
import { ChartColumnIncreasing, Layers, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchTrips, type TripListItem } from '../lib/api'

export const Route = createFileRoute('/dashboard/map')({
  component: CoveragePage,
})

function CoveragePage() {
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchTrips()
      .then((response) => {
        if (cancelled) return
        setTrips(response.items)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load coverage data')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const bySurface = countTrips(trips, (trip) => trip.road_surface ?? 'UNSPECIFIED')
  const bySource = countTrips(trips, (trip) => trip.upload_source)

  return (
    <div className="section-enter space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="w-fit">Coverage</Badge>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Upload coverage snapshot
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            This view uses real uploaded trips to show where collection is coming from and which
            road-surface groups are represented in the shared dataset.
          </p>
        </div>
        <Badge variant="secondary">{trips.length} trips loaded</Badge>
      </div>

      {error ? (
        <Card className="border-rose-300">
          <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="min-h-[440px]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              <CardTitle>Coverage board</CardTitle>
            </div>
            <CardDescription>
              Flat placeholder for the future map layer, already fed by real upload totals.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid h-full gap-4">
            <div className="grid-dots flex min-h-[260px] items-center justify-center border border-border bg-secondary/30 p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto inline-flex border border-border bg-card p-3">
                  <Layers className="size-5 text-primary" />
                </div>
                <p className="mt-4 text-lg font-semibold text-foreground">Map layer ready for live data</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The API now exposes shared trip records for mobile sync and manual web upload.
                  Plugging in MapLibre or Leaflet can happen without changing the storage contract.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile label="Uploaded trips" value={String(trips.filter((trip) => trip.status === 'UPLOADED').length)} />
              <MetricTile label="Mobile sources" value={String(trips.filter((trip) => trip.upload_source === 'mobile').length)} />
              <MetricTile label="Web sources" value={String(trips.filter((trip) => trip.upload_source === 'web').length)} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ChartColumnIncreasing className="size-4 text-primary" />
                <CardTitle>Road surfaces</CardTitle>
              </div>
              <CardDescription>Trip counts grouped from live metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bySurface.length === 0 ? (
                <p className="text-sm text-muted-foreground">No uploaded trips yet.</p>
              ) : (
                bySurface.map(([label, count]) => (
                  <Row key={label} label={label} value={count} total={trips.length} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload source mix</CardTitle>
              <CardDescription>Shared pipeline split between mobile and web.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No source data available.</p>
              ) : (
                bySource.map(([label, count]) => (
                  <Row key={label} label={label} value={count} total={trips.length} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function Row({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total > 0 ? Math.max(8, Math.round((value / total) * 100)) : 0

  return (
    <div className="border border-border bg-secondary/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </div>
      <div className="mt-3 h-2 border border-border bg-background">
        <div className="h-full bg-primary" style={{ width: `${width}%` }} />
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
