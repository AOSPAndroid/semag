import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "va:group/input-group va:relative va:flex va:h-8 va:w-full va:min-w-0 va:items-center va:rounded-lg va:border va:border-input va:transition-colors va:outline-none va:in-data-[slot=combobox-content]:focus-within:border-inherit va:in-data-[slot=combobox-content]:focus-within:ring-0 va:has-disabled:bg-input/50 va:has-disabled:opacity-50 va:has-[[data-slot=input-group-control]:focus-visible]:border-ring va:has-[[data-slot=input-group-control]:focus-visible]:ring-3 va:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 va:has-[[data-slot][aria-invalid=true]]:border-destructive va:has-[[data-slot][aria-invalid=true]]:ring-3 va:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 va:has-[>[data-align=block-end]]:h-auto va:has-[>[data-align=block-end]]:flex-col va:has-[>[data-align=block-start]]:h-auto va:has-[>[data-align=block-start]]:flex-col va:has-[>textarea]:h-auto    va:has-[>[data-align=block-end]]:[&>input]:pt-3 va:has-[>[data-align=block-start]]:[&>input]:pb-3 va:has-[>[data-align=inline-end]]:[&>input]:pr-1.5 va:has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "va:flex va:h-auto va:cursor-text va:items-center va:justify-center va:gap-2 va:py-1.5 va:text-sm va:font-medium va:text-muted-foreground va:select-none va:group-data-[disabled=true]/input-group:opacity-50 va:[&>kbd]:rounded-[calc(var(--radius)-5px)] va:[&>svg:not([class*=size-])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "va:order-first va:pl-2 va:has-[>button]:ml-[-0.3rem] va:has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "va:order-last va:pr-2 va:has-[>button]:mr-[-0.3rem] va:has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "va:order-first va:w-full va:justify-start va:px-2.5 va:pt-2 va:group-has-[>input]/input-group:pt-2 va:[.border-b]:pb-2",
        "block-end":
          "va:order-last va:w-full va:justify-start va:px-2.5 va:pb-2 va:group-has-[>input]/input-group:pb-2 va:[.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "va:flex va:items-center va:gap-2 va:text-sm va:shadow-none",
  {
    variants: {
      size: {
        xs: "va:h-6 va:gap-1 va:rounded-[calc(var(--radius)-3px)] va:px-1.5 va:[&>svg:not([class*=size-])]:size-3.5",
        sm: "va:h-7 va:px-2",
        "icon-xs":
          "va:size-6 va:rounded-[calc(var(--radius)-3px)] va:p-0 va:has-[>svg]:p-0",
        "icon-sm": "va:size-8 va:p-0 va:has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "va:flex va:items-center va:gap-2 va:text-sm va:text-muted-foreground va:[&_svg]:pointer-events-none va:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "va:flex-1 va:rounded-none va:border-0 va:bg-transparent va:shadow-none va:ring-0 va:focus-visible:ring-0 va:disabled:bg-transparent va:aria-invalid:ring-0  ",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "va:flex-1 va:resize-none va:rounded-none va:border-0 va:bg-transparent va:py-2 va:shadow-none va:ring-0 va:focus-visible:ring-0 va:disabled:bg-transparent va:aria-invalid:ring-0  ",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}

