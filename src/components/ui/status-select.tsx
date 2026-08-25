import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { STATUS_OPTIONS, getStatusColor, getStatusLabel, type OrderStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

interface StatusSelectProps {
  value: OrderStatus
  onValueChange: (value: OrderStatus) => void
  disabled?: boolean
  className?: string
}

export function StatusSelect({ value, onValueChange, disabled, className }: StatusSelectProps) {
  const { i18n } = useTranslation()

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as OrderStatus)} disabled={disabled}>
      <SelectTrigger
        className={cn("w-[150px] border-2 bg-background text-foreground transition-transform hover:scale-105", className)}
        style={{ borderColor: getStatusColor(value) }}
      >
        <SelectValue>{getStatusLabel(value, i18n.language)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{getStatusLabel(opt.value, i18n.language)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
