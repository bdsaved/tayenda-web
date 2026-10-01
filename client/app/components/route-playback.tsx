import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { TrackFeature } from '../lib/api'
import { formatDuration, formatSpeed, formatTime } from '../lib/format'
import { Button } from './ui/button'

type PlaybackPoint = { lat: number; lon: number; ts: number; speed: number | null; part: number }

function flatten(track: TrackFeature): PlaybackPoint[] {
  const { timestamps, speeds } = track.properties
  if (!timestamps) return []
  const points: PlaybackPoint[] = []
  track.geometry.coordinates.forEach((coords, part) => {
    coords.forEach(([lon, lat], i) => {
      const ts = timestamps[part]?.[i]
      if (ts == null) return
      points.push({ lat, lon, ts, speed: speeds?.[part]?.[i] ?? null, part })
    })
  })
  return points
}

const TICK_MS = 50
// Full playback takes roughly this many ticks (~30 s), whatever the point count.
const TARGET_TICKS = 600

/** Slider that moves a cursor along the route; reports the position via onCursor. */
export function RoutePlayback({
  track,
  onCursor,
}: {
  track: TrackFeature
  onCursor: (point: { lat: number; lon: number } | null) => void
}) {
  const points = useMemo(() => flatten(track), [track])
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const last = points.length - 1
  const step = Math.max(1, Math.round(points.length / TARGET_TICKS))

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setIndex((i) => Math.min(last, i + step)), TICK_MS)
    return () => clearInterval(timer)
  }, [playing, step, last])

  useEffect(() => {
    if (playing && index >= last) setPlaying(false)
  }, [playing, index, last])

  const point = points[index]
  useEffect(() => {
    onCursor(active && point ? { lat: point.lat, lon: point.lon } : null)
  }, [active, point, onCursor])

  // Clear the cursor when this component goes away.
  useEffect(() => () => onCursor(null), [onCursor])

  if (points.length < 2 || !point) return null

  function togglePlay() {
    setActive(true)
    if (playing) {
      setPlaying(false)
      return
    }
    if (index >= last) setIndex(0)
    setPlaying(true)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <Button variant="outline" size="sm" onClick={togglePlay} aria-label={playing ? 'Pause playback' : 'Play route'}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        {playing ? 'Pause' : 'Play'}
      </Button>
      <input
        type="range"
        min={0}
        max={last}
        value={index}
        onChange={(event) => {
          setActive(true)
          setPlaying(false)
          setIndex(Number(event.target.value))
        }}
        className="h-2 w-full flex-1 cursor-pointer accent-[hsl(var(--primary))]"
        aria-label="Route position"
      />
      <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:w-64 sm:text-right">
        <span className="font-medium text-foreground">{formatTime(point.ts)}</span>
        {' · '}
        {formatSpeed(point.speed)}
        {' · '}+{formatDuration((point.ts - points[0].ts) / 1000)}
      </p>
    </div>
  )
}
