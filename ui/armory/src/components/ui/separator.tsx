import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "cn"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "va:shrink-0 va:bg-border va:data-horizontal:h-px va:data-horizontal:w-full va:data-vertical:w-px va:data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
