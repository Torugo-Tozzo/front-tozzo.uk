import { ModeToggle } from "@/components/mode-toggle"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">Aparência</h2>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tema do sistema</span>
          <ModeToggle />
        </div>
      </div>

      <div className="p-10 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
        Mais configurações em breve...
      </div>
    </div>
  )
}
