import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-accent text-primary',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border bg-background text-muted-foreground',
        success: 'border-emerald-300 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-300 bg-amber-50 text-amber-700',
        destructive: 'border-rose-300 bg-rose-50 text-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
