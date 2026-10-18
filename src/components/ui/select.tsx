import { splitProps, type ComponentProps, type JSX } from "solid-js"
import { Select as SelectPrimitive } from "@kobalte/core/select"
import { Check, ChevronDown } from "lucide-solid"

import { cn } from "@/lib/utils"
import { SELECT_TRIGGER_CLASS } from './select-trigger-class'

// Kobalte's Select takes the options up front and renders each one through
// `itemComponent` (usually a <SelectItem item={props.item}>), instead of
// Radix's <SelectItem> children. Radix's popper offset (translate-y-1 on
// data-[side=bottom]) is the root's gutter; like Radix's popper, the list
// starts at the trigger's left edge and is at least as wide (min-w on the
// listbox), instead of Kobalte's centered, same-width default.
function Select<Option, OptGroup = never>(props: ComponentProps<typeof SelectPrimitive<Option, OptGroup>>) {
  return <SelectPrimitive<Option, OptGroup> gutter={4} placement="bottom-start" sameWidth={false} {...props} />
}

const SelectValue = SelectPrimitive.Value

const SelectHiddenSelect = SelectPrimitive.HiddenSelect

function SelectTrigger(props: ComponentProps<typeof SelectPrimitive.Trigger<"button">>) {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <SelectPrimitive.Trigger
      class={cn(
        SELECT_TRIGGER_CLASS,
        local.class
      )}
      {...others}
    >
      {local.children}
      <SelectPrimitive.Icon as={ChevronDown} class="h-4 w-4 opacity-50" />
    </SelectPrimitive.Trigger>
  )
}

// A modal Dialog hides everything outside it from assistive technology
// (aria-hidden), and the select's portal is added outside it: marked as a top
// layer, it stays visible, so the options of a select inside a dialog are
// still announced (Radix does the same for its popper).
const markTopLayer = (container: Element) => {
  container.setAttribute("data-kb-top-layer", "")
  container.setAttribute("data-react-aria-top-layer", "true")
}

function SelectContent(props: ComponentProps<typeof SelectPrimitive.Content<"div">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <SelectPrimitive.Portal ref={markTopLayer}>
      <SelectPrimitive.Content
        class={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class
        )}
        {...others}
      >
        <SelectPrimitive.Listbox class="p-1 w-full min-w-[var(--kb-popper-anchor-width)]" />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <div class={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", local.class)} {...others} />
}

// Radix's focus:bg-accent marks the highlighted option; Kobalte highlights with
// data-[highlighted] (focus may stay on the listbox), so both are kept.
function SelectItem(props: ComponentProps<typeof SelectPrimitive.Item<"li">>) {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <SelectPrimitive.Item
      class={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class
      )}
      {...others}
    >
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check class="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemLabel>{local.children}</SelectPrimitive.ItemLabel>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <div class={cn("-mx-1 my-1 h-px bg-muted", local.class)} {...others} />
}

export {
  Select,
  SelectValue,
  SelectHiddenSelect,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}
