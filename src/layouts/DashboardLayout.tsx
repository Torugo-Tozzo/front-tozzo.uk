import { useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Settings, 
  LogOut,
  ClipboardList,
  Menu,
  X,
  Users,
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Footer } from "@/components/Footer"
import logo from "@/assets/images/logo.png"
import { useAuth } from "@/contexts/AuthContext"

export default function DashboardLayout() {
  const location = useLocation()
  const { logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    { href: "/dashboard/orders", label: "Pedidos", icon: ClipboardList },
    { href: "/dashboard/sales", label: "Vendas", icon: LayoutDashboard },
    { href: "/dashboard/products", label: "Produtos", icon: ShoppingBag },
    { href: "/dashboard/employees", label: "Funcionários", icon: Users },
    { href: "/dashboard/charts", label: "Relatórios", icon: BarChart3 },
    { href: "/dashboard/settings", label: "Configurações", icon: Settings },
  ]

  const NavContent = () => (
    <>
      <div className="h-16 flex items-center justify-between px-6 border-b shrink-0">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl" onClick={() => setIsMobileMenuOpen(false)}>
          <img src={logo} alt="Tozzo.uk" className="h-10 w-10 object-contain" />
          <span>Tozzo.uk</span>
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href || (item.href === "/dashboard/orders" && location.pathname === "/dashboard")
          
          return (
            <Link key={item.href} to={item.href} onClick={() => setIsMobileMenuOpen(false)}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn("w-full justify-start gap-3", isActive && "bg-secondary")}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t shrink-0">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-card border-r hidden md:flex flex-col fixed inset-y-0 left-0 z-20">
        <NavContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
          <div className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-card border-r shadow-lg flex flex-col animate-in slide-in-from-left duration-200">
             <div className="absolute right-4 top-4 md:hidden">
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
             </div>
             <NavContent />
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen transition-all duration-300 ease-in-out w-full">
        {/* Mobile Header */}
        <header className="h-16 border-b bg-card flex items-center px-4 md:hidden justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2 font-bold">
              <img src={logo} alt="Tozzo.uk" className="h-8 w-8 object-contain" />
              <span>Tozzo.uk</span>
            </div>
          </div>
          <ModeToggle />
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
        
        <Footer />
      </div>
    </div>
  )
}
