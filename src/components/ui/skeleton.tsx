import { splitProps, type JSX } from "solid-js"

import { cn } from "@/lib/utils"

function Skeleton(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <div class={cn("animate-pulse rounded-md bg-muted", local.class)} {...others} />
}

export { Skeleton }
