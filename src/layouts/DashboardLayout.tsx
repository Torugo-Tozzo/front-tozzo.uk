import { useState, useEffect, useCallback, Suspense } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  ShoppingBag,
  Settings,
  LogOut,
  ClipboardList,
  X,
  Users,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { LoadingOverlay } from "@/components/LoadingOverlay"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import api from "@/services/api"
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"
const MOBILE_MENU_ANIMATION_MS = 200

export default function DashboardLayout() {
  const location = useLocation()
  const { logout } = useAuth()
  const confirm = useConfirm()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // Fica montado durante a animacao de saida - sem isso o drawer some na
  // hora ao fechar (isMobileMenuOpen vira false -> desmonta -> sem tempo
  // de tocar o animate-out).
  const [shouldRenderMobileMenu, setShouldRenderMobileMenu] = useState(false)
  const [nonClosedCount, setNonClosedCount] = useState<number>(0)

  useEffect(() => {
    if (isMobileMenuOpen) {
      setShouldRenderMobileMenu(true)
      return
    }
    const timer = setTimeout(() => setShouldRenderMobileMenu(false), MOBILE_MENU_ANIMATION_MS)
    return () => clearTimeout(timer)
  }, [isMobileMenuOpen])
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  )

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed))
  }, [isCollapsed])

  const handleLogout = async () => {
    if (!(await confirm({ title: "Sair", description: "Tem certeza que deseja sair?", confirmLabel: "Sair" }))) return
    logout()
  }

  const navItems = [
    { href: "/dashboard/orders", label: "Pedidos", icon: ClipboardList },
    { href: "/dashboard/sales", label: "Vendas", icon: LayoutDashboard },
    { href: "/dashboard/products", label: "Produtos", icon: ShoppingBag },
    { href: "/dashboard/employees", label: "Funcionários", icon: Users },
    { href: "/dashboard/charts", label: "Relatórios", icon: BarChart3 },
    { href: "/dashboard/settings", label: "Configurações", icon: Settings },
  ]

  // Logo/"Tozzo.uk" ja aparecem na Navbar (topo, compartilhada com o resto
  // do site) - sidebar nao duplica mais isso, so nav + toggle de colapsar.
  const NavContent = ({ collapsed = false, showToggle = false }: { collapsed?: boolean; showToggle?: boolean }) => (
    <>
      <nav className="flex-1 space-y-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href || (item.href === "/dashboard/orders" && location.pathname === "/dashboard")

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              <Button
                variant="ghost"
                className={cn(
                  // hover:text-foreground trava a cor da letra no hover -
                  // variant="ghost" ja vem com hover:text-accent-foreground,
                  // que sem isso deixava o texto do item ativo (branco)
                  // virando preto no hover, quase sumindo no fundo escuro.
                  // Sem border-r: a aside ja tem border-r propria - com os
                  // botoes colados na borda (sem padding lateral), a borda
                  // direita do botao ficava quase em cima da da aside e as
                  // duas linhas de 1px desalinhavam, parecendo mais grossa.
                  // Cada item tem so border-b (uma linha, uniforme) - dar
                  // border-t tambem pro ultimo item duplicava a linha entre
                  // ele e o item anterior (o item de cima ja contribui com
                  // o proprio border-b pro mesmo vao).
                  "w-full gap-3 rounded-none border-b border-l border-foreground hover:text-foreground",
                  isActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                  collapsed ? "justify-center px-0" : "justify-start"
                )}
              >
                <div className={cn("flex items-center w-full", collapsed ? "justify-center" : "justify-between")}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && item.label}
                  </div>
                  {!collapsed && item.href === "/dashboard/orders" && (
                    <div className="ml-2">
                      {/* invertido quando ativo (bg-primary ja e' preto/branco
                          igual o fundo do item ativo - sumiria) */}
                      <span className={cn(
                        "inline-flex items-center justify-center text-xs font-medium rounded-full h-6 w-6",
                        isActive ? "bg-background text-foreground" : "bg-primary text-primary-foreground"
                      )}>
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

      <div className={cn("p-4 border-t shrink-0 flex gap-2", collapsed ? "flex-col" : "flex-row")}>
        {showToggle && (
          <Button
            variant="ghost"
            onClick={() => setIsCollapsed((v) => !v)}
            className={cn("gap-3 border border-foreground text-muted-foreground hover:text-foreground shrink-0", collapsed ? "w-full justify-center px-0" : "px-3")}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5 shrink-0" /> : <PanelLeftClose className="h-5 w-5 shrink-0" />}
          </Button>
        )}

        {!collapsed && (
          <Button
            variant="ghost"
            className="flex-1 gap-3 border border-foreground text-muted-foreground hover:text-destructive justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sair
          </Button>
        )}
      </div>
    </>
  )

  const fetchCount = useCallback(async () => {
    try {
      const resp = await api.get('/pedidos', { params: { status: 'NAO_FECHADOS', limit: 1 } })
      const totalHeader = resp.headers['x-total-count']
      const count = totalHeader ? parseInt(totalHeader) : (Array.isArray(resp.data) ? resp.data.length : 0)
      setNonClosedCount(count)
    } catch (err) {
      console.error('Error fetching non-closed orders count', err)
    }
  }, [])

  useRealtimeEvents(['pedidos'], fetchCount)

  useEffect(() => {
    fetchCount()
    const iv = setInterval(fetchCount, 60000)
    return () => clearInterval(iv)
  }, [fetchCount])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />

      <div className="flex-1 flex bg-muted/20">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "bg-card border-r hidden md:flex flex-col shrink-0 sticky top-16 h-[calc(100vh-4rem)] transition-all duration-300",
            isCollapsed ? "w-20" : "w-64"
          )}
        >
          <NavContent collapsed={isCollapsed} showToggle />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {shouldRenderMobileMenu && (
          <div
            className={cn(
              "fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm md:hidden duration-200",
              isMobileMenuOpen ? "animate-in fade-in-0" : "animate-out fade-out-0 fill-mode-forwards"
            )}
          >
            <div
              className={cn(
                "fixed inset-y-0 left-0 w-3/4 max-w-xs bg-card border-r shadow-lg flex flex-col duration-200",
                isMobileMenuOpen ? "animate-in slide-in-from-left" : "animate-out slide-out-to-left fill-mode-forwards"
              )}
            >
               <div className="flex justify-end p-2 border-b shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
               </div>
               <NavContent />
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Content Wrapper. min-h garante que o footer fica alinhado
            com o fim da sidebar em telas curtas (main cresce pra preencher
            o vazio via flex-1); em telas compridas o min-h so' e' o minimo,
            cresce normalmente e o footer desce junto com o conteudo. */}
        <div className="flex-1 flex flex-col w-full min-w-0 min-h-[calc(100vh-4rem)]">
          <main className="flex-1 p-4 md:p-6">
            <Suspense fallback={<LoadingOverlay />}>
              <Outlet />
            </Suspense>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  )
}
