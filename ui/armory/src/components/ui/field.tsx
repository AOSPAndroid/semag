"use client"

import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "va:flex va:flex-col va:gap-4 va:has-[>[data-slot=checkbox-group]]:gap-3 va:has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "va:mb-1.5 va:font-medium va:data-[variant=label]:text-sm va:data-[variant=legend]:text-base",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "va:group/field-group va:@container/field-group va:flex va:w-full va:flex-col va:gap-5 va:data-[slot=checkbox-group]:gap-3 va:*:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "va:group/field va:flex va:w-full va:gap-2 va:data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "va:flex-col va:*:w-full va:[&>.sr-only]:w-auto",
        horizontal:
          "va:flex-row va:items-center va:has-[>[data-slot=field-content]]:items-start va:*:data-[slot=field-label]:flex-auto va:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "va:flex-col va:*:w-full va:@md/field-group:flex-row va:@md/field-group:items-center va:@md/field-group:*:w-auto va:@md/field-group:has-[>[data-slot=field-content]]:items-start va:@md/field-group:*:data-[slot=field-label]:flex-auto va:[&>.sr-only]:w-auto va:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "va:group/field-content va:flex va:flex-1 va:flex-col va:gap-0.5 va:leading-snug",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "va:group/field-label va:peer/field-label va:flex va:w-fit va:gap-2 va:leading-snug va:group-data-[disabled=true]/field:opacity-50 va:has-data-checked:border-primary/30 va:has-data-checked:bg-primary/5 va:has-[>[data-slot=field]]:rounded-lg va:has-[>[data-slot=field]]:border va:has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 va:has-[>[data-slot=field]]:has-[:focus-visible]:border-ring va:has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 va:has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 va:*:data-[slot=field]:p-2.5 va:dark:has-data-checked:border-primary/20 va:dark:has-data-checked:bg-primary/10",
        "va:has-[>[data-slot=field]]:w-full va:has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "va:flex va:w-fit va:items-center va:gap-2 va:text-sm va:font-medium va:group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "va:text-left va:text-sm va:leading-normal va:font-normal va:text-muted-foreground va:group-has-data-horizontal/field:text-balance va:[[data-variant=legend]+&]:-mt-1.5",
        "va:last:mt-0 va:nth-last-2:-mt-1",
        "va:[&>a]:underline va:[&>a]:underline-offset-4 va:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "va:relative va:-my-2 va:h-5 va:text-sm va:group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="va:absolute va:inset-0 va:top-1/2" />
      {children && (
        <span
          className="va:relative va:mx-auto va:block va:w-fit va:bg-background va:px-2 va:text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="va:ml-4 va:flex va:list-disc va:flex-col va:gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("va:text-sm va:font-normal va:text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
