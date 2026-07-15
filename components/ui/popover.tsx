"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  container,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & { container?: PopoverPrimitive.Portal.Props['container'] }) {
  return (
    <PopoverPrimitive.Portal container={container}>
      {/*
        Base UI's Popover.Portal defaults to appending to <body> — fine
        normally, but invisible/mispositioned when opened while an ancestor
        is in real browser Fullscreen (only the fullscreen element's own
        descendants render). Dialog already solved this with a `container`
        prop threaded from the fullscreen element's own ref (see
        components/ui/dialog.tsx); this mirrors that so any Popover opened
        from inside a fullscreen canvas (e.g. WorkingDayPicker in the
        flowchart's Add/Edit Task dialogs) can do the same.
      */}
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        // Higher than Dialog's z-[1100] (components/ui/dialog.tsx) —
        // a Popover (e.g. WorkingDayPicker) is routinely opened FROM INSIDE
        // a Dialog (the flowchart's Add/Edit Task forms), and both portal to
        // <body> as sibling layers, so a lower z-index here means the
        // dialog paints on top of the popover wherever they overlap — the
        // date picker rendering "behind" the modal instead of above it.
        className="isolate z-[1200]"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-[1200] flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
