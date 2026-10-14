import { splitProps, type JSX } from "solid-js"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-md border p-4 text-sm",
  {
    variants: {
      variant: {
        default: "border bg-card text-card-foreground",
        warning:
          "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface AlertProps
  extends JSX.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert(props: AlertProps) {
  const [local, others] = splitProps(props, ["class", "variant"])
  return <div role="alert" class={cn(alertVariants({ variant: local.variant, className: local.class }))} {...others} />
}

function AlertTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <h5 class={cn("mb-1 font-medium leading-none tracking-tight", local.class)} {...others} />
}

function AlertDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const [local, others] = splitProps(props, ["class"])
  return <p class={cn("text-sm [&_p]:leading-relaxed", local.class)} {...others} />
}

export { Alert, AlertDescription, AlertTitle, alertVariants }
