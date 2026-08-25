import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Loader2, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { maskCentsInput } from "@/lib/currency"
import { useTranslation } from "react-i18next"

export interface DateRangeFilterProps {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  onStartDateChange: (value: string) => void
  onStartTimeChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onEndTimeChange: (value: string) => void
}

export interface TextFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export interface RangeFilterProps {
  min: string
  max: string
  onMinChange: (value: string) => void
  onMaxChange: (value: string) => void
}

export interface SelectFilterProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}

export interface PrimaryActionProps {
  label: string
  onClick: () => void
}

export interface FiltersBarProps {
  dateRange?: DateRangeFilterProps
  status?: SelectFilterProps
  customerName?: TextFilterProps
  createdBy?: TextFilterProps
  totalRange?: RangeFilterProps
  primaryAction?: PrimaryActionProps
  onFilter: () => void
  isLoading?: boolean
}

// Cada campo declara a propria largura (em vez de dividir o espaco em
// colunas iguais) - assim campo estreito (hora, valor) nao deixa espaco
// morto na propria celula nem empurra o resto pra uma linha nova. Mobile
// continua empilhado (w-full) ate o breakpoint sm.
const WIDTH_DATE = "w-full sm:w-[170px]"
const WIDTH_TIME = "w-full sm:w-[130px]"
const WIDTH_SELECT = "w-full sm:w-[190px]"
const WIDTH_TEXT = "w-full sm:w-[220px]"
const WIDTH_MONEY = "w-full sm:w-[140px]"

export function FiltersBar({
  dateRange,
  status,
  customerName,
  createdBy,
  totalRange,
  primaryAction,
  onFilter,
  isLoading,
}: FiltersBarProps) {
  const { t: tCommon } = useTranslation("common")
  const { t: tCharts } = useTranslation("charts")

  // Colapsado por padrao so importa no mobile (abaixo do breakpoint sm) -
  // o botao de expandir/recolher tambem so aparece la (sm:hidden). Em
  // telas maiores o painel fica sempre visivel via sm:block, ignorando
  // esse estado.
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{tCommon("filters")}</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? tCommon("accessibility.collapseFilters") : tCommon("accessibility.expandFilters")}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className={isExpanded ? "block" : "hidden sm:block"}>
        <div className="flex flex-wrap gap-4">
          {dateRange && (
            <>
              <div className={`space-y-2 ${WIDTH_DATE}`}>
                <Label htmlFor="filter-startDate">{tCharts("filters.startDate")}</Label>
                <Input
                  id="filter-startDate"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => dateRange.onStartDateChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className={`space-y-2 ${WIDTH_TIME}`}>
                <Label htmlFor="filter-startTime">{tCharts("filters.startTime")}</Label>
                <Input
                  id="filter-startTime"
                  type="time"
                  value={dateRange.startTime}
                  onChange={(e) => dateRange.onStartTimeChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className={`space-y-2 ${WIDTH_DATE}`}>
                <Label htmlFor="filter-endDate">{tCharts("filters.endDate")}</Label>
                <Input
                  id="filter-endDate"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => dateRange.onEndDateChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className={`space-y-2 ${WIDTH_TIME}`}>
                <Label htmlFor="filter-endTime">{tCharts("filters.endTime")}</Label>
                <Input
                  id="filter-endTime"
                  type="time"
                  value={dateRange.endTime}
                  onChange={(e) => dateRange.onEndTimeChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {status && (
            <div className={`space-y-2 ${WIDTH_SELECT}`}>
              <Label htmlFor="filter-status">{tCommon("status")}</Label>
              <Select value={status.value} onValueChange={status.onChange}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder={status.placeholder ?? tCommon("status")} />
                </SelectTrigger>
                <SelectContent>
                  {status.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {customerName && (
            <div className={`space-y-2 ${WIDTH_TEXT}`}>
              <Label htmlFor="filter-customerName">{tCommon("customer")}</Label>
              <Input
                id="filter-customerName"
                placeholder={customerName.placeholder ?? tCommon("placeholders.customer")}
                value={customerName.value}
                onChange={(e) => customerName.onChange(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {createdBy && (
            <div className={`space-y-2 ${WIDTH_TEXT}`}>
              <Label htmlFor="filter-createdBy">{tCommon("createdBy")}</Label>
              <Input
                id="filter-createdBy"
                placeholder={createdBy.placeholder ?? tCommon("placeholders.employee")}
                value={createdBy.value}
                onChange={(e) => createdBy.onChange(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {totalRange && (
            <>
              <div className={`space-y-2 ${WIDTH_MONEY}`}>
                <Label htmlFor="filter-totalMin">{tCommon("minimumTotal")}</Label>
                <Input
                  id="filter-totalMin"
                  inputMode="numeric"
                  placeholder={tCommon("placeholders.amount")}
                  value={totalRange.min}
                  onChange={(e) => totalRange.onMinChange(maskCentsInput(e.target.value))}
                  disabled={isLoading}
                />
              </div>
              <div className={`space-y-2 ${WIDTH_MONEY}`}>
                <Label htmlFor="filter-totalMax">{tCommon("maximumTotal")}</Label>
                <Input
                  id="filter-totalMax"
                  inputMode="numeric"
                  placeholder={tCommon("placeholders.amount")}
                  value={totalRange.max}
                  onChange={(e) => totalRange.onMaxChange(maskCentsInput(e.target.value))}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
        </div>
        <div className={`mt-4 flex flex-col sm:flex-row sm:items-center gap-4 ${primaryAction ? "sm:justify-between" : "sm:justify-end"}`}>
          {primaryAction && (
            <Button type="button" onClick={primaryAction.onClick} disabled={isLoading} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {primaryAction.label}
            </Button>
          )}
          <Button onClick={onFilter} className="w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {tCommon("search")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
