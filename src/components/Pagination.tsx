import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
  const isNextDisabled = (totalPages && totalPages > 0 
    ? currentPage >= totalPages 
    : !hasMore) || isLoading;

  return (
    <div className="flex items-center justify-end space-x-4 py-4">
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium">Linhas por página</p>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
          }}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={pageSize.toString()} />
          </SelectTrigger>
          <SelectContent side="top">
            {[10, 20, 35].map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <div className="text-sm text-muted-foreground">
          Página {currentPage} {totalPages && totalPages > 0 ? `de ${totalPages}` : ''}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isNextDisabled}
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
