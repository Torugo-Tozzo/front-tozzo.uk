import { splitProps, type ComponentProps } from "solid-js"
import { Tabs as TabsPrimitive } from "@kobalte/core/tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive

function TabsList(props: ComponentProps<typeof TabsPrimitive.List<"div">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <TabsPrimitive.List
      class={cn(
        // In light mode --muted (96.1%) almost matches the background (100%),
        // so the list uses a stronger gray there; dark keeps --muted.
        "inline-flex h-10 items-center justify-center rounded-md border border-foreground bg-[hsl(0,0%,85%)] dark:bg-muted p-1 text-muted-foreground",
        local.class
      )}
      {...others}
    />
  )
}

// Radix's data-[state=active] becomes Kobalte's data-[selected].
function TabsTrigger(props: ComponentProps<typeof TabsPrimitive.Trigger<"button">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <TabsPrimitive.Trigger
      class={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-primary data-[selected]:text-primary-foreground",
        local.class
      )}
      {...others}
    />
  )
}

function TabsContent(props: ComponentProps<typeof TabsPrimitive.Content<"div">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <TabsPrimitive.Content
      class={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        local.class
      )}
      {...others}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
