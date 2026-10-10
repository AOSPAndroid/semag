"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ChevronDownIcon, XIcon, CheckIcon } from "lucide-react"

const Combobox = ComboboxPrimitive.Root

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("va:[&_svg:not([class*=size-])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon className="va:pointer-events-none va:size-4 va:text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="va:pointer-events-none" />
    </ComboboxPrimitive.Clear>
  )
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean
  showClear?: boolean
}) {
  return (
    <InputGroup className={cn("va:w-auto", className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="va:group-has-data-[slot=combobox-clear]/input-group:hidden va:data-pressed:bg-transparent"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  portalContainer,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  > & { portalContainer?: HTMLElement }) {
  return (
    <ComboboxPrimitive.Portal container={portalContainer}>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="va:isolate va:z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn("va:group/combobox-content va:relative va:max-h-(--available-height) va:w-(--anchor-width) va:max-w-(--available-width) va:min-w-[calc(var(--anchor-width)+--spacing(7))] va:origin-(--transform-origin) va:overflow-hidden va:rounded-lg va:bg-popover va:text-popover-foreground va:shadow-md va:ring-1 va:ring-foreground/10 va:duration-100 va:data-[chips=true]:min-w-(--anchor-width) va:data-[side=bottom]:slide-in-from-top-2 va:data-[side=inline-end]:slide-in-from-left-2 va:data-[side=inline-start]:slide-in-from-right-2 va:data-[side=left]:slide-in-from-right-2 va:data-[side=right]:slide-in-from-left-2 va:data-[side=top]:slide-in-from-bottom-2 va:*:data-[slot=input-group]:m-1 va:*:data-[slot=input-group]:mb-0 va:*:data-[slot=input-group]:h-8 va:*:data-[slot=input-group]:border-input/30 va:*:data-[slot=input-group]:bg-input/30 va:*:data-[slot=input-group]:shadow-none va:data-open:animate-in va:data-open:fade-in-0 va:data-open:zoom-in-95 va:data-closed:animate-out va:data-closed:fade-out-0 va:data-closed:zoom-out-95", className )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "va:no-scrollbar va:max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] va:scroll-py-1 va:overflow-y-auto va:overscroll-contain va:p-1 va:data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "va:relative va:flex va:w-full va:cursor-default va:items-center va:gap-2 va:rounded-md va:py-1 va:pr-8 va:pl-1.5 va:text-sm va:outline-hidden va:select-none va:data-highlighted:bg-accent va:data-highlighted:text-accent-foreground va:not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground va:data-disabled:pointer-events-none va:data-disabled:opacity-50 va:[&_svg]:pointer-events-none va:[&_svg]:shrink-0 va:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="va:pointer-events-none va:absolute va:right-2 va:flex va:size-4 va:items-center va:justify-center" />
        }
      >
        <CheckIcon className="va:pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  )
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("va:px-2 va:py-1.5 va:text-xs va:text-muted-foreground", className)}
      {...props}
    />
  )
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "va:hidden va:w-full va:justify-center va:py-2 va:text-center va:text-sm va:text-muted-foreground va:group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  )
}

function ComboboxSeparator({
  className,
  ...props
}: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("va:-mx-1 va:my-1 va:h-px va:bg-border", className)}
      {...props}
    />
  )
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "va:flex va:min-h-8 va:flex-wrap va:items-center va:gap-1 va:rounded-lg va:border va:border-input va:bg-transparent va:bg-clip-padding va:px-2.5 va:py-1 va:text-sm va:transition-colors va:focus-within:border-ring va:focus-within:ring-3 va:focus-within:ring-ring/50 va:has-aria-invalid:border-destructive va:has-aria-invalid:ring-3 va:has-aria-invalid:ring-destructive/20 va:has-data-[slot=combobox-chip]:px-1   ",
        className
      )}
      {...props}
    />
  )
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "va:flex va:h-[calc(--spacing(5.25))] va:w-fit va:items-center va:justify-center va:gap-1 va:rounded-sm va:bg-muted va:px-1.5 va:text-xs va:font-medium va:whitespace-nowrap va:text-foreground va:has-disabled:pointer-events-none va:has-disabled:cursor-not-allowed va:has-disabled:opacity-50 va:has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="va:-ml-1 va:opacity-50 va:hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="va:pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("va:min-w-16 va:flex-1 va:outline-none", className)}
      {...props}
    />
  )
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}

