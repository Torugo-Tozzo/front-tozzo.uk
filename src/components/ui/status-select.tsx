import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { ORDER_ITEM_STATUS_OPTIONS, getStatusLabel, type OrderItemStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

interface StatusSelectProps {
  value: OrderItemStatus
  onValueChange: (value: OrderItemStatus) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

export function StatusSelect({ value, onValueChange, disabled, className, ariaLabel }: StatusSelectProps) {
  const { i18n } = useTranslation()

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as OrderItemStatus)} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("w-[170px] bg-background text-foreground", className)}
      >
        <SelectValue>{getStatusLabel(value, i18n.language)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ORDER_ITEM_STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{getStatusLabel(opt.value, i18n.language)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
