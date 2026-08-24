import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { STATUS_OPTIONS, getStatusColor, type OrderStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

interface StatusSelectProps {
  value: OrderStatus
  onValueChange: (value: OrderStatus) => void
  disabled?: boolean
  className?: string
}

export function StatusSelect({ value, onValueChange, disabled, className }: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as OrderStatus)} disabled={disabled}>
      <SelectTrigger
        className={cn("w-[150px] border-2 bg-background text-foreground transition-transform hover:scale-105", className)}
        style={{ borderColor: getStatusColor(value) }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
