import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "cn"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("va:flex va:w-full va:flex-col", className)}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("va:not-last:border-b", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="va:flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "va:group/accordion-trigger va:relative va:flex va:flex-1 va:items-start va:justify-between va:rounded-lg va:border va:border-transparent va:py-2.5 va:text-left va:text-sm va:font-medium va:transition-all va:outline-none va:hover:underline va:focus-visible:border-ring va:focus-visible:ring-3 va:focus-visible:ring-ring/50 va:focus-visible:after:border-ring va:aria-disabled:pointer-events-none va:aria-disabled:opacity-50 va:**:data-[slot=accordion-trigger-icon]:ml-auto va:**:data-[slot=accordion-trigger-icon]:size-4 va:**:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon data-slot="accordion-trigger-icon" className="va:pointer-events-none va:shrink-0 va:group-aria-expanded/accordion-trigger:hidden" />
        <ChevronUpIcon data-slot="accordion-trigger-icon" className="va:pointer-events-none va:hidden va:shrink-0 va:group-aria-expanded/accordion-trigger:inline" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="va:overflow-hidden va:text-sm va:data-open:animate-accordion-down va:data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "va:h-(--accordion-panel-height) va:pt-0 va:pb-2.5 va:data-ending-style:h-0 va:data-starting-style:h-0 va:[&_a]:underline va:[&_a]:underline-offset-3 va:[&_a]:hover:text-foreground va:[&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
