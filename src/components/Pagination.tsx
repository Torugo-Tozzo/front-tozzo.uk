import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatNumber } from "@/i18n/format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PaginationProps {
  currentPage: number
  totalPages?: number
  hasMore?: boolean
  onPageChange: (page: number) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
  isLoading?: boolean
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  hasMore, 
  onPageChange,
  pageSize,
  onPageSizeChange,
  isLoading = false
}: PaginationProps) {
  const { i18n, t } = useTranslation("common")
  const isNextDisabled = (totalPages && totalPages > 0 
    ? currentPage >= totalPages 
    : !hasMore) || isLoading;

  return (
    <div className="flex items-center justify-end space-x-4 py-4">
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium">{t("pagination.rowsPerPage")}</p>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
          }}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-[70px] border-0 bg-primary text-primary-foreground shadow-[inset_0_0_0_2px_hsl(var(--foreground)),inset_0_0_0_3px_hsl(var(--background))] transition-transform hover:scale-105">
            <SelectValue placeholder={formatNumber(pageSize, i18n.language)} />
          </SelectTrigger>
          <SelectContent side="top">
            {[10, 20, 35].map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {formatNumber(size, i18n.language)}
              </SelectItem>
            ))}
          
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <div className="text-sm text-muted-foreground">
          {totalPages && totalPages > 0
            ? t("pagination.pageOf", {
              page: formatNumber(currentPage, i18n.language),
              total: formatNumber(totalPages, i18n.language),
            })
            : <>{t("pagination.page")} {formatNumber(currentPage, i18n.language)}</>}
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          aria-label={t("previous")}
          title={t("previous")}
        >
          <ChevronLeft className="h-4 w-4" />
          {t("previous")}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isNextDisabled}
          aria-label={t("next")}
          title={t("next")}
        >
          {t("next")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
