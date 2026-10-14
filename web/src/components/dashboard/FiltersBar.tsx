import { createSignal, Show } from "solid-js"
import { ChevronDown, ChevronUp, Loader2, Plus, Search } from "lucide-solid"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/i18n/solid"
import { centsFromInput, inputFromCents } from "@/lib/money"

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

// Each field declares its own width (instead of splitting the space into
// equal columns): a narrow field (time, amount) leaves no dead space nor
// pushes the rest to a new line. On mobile they stack (w-full) up to sm.
const WIDTH_DATE = "w-full sm:w-[170px]"
const WIDTH_TIME = "w-full sm:w-[130px]"
const WIDTH_SELECT = "w-full sm:w-[190px]"
const WIDTH_TEXT = "w-full sm:w-[220px]"
const WIDTH_MONEY = "w-full sm:w-[140px]"

/** The React money mask: the digits typed are read as cents ("6" → "0.06"). */
const maskCentsInput = (value: string) => inputFromCents(centsFromInput(value))

export function FiltersBar(props: FiltersBarProps) {
  const { t: tCommon } = useTranslation("common")
  const { t: tCharts } = useTranslation("charts")

  // Collapsed by default only matters on mobile (below sm): the toggle shows
  // only there (sm:hidden), and larger screens always show the panel (sm:block).
  const [isExpanded, setIsExpanded] = createSignal(false)

  return (
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{tCommon("filters")}</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="sm:hidden"
          onClick={() => setIsExpanded((value) => !value)}
          aria-expanded={isExpanded()}
          aria-label={isExpanded() ? tCommon("accessibility.collapseFilters") : tCommon("accessibility.expandFilters")}
        >
          <Show when={isExpanded()} fallback={<ChevronDown class="h-4 w-4" />}>
            <ChevronUp class="h-4 w-4" />
          </Show>
        </Button>
      </CardHeader>
      <CardContent class={isExpanded() ? "block" : "hidden sm:block"}>
        <div class="flex flex-wrap gap-4">
          <Show when={props.dateRange}>
            {(dateRange) => (
              <>
                <div class={`space-y-2 ${WIDTH_DATE}`}>
                  <Label for="filter-startDate">{tCharts("filters.startDate")}</Label>
                  <Input
                    id="filter-startDate"
                    type="date"
                    value={dateRange().startDate}
                    onInput={(e) => dateRange().onStartDateChange(e.currentTarget.value)}
                    disabled={props.isLoading}
                  />
                </div>
                <div class={`space-y-2 ${WIDTH_TIME}`}>
                  <Label for="filter-startTime">{tCharts("filters.startTime")}</Label>
                  <Input
                    id="filter-startTime"
                    type="time"
                    value={dateRange().startTime}
                    onInput={(e) => dateRange().onStartTimeChange(e.currentTarget.value)}
                    disabled={props.isLoading}
                  />
                </div>
                <div class={`space-y-2 ${WIDTH_DATE}`}>
                  <Label for="filter-endDate">{tCharts("filters.endDate")}</Label>
                  <Input
                    id="filter-endDate"
                    type="date"
                    value={dateRange().endDate}
                    onInput={(e) => dateRange().onEndDateChange(e.currentTarget.value)}
                    disabled={props.isLoading}
                  />
                </div>
                <div class={`space-y-2 ${WIDTH_TIME}`}>
                  <Label for="filter-endTime">{tCharts("filters.endTime")}</Label>
                  <Input
                    id="filter-endTime"
                    type="time"
                    value={dateRange().endTime}
                    onInput={(e) => dateRange().onEndTimeChange(e.currentTarget.value)}
                    disabled={props.isLoading}
                  />
                </div>
              </>
            )}
          </Show>

          <Show when={props.status}>
            {(status) => {
              const labelOf = (value: string) => status().options.find((option) => option.value === value)?.label ?? ""
              return (
                <div class={`space-y-2 ${WIDTH_SELECT}`}>
                  <Label for="filter-status">{tCommon("status")}</Label>
                  <Select<string>
                    options={status().options.map((option) => option.value)}
                    value={status().value}
                    onChange={(value) => { if (value) status().onChange(value) }}
                    placeholder={status().placeholder ?? tCommon("status")}
                    itemComponent={(item) => <SelectItem item={item.item}>{labelOf(item.item.rawValue)}</SelectItem>}
                  >
                    <SelectTrigger id="filter-status" aria-label={tCommon("status")}>
                      <SelectValue<string>>{(state) => labelOf(state.selectedOption())}</SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>
              )
            }}
          </Show>

          <Show when={props.customerName}>
            {(customerName) => (
              <div class={`space-y-2 ${WIDTH_TEXT}`}>
                <Label for="filter-customerName">{tCommon("customer")}</Label>
                <Input
                  id="filter-customerName"
                  placeholder={customerName().placeholder ?? tCommon("placeholders.customer")}
                  value={customerName().value}
                  onInput={(e) => customerName().onChange(e.currentTarget.value)}
                  disabled={props.isLoading}
                />
              </div>
            )}
          </Show>

          <Show when={props.createdBy}>
            {(createdBy) => (
              <div class={`space-y-2 ${WIDTH_TEXT}`}>
                <Label for="filter-createdBy">{tCommon("createdBy")}</Label>
                <Input
                  id="filter-createdBy"
                  placeholder={createdBy().placeholder ?? tCommon("placeholders.employee")}
                  value={createdBy().value}
                  onInput={(e) => createdBy().onChange(e.currentTarget.value)}
                  disabled={props.isLoading}
                />
              </div>
            )}
          </Show>

          <Show when={props.totalRange}>
            {(totalRange) => {
              // The input shows the masked text right away (a controlled input in React).
              const masked = (input: HTMLInputElement, onChange: (value: string) => void) => {
                const value = maskCentsInput(input.value)
                input.value = value
                onChange(value)
              }
              return (
                <>
                  <div class={`space-y-2 ${WIDTH_MONEY}`}>
                    <Label for="filter-totalMin">{tCommon("minimumTotal")}</Label>
                    <Input
                      id="filter-totalMin"
                      inputMode="numeric"
                      placeholder={tCommon("placeholders.amount")}
                      value={totalRange().min}
                      onInput={(e) => masked(e.currentTarget, totalRange().onMinChange)}
                      disabled={props.isLoading}
                    />
                  </div>
                  <div class={`space-y-2 ${WIDTH_MONEY}`}>
                    <Label for="filter-totalMax">{tCommon("maximumTotal")}</Label>
                    <Input
                      id="filter-totalMax"
                      inputMode="numeric"
                      placeholder={tCommon("placeholders.amount")}
                      value={totalRange().max}
                      onInput={(e) => masked(e.currentTarget, totalRange().onMaxChange)}
                      disabled={props.isLoading}
                    />
                  </div>
                </>
              )
            }}
          </Show>
        </div>
        <div class={`mt-4 flex flex-col sm:flex-row sm:items-center gap-4 ${props.primaryAction ? "sm:justify-between" : "sm:justify-end"}`}>
          <Show when={props.primaryAction}>
            {(primaryAction) => (
              <Button type="button" onClick={() => primaryAction().onClick()} disabled={props.isLoading} class="w-full sm:w-auto">
                <Plus class="mr-2 h-4 w-4" />
                {primaryAction().label}
              </Button>
            )}
          </Show>
          <Button onClick={() => props.onFilter()} class="w-full sm:w-auto" disabled={props.isLoading}>
            <Show when={props.isLoading} fallback={<Search class="mr-2 h-4 w-4" />}>
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            </Show>
            {tCommon("search")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
