import * as React from "react"
import { cn } from "cn"

function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; variant?: "default" | "weapon" | "loadout" | "detail" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        "va:group/card va:flex va:flex-col va:gap-(--card-spacing) va:overflow-hidden va:rounded-xl va:bg-card va:py-(--card-spacing) va:text-sm va:text-card-foreground va:ring-1 va:ring-foreground/10 va:[--card-spacing:--spacing(4)] va:has-data-[slot=card-footer]:pb-0 va:has-[>img:first-child]:pt-0 va:data-[size=sm]:[--card-spacing:--spacing(3)] va:data-[size=sm]:has-data-[slot=card-footer]:pb-0 va:*:[img:first-child]:rounded-t-xl va:*:[img:last-child]:rounded-b-xl",
        variant !== "default" && "armory-card",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "va:group/card-header va:@container/card-header va:grid va:auto-rows-min va:items-start va:gap-1 va:rounded-t-xl va:px-(--card-spacing) va:has-data-[slot=card-action]:grid-cols-[1fr_auto] va:has-data-[slot=card-description]:grid-rows-[auto_auto] va:[.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "va:text-base va:leading-snug va:font-medium va:group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("va:text-sm va:text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "va:col-start-2 va:row-span-2 va:row-start-1 va:self-start va:justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("va:px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "va:flex va:items-center va:rounded-b-xl va:border-t va:bg-muted/50 va:p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
