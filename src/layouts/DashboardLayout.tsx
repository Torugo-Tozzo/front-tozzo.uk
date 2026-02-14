import { useState, useEffect, Suspense } from "react"
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
  BarChart3,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Footer } from "@/components/Footer"
import { LoadingOverlay } from "@/components/LoadingOverlay"
import logo from "@/assets/images/logo.png"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/services/api"

export default function DashboardLayout() {
  const location = useLocation()
  const { logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [nonClosedCount, setNonClosedCount] = useState<number>(0)

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
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </div>
                  {item.href === "/dashboard/orders" && (
                    <div className="ml-2">
                      <span className="inline-flex items-center justify-center bg-blue-500 text-white text-xs font-medium rounded-full h-6 w-6">
                        {nonClosedCount}
                      </span>
                    </div>
                  )}
                </div>
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

  useEffect(() => {
    let mounted = true
    const fetchCount = async () => {
      try {
        // fetch a reasonable number of pedidos and count non-FECHADO
        const resp = await api.get('/pedidos', { params: { limit: 1000 } })
        let items: any[] = []
        if (resp.data && resp.data.data) items = resp.data.data
        else if (Array.isArray(resp.data)) items = resp.data
        const count = items.filter(i => i?.status !== 'FECHADO').length
        if (mounted) setNonClosedCount(count)
      } catch (err) {
        console.error('Error fetching non-closed orders count', err)
      }
    }

    fetchCount()
    const iv = setInterval(fetchCount, 15000)
    return () => { mounted = false; clearInterval(iv) }
  }, [])

  // Realtime badge updates removed (SSE removed)

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
          <Suspense fallback={<LoadingOverlay />}>
            <Outlet />
          </Suspense>
        </main>
        
        <Footer />
      </div>
    </div>
  )
}
