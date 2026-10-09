import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "voxel-armory-overlay va:fixed va:inset-0 va:isolate va:z-50 va:bg-background/80 va:duration-100 va:supports-backdrop-filter:backdrop-blur-xs va:data-open:animate-in va:data-open:fade-in-0 va:data-closed:animate-out va:data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "default",
  portalContainer,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  variant?: "default" | "armory"
  portalContainer?: HTMLElement
}) {
  return (
    <DialogPortal container={portalContainer}>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-variant={variant}
        className={cn(
          "va:fixed va:top-1/2 va:left-1/2 va:z-50 va:grid va:w-full va:max-w-[calc(100%-2rem)] va:-translate-x-1/2 va:-translate-y-1/2 va:gap-4 va:rounded-xl va:bg-popover va:p-4 va:text-sm va:text-popover-foreground va:ring-1 va:ring-foreground/10 va:duration-100 va:outline-none va:sm:max-w-sm va:data-open:animate-in va:data-open:fade-in-0 va:data-open:zoom-in-95 va:data-closed:animate-out va:data-closed:fade-out-0 va:data-closed:zoom-out-95",
          variant === "armory" && "voxel-armory-modal",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="va:absolute va:top-2 va:right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="va:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("va:flex va:flex-col va:gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "va:-mx-4 va:-mb-4 va:flex va:flex-col-reverse va:gap-2 va:rounded-b-xl va:border-t va:bg-muted/50 va:p-4 va:sm:flex-row va:sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "va:text-base va:leading-none va:font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "va:text-sm va:text-muted-foreground va:*:[a]:underline va:*:[a]:underline-offset-3 va:*:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
