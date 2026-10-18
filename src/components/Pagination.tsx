import { ChevronLeft, ChevronRight } from "lucide-solid"

import { Button } from "@/components/ui/button"
import { DeferredPageSizeSelect } from "@/components/DeferredPageSizeSelect"
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

export function Pagination(props: PaginationProps) {
  const { t, language } = useTranslation("common")
  const isNextDisabled = () => (props.totalPages && props.totalPages > 0
    ? props.currentPage >= props.totalPages
    : !props.hasMore) || !!props.isLoading

  return (
    <div class="flex items-center justify-end space-x-4 py-4">
      <div class="flex items-center space-x-2">
        <p class="text-sm font-medium">{t("pagination.rowsPerPage")}</p>
        <DeferredPageSizeSelect value={props.pageSize} onChange={props.onPageSizeChange} disabled={props.isLoading} />
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
