"use client"

import * as React from "react"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "va:flex va:items-center va:gap-2 va:text-sm va:leading-none va:font-medium va:select-none va:group-data-[disabled=true]:pointer-events-none va:group-data-[disabled=true]:opacity-50 va:peer-disabled:cursor-not-allowed va:peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
