import type * as React from 'react'
import { cn } from '../../lib/utils'

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'primary' | 'warning' | 'destructive'
  className?: string
}) {
  const valueTone = {
    default: 'text-foreground',
    primary: 'text-primary',
    warning: 'text-[hsl(30_80%_34%)]',
    destructive: 'text-destructive',
  }[tone]

  return (
    <div className={cn('flat-panel px-4 py-3.5', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', valueTone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
