import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { BarChart3, Search } from "lucide-react"

// Mock Data
const mockData = [
  { name: "Hambúrguer", type: "Comida", sales: 120, revenue: 4200 },
  { name: "Refrigerante", type: "Bebida", sales: 300, revenue: 1800 },
  { name: "Pudim", type: "Sobremesa", sales: 80, revenue: 960 },
  { name: "Batata Frita", type: "Comida", sales: 150, revenue: 2250 },
  { name: "Suco Natural", type: "Bebida", sales: 100, revenue: 1200 },
  { name: "Sorvete", type: "Sobremesa", sales: 60, revenue: 900 },
  { name: "X-Bacon", type: "Comida", sales: 90, revenue: 3600 },
]

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

export default function ChartsPage() {
  // Filters
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [foodType, setFoodType] = useState("Todos")
  const [foodName, setFoodName] = useState("")
  const [chartType, setChartType] = useState<"bar" | "column" | "line" | "pie">("bar")

  // Filter Logic
  const filteredData = mockData.filter((item) => {
    const matchesType = foodType === "Todos" || item.type === foodType
    const matchesName = item.name.toLowerCase().includes(foodName.toLowerCase())
    // Date filtering would go here if we had date fields in the mock data
    return matchesType && matchesName
  })

  const renderChart = () => {
    switch (chartType) {
      case "bar": // Horizontal Bar
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart layout="vertical" data={filteredData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
              <Bar dataKey="revenue" name="Receita" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "column": // Vertical Bar
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
              <Bar dataKey="revenue" name="Receita" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Receita" stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="sales" name="Vendas (Qtd)" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        )
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={150}
                fill="#8884d8"
                dataKey="revenue"
                nameKey="name"
              >
                {filteredData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8" />
          Relatórios e Gráficos
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Alimento</Label>
              <Select value={foodType} onValueChange={setFoodType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  <SelectItem value="Comida">Comida</SelectItem>
                  <SelectItem value="Bebida">Bebida</SelectItem>
                  <SelectItem value="Sobremesa">Sobremesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Alimento</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-8"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Gráfico</Label>
              <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barras (Horizontal)</SelectItem>
                  <SelectItem value="column">Colunas (Vertical)</SelectItem>
                  <SelectItem value="line">Linhas</SelectItem>
                  <SelectItem value="pie">Pizza</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[500px]">
        <CardHeader>
          <CardTitle>Visualização de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length > 0 ? (
            renderChart()
          ) : (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
