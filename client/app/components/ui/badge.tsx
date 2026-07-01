import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em]',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-accent text-accent-foreground',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border bg-background/70 text-muted-foreground',
        success: 'border-success/25 bg-success/12 text-[hsl(152_68%_28%)]',
        warning: 'border-warning/30 bg-warning/15 text-[hsl(30_80%_30%)]',
        destructive: 'border-destructive/25 bg-destructive/12 text-[hsl(2_70%_44%)]',
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
