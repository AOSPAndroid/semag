import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "va:flex va:field-sizing-content va:min-h-16 va:w-full va:rounded-lg va:border va:border-input va:bg-transparent va:px-2.5 va:py-2 va:text-base va:transition-colors va:outline-none va:placeholder:text-muted-foreground va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:disabled:cursor-not-allowed va:disabled:bg-input/50 va:disabled:opacity-50 va:aria-invalid:border-destructive va:aria-invalid:ring-3 va:aria-invalid:ring-destructive/20 va:md:text-sm    ",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

