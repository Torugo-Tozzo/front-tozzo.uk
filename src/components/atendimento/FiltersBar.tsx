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
import { Search, Loader2 } from "lucide-react"
import { maskCentsInput } from "@/lib/currency"

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

export interface FiltersBarProps {
  dateRange?: DateRangeFilterProps
  status?: SelectFilterProps
  cliente?: TextFilterProps
  criadoPor?: TextFilterProps
  nome?: TextFilterProps
  tipo?: SelectFilterProps
  totalRange?: RangeFilterProps
  precoRange?: RangeFilterProps
  onFilter: () => void
  isLoading?: boolean
}

export function FiltersBar({
  dateRange,
  status,
  cliente,
  criadoPor,
  nome,
  tipo,
  totalRange,
  precoRange,
  onFilter,
  isLoading,
}: FiltersBarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dateRange && (
            <>
              <div className="space-y-2">
                <Label htmlFor="filter-startDate">Data Inicial</Label>
                <Input
                  id="filter-startDate"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => dateRange.onStartDateChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-startTime">Hora Inicial</Label>
                <Input
                  id="filter-startTime"
                  type="time"
                  className="max-w-[140px]"
                  value={dateRange.startTime}
                  onChange={(e) => dateRange.onStartTimeChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-endDate">Data Final</Label>
                <Input
                  id="filter-endDate"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => dateRange.onEndDateChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-endTime">Hora Final</Label>
                <Input
                  id="filter-endTime"
                  type="time"
                  className="max-w-[140px]"
                  value={dateRange.endTime}
                  onChange={(e) => dateRange.onEndTimeChange(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {status && (
            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <Select value={status.value} onValueChange={status.onChange}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder={status.placeholder ?? "Status"} />
                </SelectTrigger>
                <SelectContent>
                  {status.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {cliente && (
            <div className="space-y-2">
              <Label htmlFor="filter-cliente">Cliente / Mesa</Label>
              <Input
                id="filter-cliente"
                placeholder={cliente.placeholder ?? "Buscar cliente/mesa..."}
                value={cliente.value}
                onChange={(e) => cliente.onChange(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {criadoPor && (
            <div className="space-y-2">
              <Label htmlFor="filter-criadoPor">Criado por</Label>
              <Input
                id="filter-criadoPor"
                placeholder={criadoPor.placeholder ?? "Buscar funcionário..."}
                value={criadoPor.value}
                onChange={(e) => criadoPor.onChange(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {nome && (
            <div className="space-y-2">
              <Label htmlFor="filter-nome">Nome do produto</Label>
              <Input
                id="filter-nome"
                placeholder={nome.placeholder ?? "Buscar produto..."}
                value={nome.value}
                onChange={(e) => nome.onChange(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {tipo && (
            <div className="space-y-2">
              <Label htmlFor="filter-tipo">Tipo</Label>
              <Select value={tipo.value} onValueChange={tipo.onChange}>
                <SelectTrigger id="filter-tipo">
                  <SelectValue placeholder={tipo.placeholder ?? "Tipo"} />
                </SelectTrigger>
                <SelectContent>
                  {tipo.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {totalRange && (
            <>
              <div className="space-y-2">
                <Label htmlFor="filter-totalMin">Total mínimo</Label>
                <Input
                  id="filter-totalMin"
                  inputMode="numeric"
                  className="max-w-[140px]"
                  placeholder="0.00"
                  value={totalRange.min}
                  onChange={(e) => totalRange.onMinChange(maskCentsInput(e.target.value))}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-totalMax">Total máximo</Label>
                <Input
                  id="filter-totalMax"
                  inputMode="numeric"
                  className="max-w-[140px]"
                  placeholder="0.00"
                  value={totalRange.max}
                  onChange={(e) => totalRange.onMaxChange(maskCentsInput(e.target.value))}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {precoRange && (
            <>
              <div className="space-y-2">
                <Label htmlFor="filter-precoMin">Preço mínimo</Label>
                <Input
                  id="filter-precoMin"
                  inputMode="numeric"
                  className="max-w-[140px]"
                  placeholder="0.00"
                  value={precoRange.min}
                  onChange={(e) => precoRange.onMinChange(maskCentsInput(e.target.value))}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-precoMax">Preço máximo</Label>
                <Input
                  id="filter-precoMax"
                  inputMode="numeric"
                  className="max-w-[140px]"
                  placeholder="0.00"
                  value={precoRange.max}
                  onChange={(e) => precoRange.onMaxChange(maskCentsInput(e.target.value))}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onFilter} className="w-full md:w-auto" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Filtrar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
