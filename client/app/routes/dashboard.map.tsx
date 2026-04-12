import { createFileRoute } from '@tanstack/react-router'
import { Filter, Info, Layers, MapPin } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

export const Route = createFileRoute('/dashboard/map')({
  component: RoadMapComponent,
})

function RoadMapComponent() {
  return (
    <div className="section-enter flex h-full flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="w-fit">Corridor map</Badge>
          <h2 className="mt-3 font-display text-4xl text-foreground">Malawi road network</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Spatial view of current survey coverage, hazard density, and route quality.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline">
            <Filter className="size-4" />
            Filter data
          </Button>
          <Button>
            <Layers className="size-4" />
            Layer settings
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="relative min-h-[520px] overflow-hidden bg-white/86">
          <div className="road-grid absolute inset-0 opacity-90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,252,245,0.16)_42%,rgba(255,252,245,0.88)_100%)]" />
          <CardContent className="relative flex h-full flex-col justify-between py-6">
            <div className="flex flex-wrap gap-3">
              <Badge variant="success">Good: &lt; 2.0</Badge>
              <Badge variant="warning">Fair: 2.0 - 4.0</Badge>
              <Badge variant="destructive">Poor: &gt; 4.0</Badge>
            </div>

            <div className="mx-auto text-center">
              <div className="float-slow mx-auto flex size-20 items-center justify-center rounded-full bg-white/85 text-primary shadow-xl">
                <MapPin className="size-9" />
              </div>
              <h3 className="mt-5 font-display text-3xl text-foreground">
                Map engine placeholder
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                This view is ready for MapLibre or Leaflet. The design layer already
                reserves room for legend, overlays, and focused corridor status cards.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <InsightPanel label="Coverage" value="75%" note="Lilongwe focus zone" />
              <InsightPanel label="Hazard clusters" value="25" note="Across 3 active roads" />
              <InsightPanel label="Confidence" value="High" note="Scoring window updated 12m ago" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-white/86">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Info className="size-4" />
                <CardTitle className="text-lg">Zone insights</CardTitle>
              </div>
              <CardDescription>
                Quick readout for the current survey focus area.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[22px] bg-secondary/45 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Current focus
                </p>
                <p className="mt-2 text-xl font-semibold text-foreground">Lilongwe area</p>
                <div className="mt-4 h-2 rounded-full bg-border/60">
                  <div className="h-2 w-3/4 rounded-full bg-primary" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  75% data coverage with strong GPS confidence.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Top identified hazards
                </p>
                <HazardItem type="Pothole cluster" location="M1 - North" count={12} />
                <HazardItem type="Edge subsidence" location="S122 - Dedza" count={5} />
                <HazardItem type="Severe corrugation" location="Salima unpaved link" count={8} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InsightPanel({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-[22px] border border-white/60 bg-white/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </div>
  )
}

function HazardItem({ type, location, count }: { type: string; location: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-[20px] bg-secondary/45 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{type}</p>
        <p className="text-xs text-muted-foreground">{location}</p>
      </div>
      <Badge variant="outline">{count}</Badge>
    </div>
  )
}
