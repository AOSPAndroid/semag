import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "va:flex va:w-full va:min-w-0 va:flex-1 va:flex-col va:items-center va:justify-center va:gap-4 va:rounded-xl va:border-dashed va:p-6 va:text-center va:text-balance",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("va:flex va:max-w-sm va:flex-col va:items-center va:gap-2", className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "va:mb-2 va:flex va:shrink-0 va:items-center va:justify-center va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "va:bg-transparent",
        icon: "va:flex va:size-8 va:shrink-0 va:items-center va:justify-center va:rounded-lg va:bg-muted va:text-foreground va:[&_svg:not([class*=size-])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        "va: va:text-sm va:font-medium va:tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "va:text-sm/relaxed va:text-muted-foreground va:[&>a]:underline va:[&>a]:underline-offset-4 va:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "va:flex va:w-full va:max-w-sm va:min-w-0 va:flex-col va:items-center va:gap-2.5 va:text-sm va:text-balance",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
