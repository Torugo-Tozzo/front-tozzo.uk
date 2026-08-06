import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { STATUS_OPTIONS, getStatusColor, type PedidoStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

interface StatusSelectProps {
  value: PedidoStatus
  onValueChange: (value: PedidoStatus) => void
  disabled?: boolean
  className?: string
}

export function StatusSelect({ value, onValueChange, disabled, className }: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as PedidoStatus)} disabled={disabled}>
      {/* bg-white/text-black fixos nos dois temas - decisao do brainstorm:
          usar a variavel de tema aqui fazia o texto sumir no dark mode. */}
      <SelectTrigger
        className={cn("w-[150px] border-2 bg-white text-black", className)}
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
