"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "cn"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("va:grid va:w-full va:gap-2", className)}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "va:group/radio-group-item va:peer va:relative va:flex va:aspect-square va:size-4 va:shrink-0 va:rounded-full va:border va:border-input va:outline-none va:group-has-[:focus-visible]/field-label:ring-0 va:group-has-[:focus-visible]/field-label:not-data-checked:border-input va:after:absolute va:after:-inset-x-3 va:after:-inset-y-2 va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:disabled:cursor-not-allowed va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:aria-invalid:aria-checked:border-primary va:dark:bg-input/30 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40 va:data-checked:border-primary va:data-checked:bg-primary va:data-checked:text-primary-foreground va:group-has-[:focus-visible]/field-label:data-checked:border-primary va:dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="va:flex va:size-4 va:items-center va:justify-center"
      >
        <span className="va:absolute va:top-1/2 va:left-1/2 va:size-2 va:-translate-x-1/2 va:-translate-y-1/2 va:rounded-full va:bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
