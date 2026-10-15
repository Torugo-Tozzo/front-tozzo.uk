import { ChevronLeft, ChevronRight } from "lucide-solid"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatNumber } from "@/i18n/format"
import { useTranslation } from "@/i18n/solid"

interface PaginationProps {
  currentPage: number
  totalPages?: number
  hasMore?: boolean
  onPageChange: (page: number) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
  isLoading?: boolean
}

const PAGE_SIZES = ["10", "20", "35"]

export function Pagination(props: PaginationProps) {
  const { t, language } = useTranslation("common")
  const isNextDisabled = () => (props.totalPages && props.totalPages > 0
    ? props.currentPage >= props.totalPages
    : !props.hasMore) || !!props.isLoading

  return (
    <div class="flex items-center justify-end space-x-4 py-4">
      <div class="flex items-center space-x-2">
        <p class="text-sm font-medium">{t("pagination.rowsPerPage")}</p>
        <Select<string>
          options={PAGE_SIZES}
          value={String(props.pageSize)}
          onChange={(value) => { if (value) props.onPageSizeChange(Number(value)) }}
          disabled={props.isLoading}
          // Radix's side="top": the list opens above the trigger.
          placement="top-start"
          // The Radix trigger was the flex item itself (it shrinks on narrow
          // screens): Kobalte's wrapper stays out of the layout, and the
          // trigger takes the space-x-2 margin the wrapper would get.
          class="contents"
          itemComponent={(item) => <SelectItem item={item.item}>{formatNumber(Number(item.item.rawValue), language())}</SelectItem>}
        >
          {/* Radix blocks pointer events outside an open select, so its
              trigger loses the hover scale while the list is open; Kobalte
              does not, hence data-[expanded]:hover:scale-100. */}
          <SelectTrigger
            class="ml-2 h-8 w-[70px] border-0 bg-primary text-primary-foreground shadow-[inset_0_0_0_2px_hsl(var(--foreground)),inset_0_0_0_3px_hsl(var(--background))] transition-transform hover:scale-105 data-[expanded]:hover:scale-100"
            aria-label={t("pagination.rowsPerPage")}
          >
            <SelectValue<string>>{() => formatNumber(props.pageSize, language())}</SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>

      <div class="flex items-center space-x-2">
        <div class="text-sm text-muted-foreground">
          {props.totalPages && props.totalPages > 0
            ? t("pagination.pageOf", {
              page: formatNumber(props.currentPage, language()),
              total: formatNumber(props.totalPages, language()),
            })
            : t("pagination.page", { page: formatNumber(props.currentPage, language()) })}
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => props.onPageChange(props.currentPage - 1)}
          disabled={props.currentPage <= 1 || props.isLoading}
          aria-label={t("previous")}
          title={t("previous")}
        >
          <ChevronLeft class="h-4 w-4" />
          {t("previous")}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => props.onPageChange(props.currentPage + 1)}
          disabled={isNextDisabled()}
          aria-label={t("next")}
          title={t("next")}
        >
          {t("next")}
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
