import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "va:group/badge va:inline-flex va:h-5 va:w-fit va:shrink-0 va:items-center va:justify-center va:gap-1 va:overflow-hidden va:rounded-4xl va:border va:border-transparent va:px-2 va:py-0.5 va:text-xs va:font-medium va:whitespace-nowrap va:transition-all va:focus-visible:border-ring va:focus-visible:ring-[3px] va:focus-visible:ring-ring/50 va:has-data-[icon=inline-end]:pr-1.5 va:has-data-[icon=inline-start]:pl-1.5 va:aria-invalid:border-destructive va:aria-invalid:ring-destructive/20 va:dark:aria-invalid:ring-destructive/40 va:[&>svg]:pointer-events-none va:[&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "va:bg-primary va:text-primary-foreground va:[a]:hover:bg-primary/80",
        secondary:
          "va:bg-secondary va:text-secondary-foreground va:[a]:hover:bg-secondary/80",
        destructive:
          "va:bg-destructive/10 va:text-destructive va:focus-visible:ring-destructive/20 va:dark:bg-destructive/20 va:dark:focus-visible:ring-destructive/40 va:[a]:hover:bg-destructive/20",
        outline:
          "va:border-border va:text-foreground va:[a]:hover:bg-muted va:[a]:hover:text-muted-foreground",
        ghost:
          "va:hover:bg-muted va:hover:text-muted-foreground va:dark:hover:bg-muted/50",
        link: "va:text-primary va:underline-offset-4 va:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
