import { splitProps, type JSX } from "solid-js"

import { Button, type ButtonProps } from "./button"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends Omit<ButtonProps, "size" | "children"> {
  icon: JSX.Element
  label: string
}

export function IconButton(props: IconButtonProps) {
  const [local, others] = splitProps(props, ["icon", "label", "variant", "class"])
  return (
    <Button
      type="button"
      variant={local.variant ?? "ghost"}
      size="icon"
      aria-label={local.label}
      title={local.label}
      class={cn("transition-transform hover:scale-110", local.class)}
      {...others}
    >
      {local.icon}
    </Button>
  )
}
