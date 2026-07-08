import type * as React from 'react'
import { cn } from '../../lib/utils'

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error'
  children: React.ReactNode
  className?: string
}) {
  const tones = {
    info: 'border-border bg-muted/60 text-foreground',
    success: 'border-success/30 bg-success/10 text-[hsl(150_93%_22%)]',
    warning: 'border-warning/40 bg-warning/10 text-[hsl(30_80%_30%)]',
    error: 'border-destructive/30 bg-destructive/10 text-[hsl(2_70%_40%)]',
  }[tone]

  return (
    <div className={cn('rounded-md border px-3.5 py-2.5 text-sm', tones, className)}>
      {children}
    </div>
  )
}
