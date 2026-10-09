import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "va:group/button va:inline-flex va:shrink-0 va:items-center va:justify-center va:rounded-lg va:border va:border-transparent va:bg-clip-padding va:text-sm va:font-medium va:whitespace-nowrap va:transition-all va:outline-none va:select-none va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:active:not-aria-[haspopup]:translate-y-px va:disabled:pointer-events-none va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40 va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0 va:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        equip: "armory-equip-button va:bg-accent va:text-accent-foreground va:hover:bg-accent/90",
        default: "va:bg-primary va:text-primary-foreground va:hover:bg-primary/80",
        outline:
          "va:border-border va:bg-background va:hover:bg-muted va:hover:text-foreground va:aria-expanded:bg-muted va:aria-expanded:text-foreground va:dark:border-input va:dark:bg-input/30 va:dark:hover:bg-input/50",
        secondary:
          "va:bg-secondary va:text-secondary-foreground va:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] va:aria-expanded:bg-secondary va:aria-expanded:text-secondary-foreground",
        ghost:
          "va:hover:bg-muted va:hover:text-foreground va:aria-expanded:bg-muted va:aria-expanded:text-foreground va:dark:hover:bg-muted/50",
        destructive:
          "va:bg-destructive/10 va:text-destructive va:hover:bg-destructive/20 va:focus-visible:border-destructive/40 va:focus-visible:ring-destructive/20 va:dark:bg-destructive/20 va:dark:hover:bg-destructive/30 va:dark:focus-visible:ring-destructive/40",
        link: "va:text-primary va:underline-offset-4 va:hover:underline",
      },
      size: {
        default:
          "va:h-8 va:gap-1.5 va:px-2.5 va:has-data-[icon=inline-end]:pr-2 va:has-data-[icon=inline-start]:pl-2",
        xs: "va:h-6 va:gap-1 va:rounded-[min(var(--radius-md),10px)] va:px-2 va:text-xs va:in-data-[slot=button-group]:rounded-lg va:has-data-[icon=inline-end]:pr-1.5 va:has-data-[icon=inline-start]:pl-1.5 va:[&_svg:not([class*=size-])]:size-3",
        sm: "va:h-7 va:gap-1 va:rounded-[min(var(--radius-md),12px)] va:px-2.5 va:text-[0.8rem] va:in-data-[slot=button-group]:rounded-lg va:has-data-[icon=inline-end]:pr-1.5 va:has-data-[icon=inline-start]:pl-1.5 va:[&_svg:not([class*=size-])]:size-3.5",
        lg: "va:h-9 va:gap-1.5 va:px-2.5 va:has-data-[icon=inline-end]:pr-2 va:has-data-[icon=inline-start]:pl-2",
        icon: "va:size-8",
        "icon-xs":
          "va:size-6 va:rounded-[min(var(--radius-md),10px)] va:in-data-[slot=button-group]:rounded-lg va:[&_svg:not([class*=size-])]:size-3",
        "icon-sm":
          "va:size-7 va:rounded-[min(var(--radius-md),12px)] va:in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "va:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  type = "button",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
