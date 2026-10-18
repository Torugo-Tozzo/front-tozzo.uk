import { splitProps, type JSX } from "solid-js"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

// A plain <label>, like Radix's: it also keeps a double click from selecting text.
function Label(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  const [local, others] = splitProps(props, ["class", "onMouseDown"])
  return (
    <label
      class={cn(labelVariants(), local.class)}
      onMouseDown={(event) => {
        if (typeof local.onMouseDown === "function") local.onMouseDown(event)
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault()
      }}
      {...others}
    />
  )
}

export { Label }
