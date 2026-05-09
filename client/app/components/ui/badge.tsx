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
        success: 'border-zinc-300 bg-zinc-100 text-zinc-800',
        warning: 'border-zinc-400 bg-zinc-200 text-zinc-900',
        destructive: 'border-zinc-500 bg-zinc-900 text-white',
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
