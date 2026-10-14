import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { ORDER_ITEM_STATUS_OPTIONS, getStatusLabel, type OrderItemStatus } from "@/lib/status"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/i18n/solid"

interface StatusSelectProps {
  value: OrderItemStatus
  onValueChange: (value: OrderItemStatus) => void
  disabled?: boolean
  class?: string
  ariaLabel?: string
}

const OPTIONS = ORDER_ITEM_STATUS_OPTIONS.map((option) => option.value)

export function StatusSelect(props: StatusSelectProps) {
  const { language } = useTranslation()

  return (
    <Select<OrderItemStatus>
      options={OPTIONS}
      value={props.value === "REQUESTED" ? "IN_PREPARATION" : props.value}
      onChange={(value) => { if (value) props.onValueChange(value) }}
      disabled={props.disabled}
      itemComponent={(item) => (
        <SelectItem item={item.item}>{getStatusLabel(item.item.rawValue, language())}</SelectItem>
      )}
    >
      <SelectTrigger
        aria-label={props.ariaLabel}
        class={cn("w-[170px] bg-background text-foreground", props.class)}
      >
        <SelectValue<OrderItemStatus>>{() => getStatusLabel(props.value, language())}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )
}
