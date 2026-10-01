import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'

import type { SegmentFeature } from '../lib/api'
import { CONDITION_COLORS, CONDITION_LABELS, formatDistance, formatRoughness, formatSpeed } from '../lib/format'

const HEIGHT = 200
const M = { top: 10, right: 12, bottom: 26, left: 44 }

/** Segment roughness vs cumulative distance, with the FAIR/POOR thresholds. */
export function RoughnessChart({
  segments,
  fairThreshold,
  poorThreshold,
}: {
  segments: SegmentFeature[]
  fairThreshold?: number | null
  poorThreshold?: number | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const rows = useMemo(
    () =>
      segments
        .map((feature) => feature.properties)
        .filter((p) => Number.isFinite(p.roughness))
        .sort((a, b) => a.distance_from_start_m - b.distance_from_start_m),
    [segments],
  )

  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No processed segments for this trip yet.</p>
  }

  const plotW = Math.max(40, width - M.left - M.right)
  const plotH = HEIGHT - M.top - M.bottom
  const maxX = Math.max(...rows.map((p) => p.distance_from_start_m + p.length_m), 1)
  const maxRough = Math.max(...rows.map((p) => p.roughness), poorThreshold ?? 0)
  const yMax = niceCeil(maxRough * 1.1 || 1)
  const x = (metres: number) => M.left + (metres / maxX) * plotW
  const y = (value: number) => M.top + plotH - (value / yMax) * plotH
  const yTicks = [0, yMax / 2, yMax]
  const xTicks = niceTicks(maxX, Math.max(2, Math.floor(plotW / 90)))

  function onMove(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const metres = ((event.clientX - box.left) / box.width) * maxX
    let best = 0
    let bestDist = Infinity
    rows.forEach((p, index) => {
      const mid = p.distance_from_start_m + p.length_m / 2
      const d = Math.abs(mid - metres)
      if (d < bestDist) {
        bestDist = d
        best = index
      }
    })
    setHover(best)
  }

  const active = hover != null ? rows[hover] : null

  return (
    <div ref={containerRef} className="relative w-full">
      <svg width={width} height={HEIGHT} role="img" aria-label="Roughness along the trip" className="block">
        {/* grid + y axis */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={M.left} x2={M.left + plotW} y1={y(tick)} y2={y(tick)} stroke="hsl(var(--border))" />
            <text x={M.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
              {tick.toFixed(tick < 1 && tick > 0 ? 2 : 1)}
            </text>
          </g>
        ))}
        <text x={4} y={M.top + 2} dy="0.7em" className="fill-muted-foreground text-[10px]">
          m/s²
        </text>

        {/* bars */}
        {rows.map((p, index) => {
          const x0 = x(p.distance_from_start_m)
          const raw = x(p.distance_from_start_m + p.length_m) - x0
          const w = raw > 4 ? raw - 2 : Math.max(raw, 1)
          const top = y(p.roughness)
          return (
            <rect
              key={p.id}
              x={x0}
              y={top}
              width={w}
              height={Math.max(1, M.top + plotH - top)}
              fill={CONDITION_COLORS[p.condition] ?? 'hsl(var(--muted-foreground))'}
              opacity={hover == null || hover === index ? 1 : 0.45}
            />
          )
        })}

        {/* thresholds */}
        {[
          { value: fairThreshold, label: 'Fair' },
          { value: poorThreshold, label: 'Poor' },
        ].map((line) =>
          line.value != null && line.value <= yMax ? (
            <g key={line.label}>
              <line
                x1={M.left}
                x2={M.left + plotW}
                y1={y(line.value)}
                y2={y(line.value)}
                stroke="hsl(var(--foreground))"
                strokeOpacity={0.55}
                strokeDasharray="4 3"
              />
              <text x={M.left + plotW - 2} y={y(line.value) - 3} textAnchor="end" className="fill-foreground text-[10px] font-medium">
                {line.label} ≥ {line.value.toFixed(2)}
              </text>
            </g>
          ) : null,
        )}

        {/* x axis */}
        <line x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
        {xTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
            {formatDistance(tick)}
          </text>
        ))}

        {/* hit area */}
        <rect
          x={M.left}
          y={M.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(x(active.distance_from_start_m + active.length_m / 2) - 80, 0), Math.max(0, width - 170)),
            width: 170,
          }}
        >
          <p className="font-medium text-foreground">
            {CONDITION_LABELS[active.condition] ?? active.condition} · {formatRoughness(active.roughness)}
          </p>
          <p className="text-muted-foreground">
            at {formatDistance(active.distance_from_start_m)} · {formatSpeed(active.avg_speed)}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function niceCeil(value: number) {
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const steps = [1, 2, 2.5, 5, 10]
  for (const step of steps) {
    if (value <= step * base) return step * base
  }
  return 10 * base
}

function niceTicks(max: number, count: number) {
  const raw = max / count
  const step = niceCeil(raw)
  const ticks: number[] = []
  for (let t = 0; t <= max + 1e-6; t += step) ticks.push(t)
  return ticks
}
