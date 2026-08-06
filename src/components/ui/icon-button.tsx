import * as React from "react"
import { Button, type ButtonProps } from "./button"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'children'> {
  icon: React.ReactNode
  label: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = "ghost", className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={cn("transition-transform hover:scale-110", className)}
      {...props}
    >
      {icon}
    </Button>
  )
)
IconButton.displayName = "IconButton"
