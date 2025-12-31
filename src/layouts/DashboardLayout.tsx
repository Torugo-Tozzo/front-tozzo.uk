import { useState, useEffect, useRef } from "react"
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
import api from "@/services/api"

export default function DashboardLayout() {
  const location = useLocation()
  const { logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [nonClosedCount, setNonClosedCount] = useState<number>(0)
  const lastAutoFetchRef = useRef<number>(0)

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

  // SSE: update badge in realtime
  useEffect(() => {
    let stopped = false
    const ac = new AbortController()

    const connect = async () => {
      try {
        const base = (api as any).defaults?.baseURL || window.location.origin
        const url = `${String(base).replace(/\/$/, '')}/pedidos/stream`

        // try to obtain token from api defaults or localStorage
        let token = undefined
        try {
          const authHeader = (api as any).defaults?.headers?.Authorization
          if (typeof authHeader === 'string') token = authHeader.replace(/^Bearer\s+/i, '')
        } catch {}
        if (!token) {
          const stored = localStorage.getItem('tozzo_token')
          if (stored) token = stored.replace(/^Bearer\s+/i, '')
        }

        const headers: Record<string,string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        console.log('[Dashboard SSE] connecting', { url, tokenPresent: !!token })
        const res = await fetch(url, { headers, signal: ac.signal })
        if (!res.ok) {
          console.error('[Dashboard SSE] fetch error', res.status)
          return
        }
        console.log('[Dashboard SSE] connected')
        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let buf = ''

        while (!stopped) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            buf += chunk
            // try split messages
            const parts = buf.split(/\n\n/)
            buf = parts.pop() || ''
            for (const part of parts) {
              const lines = part.split(/\n/).filter(Boolean)
              const dataLines = lines.filter(l => l.startsWith('data:')).map(l => l.replace(/^data:\s?/, ''))
              if (dataLines.length === 0) continue
              const dataStr = dataLines.join('\n')
              try {
                const payload = JSON.parse(dataStr)
                const action = payload.action
                const order = payload.order
                console.log('[Dashboard SSE] payload', { action, order })

                // handle simple cases locally to avoid full refetch
                if (action === 'created') {
                  if (order && order.status !== 'FECHADO') {
                    setNonClosedCount(c => c + 1)
                  }
                } else if (action === 'deleted') {
                  if (order && order.status !== 'FECHADO') {
                    setNonClosedCount(c => Math.max(0, c - 1))
                  } else {
                    // unknown: fallback to full fetch
                    const now = Date.now()
                    if (now - (lastAutoFetchRef.current || 0) > 2000) {
                      lastAutoFetchRef.current = now
                      try { const resp = await api.get('/pedidos', { params: { limit: 1000 } });
                        let items: any[] = []
                        if (resp.data && resp.data.data) items = resp.data.data
                        else if (Array.isArray(resp.data)) items = resp.data
                        const count = items.filter(i => i?.status !== 'FECHADO').length
                        setNonClosedCount(count)
                      } catch (e) { console.error('[Dashboard SSE] fallback fetch error', e) }
                    }
                  }
                } else if (action === 'updated') {
                  // changes in status are tricky; do a guarded full fetch
                  const now = Date.now()
                  if (now - (lastAutoFetchRef.current || 0) > 2000) {
                    lastAutoFetchRef.current = now
                    try { const resp = await api.get('/pedidos', { params: { limit: 1000 } });
                      let items: any[] = []
                      if (resp.data && resp.data.data) items = resp.data.data
                      else if (Array.isArray(resp.data)) items = resp.data
                      const count = items.filter(i => i?.status !== 'FECHADO').length
                      setNonClosedCount(count)
                    } catch (e) { console.error('[Dashboard SSE] fallback fetch error', e) }
                  }
                }
              } catch (e) {
                console.error('[Dashboard SSE] parse error', e)
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('[Dashboard SSE] connection error', err)
        if (!stopped) setTimeout(() => { if (!stopped) connect() }, 3000)
      }
    }

    connect()

    return () => { stopped = true; try { ac.abort() } catch {} }
  }, [])

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
