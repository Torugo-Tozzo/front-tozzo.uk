import { splitProps, type ComponentProps, type JSX } from "solid-js"
import { DropdownMenu as DropdownMenuPrimitive } from "@kobalte/core/dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-solid"

import { cn } from "@/lib/utils"

// Radix -> Kobalte: data-[state=open] becomes data-[expanded]; Radix's
// sideOffset={4} is the root's gutter; data-[side=*] only drove the entry
// animation, so it maps to nothing here.
function DropdownMenu(props: ComponentProps<typeof DropdownMenuPrimitive>) {
  return <DropdownMenuPrimitive gutter={4} {...props} />
}

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

function DropdownMenuSubTrigger(props: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger<"div">> & { inset?: boolean }) {
  const [local, others] = splitProps(props, ["class", "inset", "children"])
  return (
    <DropdownMenuPrimitive.SubTrigger
      class={cn(
        "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[expanded]:bg-accent",
        local.inset && "pl-8",
        local.class
      )}
      {...others}
    >
      {local.children}
      <ChevronRight class="ml-auto h-4 w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent(props: ComponentProps<typeof DropdownMenuPrimitive.SubContent<"div">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        class={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class
        )}
        {...others}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuContent(props: ComponentProps<typeof DropdownMenuPrimitive.Content<"div">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        class={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class
        )}
        {...others}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

const itemClass =
  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"

function DropdownMenuItem(props: ComponentProps<typeof DropdownMenuPrimitive.Item<"div">> & { inset?: boolean }) {
  const [local, others] = splitProps(props, ["class", "inset"])
  return (
    <DropdownMenuPrimitive.Item
      class={cn(itemClass, local.inset && "pl-8", local.class)}
      {...others}
    />
  )
}

function DropdownMenuCheckboxItem(props: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem<"div">>) {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <DropdownMenuPrimitive.CheckboxItem class={cn(itemClass, local.class)} {...others}>
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check class="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioItem(props: ComponentProps<typeof DropdownMenuPrimitive.RadioItem<string, "div">>) {
  const [local, others] = splitProps(props, ["class", "children"])
  return (
    <DropdownMenuPrimitive.RadioItem class={cn(itemClass, local.class)} {...others}>
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle class="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

// Radix's Label is a plain div outside any group; Kobalte's GroupLabel needs a
// Group, so this one is a div too.
function DropdownMenuLabel(props: JSX.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  const [local, others] = splitProps(props, ["class", "inset"])
  return (
    <div
      class={cn(
        "px-2 py-1.5 text-sm font-semibold",
        local.inset && "pl-8",
        local.class
      )}
      {...others}
    />
  )
}

function DropdownMenuSeparator(props: ComponentProps<typeof DropdownMenuPrimitive.Separator<"hr">>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <DropdownMenuPrimitive.Separator
      as="div"
      class={cn("-mx-1 my-1 h-px bg-muted", local.class)}
      {...others}
    />
  )
}

function DropdownMenuShortcut(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  const [local, others] = splitProps(props, ["class"])
  return (
    <span
      class={cn("ml-auto text-xs tracking-widest opacity-60", local.class)}
      {...others}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
