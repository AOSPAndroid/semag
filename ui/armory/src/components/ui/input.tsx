import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "va:h-8 va:w-full va:min-w-0 va:rounded-lg va:border va:border-input va:bg-transparent va:px-2.5 va:py-1 va:text-base va:transition-colors va:outline-none va:file:inline-flex va:file:h-6 va:file:border-0 va:file:bg-transparent va:file:text-sm va:file:font-medium va:file:text-foreground va:placeholder:text-muted-foreground va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:disabled:pointer-events-none va:disabled:cursor-not-allowed va:disabled:bg-input/50 va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:md:text-sm va:dark:bg-input/30 va:dark:disabled:bg-input/80 va:dark:aria-invalid:border-destructive/50 va:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
