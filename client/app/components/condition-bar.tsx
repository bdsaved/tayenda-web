import { cn } from '../lib/utils'

/**
 * Stacked good/fair/poor bar. Values can be in any one unit (m or km); only the
 * proportions are drawn. Labels/tooltip carry identity so it isn't colour-only.
 */
export function ConditionBar({
  good,
  fair,
  poor,
  unit = 'km',
  showLegend = false,
  barClassName,
  className,
}: {
  good: number
  fair: number
  poor: number
  unit?: 'm' | 'km'
  showLegend?: boolean
  barClassName?: string
  className?: string
}) {
  const total = good + fair + poor
  const fmt = (value: number) => (unit === 'km' ? `${value.toFixed(1)} km` : value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`)
  const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0)
  const title = total > 0 ? `Good ${fmt(good)} · Fair ${fmt(fair)} · Poor ${fmt(poor)}` : 'Not mapped yet'

  return (
    <div className={cn('min-w-[96px]', className)}>
      <div className={cn('flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-muted', barClassName)} title={title} role="img" aria-label={title}>
        {total > 0 ? (
          <>
            {good > 0 ? <span className="h-full bg-success" style={{ flex: `${good} 1 0` }} /> : null}
            {fair > 0 ? <span className="h-full bg-warning" style={{ flex: `${fair} 1 0` }} /> : null}
            {poor > 0 ? <span className="h-full bg-destructive" style={{ flex: `${poor} 1 0` }} /> : null}
          </>
        ) : null}
      </div>
      {showLegend ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <LegendItem className="bg-success" label="Good" value={`${fmt(good)} (${pct(good)}%)`} />
          <LegendItem className="bg-warning" label="Fair" value={`${fmt(fair)} (${pct(fair)}%)`} />
          <LegendItem className="bg-destructive" label="Poor" value={`${fmt(poor)} (${pct(poor)}%)`} />
        </div>
      ) : null}
    </div>
  )
}

function LegendItem({ className, label, value }: { className: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', className)} />
      <span className="font-medium text-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  )
}
