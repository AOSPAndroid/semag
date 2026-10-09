import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "va:group/tabs va:flex va:gap-2 va:data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "va:group/tabs-list va:inline-flex va:w-fit va:items-center va:justify-center va:rounded-lg va:p-[3px] va:text-muted-foreground va:group-data-[orientation=horizontal]/tabs:h-8 va:group-data-[orientation=vertical]/tabs:h-fit va:group-data-[orientation=vertical]/tabs:flex-col va:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "va:bg-muted",
        armory: "armory-tabs-list va:bg-transparent",
        line: "va:gap-1 va:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "va:relative va:inline-flex va:h-[calc(100%-1px)] va:flex-1 va:items-center va:justify-center va:gap-1.5 va:rounded-md va:border va:border-transparent va:px-1.5 va:py-0.5 va:text-sm va:font-medium va:whitespace-nowrap va:text-foreground/60 va:transition-all va:group-data-[orientation=vertical]/tabs:w-full va:group-data-[orientation=vertical]/tabs:justify-start va:hover:text-foreground va:focus-visible:border-ring va:focus-visible:ring-[3px] va:focus-visible:ring-ring/50 va:focus-visible:outline-1 va:focus-visible:outline-ring va:disabled:pointer-events-none va:disabled:opacity-50 va:has-data-[icon=inline-end]:pr-1 va:has-data-[icon=inline-start]:pl-1 va:aria-disabled:pointer-events-none va:aria-disabled:opacity-50 va:dark:text-muted-foreground va:dark:hover:text-foreground va:group-data-[variant=default]/tabs-list:data-active:shadow-sm va:group-data-[variant=line]/tabs-list:data-active:shadow-none va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0 va:[&_svg:not([class*=size-])]:size-4",
        "va:group-data-[variant=line]/tabs-list:bg-transparent va:group-data-[variant=line]/tabs-list:data-active:bg-transparent va:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent va:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "va:data-active:bg-background va:data-active:text-foreground va:dark:data-active:border-input va:dark:data-active:bg-input/30 va:dark:data-active:text-foreground",
        "va:after:absolute va:after:bg-foreground va:after:opacity-0 va:after:transition-opacity va:group-data-[orientation=horizontal]/tabs:after:inset-x-0 va:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] va:group-data-[orientation=horizontal]/tabs:after:h-0.5 va:group-data-[orientation=vertical]/tabs:after:inset-y-0 va:group-data-[orientation=vertical]/tabs:after:-right-1 va:group-data-[orientation=vertical]/tabs:after:w-0.5 va:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("va:flex-1 va:text-sm va:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
