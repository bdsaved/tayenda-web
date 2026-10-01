import 'leaflet/dist/leaflet.css'

import { Link } from '@tanstack/react-router'
import L from 'leaflet'
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import type { SegmentFeature, TrackFeature } from '../../lib/api'
import {
  CONDITION_COLORS,
  CONDITION_LABELS,
  HAZARD_COLORS,
  ROUTE_END_COLOR,
  ROUTE_START_COLOR,
  TRACK_COLOR,
  formatDate,
  formatDistance,
  formatDuration,
  formatRoughness,
  formatSpeed,
  hazardSourceLabel,
  titleCase,
} from '../../lib/format'
import { DEFAULT_CENTER, type MapHazard, type MapPoint, type RoadMapProps } from './map-view'

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * Base map tiles: a custom VITE_TILE_URL wins, then Mapbox when a token is
 * configured, otherwise the standard OpenStreetMap tiles.
 */
function tileConfig() {
  const env = import.meta.env
  if (env.VITE_TILE_URL) {
    return { url: env.VITE_TILE_URL, attribution: env.VITE_TILE_ATTRIBUTION || OSM_ATTRIBUTION }
  }
  if (env.VITE_MAPBOX_TOKEN) {
    const style = env.VITE_MAPBOX_STYLE || 'mapbox/streets-v12'
    return {
      url: `https://api.mapbox.com/styles/v1/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${env.VITE_MAPBOX_TOKEN}`,
      attribution:
        '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' + OSM_ATTRIBUTION,
      tileSize: 512,
      zoomOffset: -1,
    }
  }
  return { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTRIBUTION }
}

const TILES = tileConfig()

type Selected = { seq: number; feature: SegmentFeature; latlng: L.LatLng }

// Layering: all lines (routes + segments) share ONE canvas so clicks reach
// whichever line is on top; routes are sent to the back when added. Every point
// marker is a small DOM icon, so no second full-size canvas/SVG sits over the
// lines and swallows their clicks.

function hazardSize(tripCount: number) {
  return Math.min(22, 10 + Math.round(Math.sqrt(Math.max(1, tripCount)) * 3))
}

const iconCache = new Map<string, L.DivIcon>()
function cachedIcon(key: string, make: () => L.DivIcon) {
  let icon = iconCache.get(key)
  if (!icon) {
    icon = make()
    iconCache.set(key, icon)
  }
  return icon
}

function hazardIcon(source: 'detected' | 'tagged', size: number) {
  return cachedIcon(`${source}-${size}`, () => {
    const inner = source === 'tagged' ? Math.round(size * 0.72) : size - 2
    const shape =
      source === 'tagged'
        ? `width:${inner}px;height:${inner}px;margin:${(size - inner) / 2}px;border-radius:2px;transform:rotate(45deg)`
        : `width:${inner}px;height:${inner}px;margin:1px;border-radius:9999px`
    return L.divIcon({
      className: 'tayenda-map-icon',
      html: `<span style="display:block;box-sizing:border-box;${shape};background:${HAZARD_COLORS[source]};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    })
  })
}

function endpointIcon(kind: 'start' | 'end') {
  return cachedIcon(`endpoint-${kind}`, () =>
    L.divIcon({
      className: 'tayenda-map-icon',
      html: `<span style="display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:22px;height:22px;border-radius:9999px;background:${kind === 'start' ? ROUTE_START_COLOR : ROUTE_END_COLOR};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35);color:#fff;font:700 10px/1 sans-serif">${kind === 'start' ? 'S' : 'E'}</span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -11],
    }),
  )
}

function cursorIcon() {
  return cachedIcon('cursor', () =>
    L.divIcon({
      className: 'tayenda-map-icon',
      html: `<span style="display:block;box-sizing:border-box;width:16px;height:16px;border-radius:9999px;background:#fff;border:4px solid hsl(150, 93%, 28%);box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
  )
}

// Stable references: react-leaflet calls setStyle()/rebinds whenever these props
// change identity, which would be costly on every playback tick.
function segmentStyle(feature?: { properties?: unknown }): L.PathOptions {
  const condition = (feature?.properties as { condition?: keyof typeof CONDITION_COLORS } | undefined)?.condition
  return {
    color: condition ? CONDITION_COLORS[condition] : 'hsl(160, 8%, 42%)',
    weight: 5,
    opacity: 0.9,
    lineCap: 'round',
  }
}
const TRACK_STYLE: L.PathOptions = { color: TRACK_COLOR, weight: 3, opacity: 0.7, lineCap: 'round', lineJoin: 'round' }
const TRACK_EVENTS: L.LeafletEventHandlerFnMap = {
  add: (event) => (event.target as L.Polyline).bringToBack(),
}

function toLatLngs(track: TrackFeature): [number, number][][] {
  return track.geometry.coordinates.map((part) => part.map(([lon, lat]) => [lat, lon] as [number, number]))
}

export default function RoadMap({
  segments,
  hazards = [],
  tracks = [],
  tracksInteractive = false,
  endpoints,
  cursor,
  center,
  zoom,
  fitKey,
  className,
}: RoadMapProps) {
  const [selected, setSelected] = useState<Selected | null>(null)
  // Canvas keeps tens of thousands of segments responsive; tolerance widens hit area.
  const renderer = useMemo(() => L.canvas({ tolerance: 6 }), [])
  const collection = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: segments }) as unknown as ComponentProps<typeof GeoJSON>['data'],
    [segments],
  )
  // GeoJSON layers are immutable in react-leaflet; remount when data changes.
  const dataKey = useMemo(
    () => `${segments.length}:${segments[0]?.properties.id ?? ''}:${segments.at(-1)?.properties.id ?? ''}`,
    [segments],
  )
  const onEachSegment = useCallback((feature: unknown, layer: L.Layer) => {
    layer.on('click', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event)
      setSelected((current) => ({
        seq: (current?.seq ?? 0) + 1,
        feature: feature as SegmentFeature,
        latlng: event.latlng,
      }))
    })
  }, [])
  const hazardMarkers = useMemo(
    () =>
      hazards.map((hazard) => (
        <Marker
          key={`${hazard.source}-${hazard.id}`}
          position={[hazard.lat, hazard.lon]}
          icon={hazardIcon(hazard.source === 'tagged' ? 'tagged' : 'detected', hazardSize(hazard.tripCount))}
        >
          <Popup>
            <HazardPopupBody hazard={hazard} />
          </Popup>
        </Marker>
      )),
    [hazards],
  )

  return (
    <MapContainer
      center={center ?? DEFAULT_CENTER}
      zoom={center ? (zoom ?? 16) : 12}
      preferCanvas
      renderer={renderer}
      scrollWheelZoom
      className={className}
      style={{ background: 'hsl(150 12% 95%)' }}
    >
      <TileLayer {...TILES} maxZoom={19} />

      {tracks.map((track) => (
        <TrackLine key={track.properties.trip_id} track={track} interactive={tracksInteractive} />
      ))}

      <GeoJSON
        key={dataKey}
        data={collection}
        style={segmentStyle}
        onEachFeature={onEachSegment}
      />

      {hazardMarkers}

      {endpoints ? (
        <>
          <EndpointMarker kind="start" point={endpoints.start} />
          <EndpointMarker kind="end" point={endpoints.end} />
        </>
      ) : null}

      {cursor ? <Marker position={[cursor.lat, cursor.lon]} icon={cursorIcon()} interactive={false} zIndexOffset={1000} /> : null}

      <SegmentPopup selected={selected} onClose={() => setSelected(null)} />
      <ViewController segments={segments} hazards={hazards} tracks={tracks} center={center} zoom={zoom} fitKey={fitKey} />
    </MapContainer>
  )
}

function TrackLine({ track, interactive }: { track: TrackFeature; interactive: boolean }) {
  const positions = useMemo(() => toLatLngs(track), [track])
  const p = track.properties
  return (
    <Polyline
      positions={positions}
      interactive={interactive}
      pathOptions={TRACK_STYLE}
      eventHandlers={TRACK_EVENTS}
    >
      {interactive ? (
        <Popup>
          <div className="min-w-[180px] space-y-1 text-[13px] leading-5">
            <p className="text-sm font-semibold text-foreground">GPS route</p>
            <PopupRow label="Started" value={formatDate(p.start_ts)} />
            <PopupRow label="Distance" value={formatDistance(p.distance_m)} />
            <PopupRow label="Duration" value={formatDuration(p.duration_s)} />
            <Link
              to="/dashboard/trips/$tripId"
              params={{ tripId: p.trip_id }}
              className="inline-block pt-1 font-medium text-primary hover:underline"
            >
              Open trip
            </Link>
          </div>
        </Popup>
      ) : null}
    </Polyline>
  )
}

function EndpointMarker({ kind, point }: { kind: 'start' | 'end'; point: MapPoint }) {
  return (
    <Marker position={[point.lat, point.lon]} icon={endpointIcon(kind)} zIndexOffset={500}>
      <Popup>
        <div className="text-[13px] leading-5">
          <p className="text-sm font-semibold text-foreground">{kind === 'start' ? 'Start' : 'End'}</p>
          <p className="text-muted-foreground">{formatDate(point.ts)}</p>
        </div>
      </Popup>
    </Marker>
  )
}

function HazardPopupBody({ hazard }: { hazard: MapHazard }) {
  return (
    <div className="min-w-[180px] space-y-1 text-[13px] leading-5">
      <p className="text-sm font-semibold text-foreground">{titleCase(hazard.kind)}</p>
      <PopupRow label="Source" value={hazardSourceLabel(hazard.source)} />
      <PopupRow label="Seen on" value={`${hazard.tripCount} trip${hazard.tripCount === 1 ? '' : 's'}`} />
      {hazard.magnitude != null ? <PopupRow label="Max magnitude" value={`${hazard.magnitude.toFixed(1)} m/s²`} /> : null}
      <PopupRow label={hazard.tripCount > 1 ? 'Last seen' : 'Seen'} value={formatDate(hazard.lastSeen)} />
      {hazard.tripId ? (
        <Link
          to="/dashboard/trips/$tripId"
          params={{ tripId: hazard.tripId }}
          className="inline-block pt-1 font-medium text-primary hover:underline"
        >
          {hazard.tripCount > 1 ? 'Open first trip' : 'Open trip'}
        </Link>
      ) : null}
    </div>
  )
}

function SegmentPopup({ selected, onClose }: { selected: Selected | null; onClose: () => void }) {
  const popupRef = useRef<L.Popup | null>(null)
  useMapEvents({
    popupclose(event) {
      if (event.popup === popupRef.current) onClose()
    },
  })
  if (!selected) return null
  const p = selected.feature.properties
  return (
    // Keyed per click: a fresh popup per selection, so closing the previous one
    // (which fires `popupclose`) is ignored by the ref check above.
    <Popup key={selected.seq} ref={popupRef} position={selected.latlng}>
      <div className="min-w-[180px] space-y-1 text-[13px] leading-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <span className="size-2.5 rounded-full" style={{ background: CONDITION_COLORS[p.condition] }} />
          {CONDITION_LABELS[p.condition] ?? p.condition} road
        </p>
        <PopupRow label="Roughness" value={formatRoughness(p.roughness)} />
        <PopupRow label="Speed" value={formatSpeed(p.avg_speed)} />
        <PopupRow label="Length" value={formatDistance(p.length_m)} />
        <PopupRow label="Recorded" value={formatDate(p.start_ts)} />
        <Link
          to="/dashboard/trips/$tripId"
          params={{ tripId: p.trip_id }}
          className="inline-block pt-1 font-medium text-primary hover:underline"
        >
          Open trip
        </Link>
      </div>
    </Popup>
  )
}

function PopupRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </p>
  )
}

function ViewController({
  segments,
  hazards,
  tracks,
  center,
  zoom,
  fitKey,
}: {
  segments: SegmentFeature[]
  hazards: MapHazard[]
  tracks: TrackFeature[]
  center?: [number, number] | null
  zoom?: number
  fitKey?: string
}) {
  const map = useMap()

  // Container may have been sized after Leaflet initialised (lazy mount).
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(timer)
  }, [map])

  const centerLat = center?.[0]
  const centerLon = center?.[1]
  useEffect(() => {
    if (centerLat != null && centerLon != null) {
      map.setView([centerLat, centerLon], zoom ?? 16)
    }
  }, [map, centerLat, centerLon, zoom])

  useEffect(() => {
    if (fitKey === undefined || (centerLat != null && centerLon != null)) return
    // Full route(s) when loaded, plus segments + hazards (the fallback when no route).
    const points: [number, number][] = []
    for (const track of tracks) {
      for (const part of track.geometry.coordinates) {
        for (const [lon, lat] of part) points.push([lat, lon])
      }
    }
    for (const feature of segments) {
      for (const [lon, lat] of feature.geometry.coordinates) points.push([lat, lon])
    }
    for (const hazard of hazards) points.push([hazard.lat, hazard.lon])
    const tripIds = new Set([
      ...tracks.map((track) => track.properties.trip_id),
      ...segments.map((feature) => feature.properties.trip_id),
    ])
    // One trip: show all of it. Many trips: frame where most of the data is.
    const bounds = tripIds.size > 1 ? robustBounds(points) : L.latLngBounds(points)
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 })
    } else {
      map.setView(DEFAULT_CENTER, 12)
    }
    // Only refit when the caller says the dataset changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey, centerLat, centerLon])

  return null
}

/**
 * Bounds of the bulk of the data: the 5th-95th percentile of latitude and
 * longitude. One trip recorded in another country would otherwise zoom
 * the map out to a whole continent. Small datasets use every point.
 */
function robustBounds(points: [number, number][]) {
  if (points.length < 200) return L.latLngBounds(points)
  const lats = points.map((p) => p[0]).sort((a, b) => a - b)
  const lons = points.map((p) => p[1]).sort((a, b) => a - b)
  const at = (values: number[], q: number) => values[Math.floor(q * (values.length - 1))]
  return L.latLngBounds([at(lats, 0.05), at(lons, 0.05)], [at(lats, 0.95), at(lons, 0.95)])
}
