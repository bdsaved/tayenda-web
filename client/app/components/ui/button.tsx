import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_hsl(160_84%_30%/0.7)] hover:bg-primary/90 hover:shadow-[0_12px_26px_-10px_hsl(160_84%_30%/0.75)]',
        secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border-border bg-background/70 text-foreground hover:border-primary/40 hover:bg-secondary',
        ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-[0_8px_20px_-10px_hsl(2_78%_55%/0.7)] hover:bg-destructive/90',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
