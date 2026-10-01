import { Suspense, lazy } from 'react'

import type { HazardSource, SegmentFeature, TrackFeature } from '../../lib/api'
import { CONDITION_COLORS, HAZARD_COLORS, TRACK_COLOR } from '../../lib/format'
import { useMounted } from '../../lib/hooks'
import { cn } from '../../lib/utils'

export type MapHazard = {
  id: string | number
  lat: number
  lon: number
  kind: string
  source: HazardSource
  /** Number of distinct trips that saw it (1 for a single trip's hazard). */
  tripCount: number
  observations?: number
  magnitude: number | null
  lastSeen: number
  tripId: string | null
}

export type MapPoint = { lat: number; lon: number; ts: number }

export type RoadMapProps = {
  segments: SegmentFeature[]
  hazards?: MapHazard[]
  /** Full GPS routes, drawn as thin neutral lines underneath the segments. */
  tracks?: TrackFeature[]
  /** When true, clicking a route opens a popup linking to its trip. */
  tracksInteractive?: boolean
  /** Route start/end markers (trip detail). */
  endpoints?: { start: MapPoint; end: MapPoint } | null
  /** Playback cursor position. */
  cursor?: { lat: number; lon: number } | null
  /** Explicit view (e.g. from ?lat=&lon=&z=). When set, the map does not auto-fit. */
  center?: [number, number] | null
  zoom?: number
  /** Changing this value re-fits the map to the current data (undefined = don't fit yet). */
  fitKey?: string
  className?: string
}

export const DEFAULT_CENTER: [number, number] = [-15.786, 35.005] // Blantyre

// Leaflet touches `window` at import time, so the real map is loaded lazily and
// only after the first client render.
const RoadMap = lazy(() => import('./road-map'))

export function MapView(props: RoadMapProps) {
  const mounted = useMounted()
  const fallback = (
    <div className={cn('flex items-center justify-center bg-muted/40 text-sm text-muted-foreground', props.className)}>
      Loading map...
    </div>
  )
  if (!mounted) return fallback
  return (
    <Suspense fallback={fallback}>
      <RoadMap {...props} />
    </Suspense>
  )
}

export function MapLegend({
  showHazards = true,
  showRoute = false,
  className,
}: {
  showHazards?: boolean
  showRoute?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground', className)}>
      {showRoute ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-5 rounded-full opacity-70" style={{ background: TRACK_COLOR }} />
          GPS route (not scored)
        </span>
      ) : null}
      {(['GOOD', 'FAIR', 'POOR'] as const).map((condition) => (
        <span key={condition} className="inline-flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full" style={{ background: CONDITION_COLORS[condition] }} />
          {condition === 'GOOD' ? 'Good' : condition === 'FAIR' ? 'Fair' : 'Poor'} road
        </span>
      ))}
      {showHazards ? (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-white shadow" style={{ background: HAZARD_COLORS.detected }} />
            Detected jolt
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rotate-45 rounded-[2px] border-2 border-white shadow" style={{ background: HAZARD_COLORS.tagged }} />
            Driver-tagged hazard
          </span>
          <span>Larger marker = seen on more trips</span>
        </>
      ) : null}
    </div>
  )
}
