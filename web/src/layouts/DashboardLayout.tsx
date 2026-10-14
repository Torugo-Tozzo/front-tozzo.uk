import { createEffect, createSignal, For, onCleanup, onMount, Show, Suspense, type JSX } from "solid-js"
import { useLocation } from "@solidjs/router"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import {
  DollarSign,
  CalendarDays,
  ShoppingBag,
  Settings,
  LogOut,
  ClipboardList,
  X,
  Users,
  Smartphone,
  BarChart3,
  ChefHat,
  Bike,
  Wrench,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-solid"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { LoadingOverlay } from "@/components/LoadingOverlay"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { useTranslation } from "@/i18n/solid"
import { api } from "@/api/client"
import { unwrap } from "@/api/errors"
import { startRealtime } from "@/realtime"
import { formatNumber } from "@/i18n/format"
import { resolveNavigationModules, type NavigationModule } from "@/domain/businessPreferences"
import { lazyPage } from "@/lib/lazy-page"

// Only a new owner ever sees it: kept out of the layout chunk.
const EstablishmentOnboardingModal = lazyPage(() =>
  import("@/components/dashboard/EstablishmentOnboardingModal").then((module) => ({ default: module.EstablishmentOnboardingModal })))

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"
const MOBILE_MENU_ANIMATION_MS = 200
const COUNT_REFRESH_MS = 60_000

type CountedHref = "/dashboard/orders" | "/dashboard/kitchen" | "/dashboard/deliveries" | "/dashboard/service-orders"

// Sidebar badges: the `total` of a one-item page. The keys start with the
// realtime keys (src/realtime.ts), so an event refreshes them.
function useSidebarCounts(visible: () => NavigationModule[]) {
  const count = (
    key: string,
    module: NavigationModule,
    load: (signal: AbortSignal) => Promise<{ total: number }>,
  ) => useQuery(() => ({
    queryKey: [key, "sidebar-count"],
    queryFn: async ({ signal }) => (await load(signal)).total,
    enabled: visible().includes(module),
    refetchInterval: COUNT_REFRESH_MS,
  }))

  const orders = count("orders", "ORDERS", async (signal) =>
    unwrap(await api.GET("/v1/orders", { params: { query: { limit: 1 } }, signal })))
  const kitchen = count("kitchen", "KITCHEN", async (signal) =>
    unwrap(await api.GET("/v1/kitchen/orders", { params: { query: { limit: 1 } }, signal })))
  const delivery = count("delivery", "DELIVERIES", async (signal) =>
    unwrap(await api.GET("/v1/delivery/orders", { params: { query: { limit: 1 } }, signal })))
  const services = count("service-orders", "SERVICE_ORDERS", async (signal) =>
    unwrap(await api.GET("/v1/service-orders", { params: { query: { limit: 1, stage: "services", open: "true" } }, signal })))

  return (href: CountedHref) => {
    const query = { "/dashboard/orders": orders, "/dashboard/kitchen": kitchen, "/dashboard/deliveries": delivery, "/dashboard/service-orders": services }[href]
    return query.data ?? 0
  }
}

export default function DashboardLayout(props: { children?: JSX.Element }) {
  const location = useLocation()
  const { logout, user, refreshUserProfile } = useAuth()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { t: tCommon, language } = useTranslation("common")
  const { t: tNavigation } = useTranslation("navigation")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false)
  // Stays mounted during the exit animation, or the drawer would vanish at once.
  const [shouldRenderMobileMenu, setShouldRenderMobileMenu] = createSignal(false)
  const [isCollapsed, setIsCollapsed] = createSignal(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true")
  const visibleModules = () => resolveNavigationModules(user()?.role, user()?.establishment)
  const countOf = useSidebarCounts(visibleModules)
  const needsOnboarding = () => {
    const current = user()
    if (current?.role !== "OWNER") return false
    const establishment = current.establishment
    return establishment?.businessProfiles === undefined
      ? establishment?.category == null
      : establishment.businessProfiles.length === 0
  }

  onMount(() => {
    const refresh = () => { if (!document.hidden) void refreshUserProfile() }
    window.addEventListener("focus", refresh)
    const interval = window.setInterval(refresh, 60_000)
    const stopRealtime = startRealtime(queryClient)
    onCleanup(() => {
      window.removeEventListener("focus", refresh)
      window.clearInterval(interval)
      stopRealtime()
    })
  })

  createEffect(() => {
    if (isMobileMenuOpen()) {
      setShouldRenderMobileMenu(true)
      return
    }
    const timer = setTimeout(() => setShouldRenderMobileMenu(false), MOBILE_MENU_ANIMATION_MS)
    onCleanup(() => clearTimeout(timer))
  })

  createEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed()))
  })

  const handleLogout = async () => {
    if (!(await confirm({
      title: tCommon("logoutConfirmation.title"),
      description: tCommon("logoutConfirmation.description"),
      confirmLabel: tCommon("logoutConfirmation.confirm"),
    }))) return
    void logout()
  }

  const navItems = () => [
    { module: "ORDERS", href: "/dashboard/orders", label: tNavigation("orders"), icon: ClipboardList },
    { module: "KITCHEN", href: "/dashboard/kitchen", label: tNavigation("kitchen"), icon: ChefHat },
    { module: "DELIVERIES", href: "/dashboard/deliveries", label: tNavigation("deliveries"), icon: Bike },
    { module: "SALES", href: "/dashboard/sales", label: tNavigation("sales"), icon: DollarSign },
    { module: "PRODUCTS", href: "/dashboard/products", label: tNavigation("products"), icon: ShoppingBag },
    { module: "SERVICES", href: "/dashboard/services", label: tNavigation("serviceCatalog"), icon: Wrench },
    { module: "ESTIMATES", href: "/dashboard/estimates", label: tNavigation("estimates"), icon: FileText },
    { module: "SERVICE_ORDERS", href: "/dashboard/service-orders", label: tNavigation("services"), icon: ClipboardList },
    { module: "EMPLOYEES", href: "/dashboard/employees", label: tNavigation("employees"), icon: Users },
    { module: "SCHEDULE", href: "/dashboard/schedule", label: tNavigation("schedule"), icon: CalendarDays },
    { module: "DEVICES", href: "/dashboard/devices", label: tNavigation("devices"), icon: Smartphone },
    { module: "REPORTS", href: "/dashboard/charts", label: tNavigation("reports"), icon: BarChart3 },
    { module: "SETTINGS", href: "/dashboard/settings", label: tNavigation("settings"), icon: Settings },
  ].filter((item) => visibleModules().includes(item.module as NavigationModule))

  const isCounted = (href: string): href is CountedHref =>
    href === "/dashboard/orders" || href === "/dashboard/kitchen" || href === "/dashboard/deliveries" || href === "/dashboard/service-orders"

  // Logo and "Tozzo.uk" are in the Navbar; the sidebar has the nav and the collapse toggle.
  const NavContent = (navProps: { collapsed?: boolean; showToggle?: boolean }) => (
    <>
      <nav aria-label={tNavigation("dashboard")} class="flex-1 space-y-4 overflow-y-auto overflow-x-hidden">
        <For each={navItems()}>
          {(item) => {
            const isActive = () => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`) || (item.href === "/dashboard/orders" && location.pathname === "/dashboard")
            const Icon = item.icon

            return (
              <a
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                title={navProps.collapsed ? item.label : undefined}
              >
                <Button
                  variant="ghost"
                  aria-label={navProps.collapsed ? item.label : undefined}
                  class={cn(
                    // hover:text-foreground keeps the active item's text from
                    // turning black on hover. Only border-b per item: the aside
                    // already has border-r, and border-t would double the lines.
                    "w-full gap-3 rounded-none border-b border-l border-foreground hover:text-foreground",
                    isActive() && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                    navProps.collapsed ? "justify-center px-0" : "justify-start"
                  )}
                >
                  <div class={cn("flex items-center w-full", navProps.collapsed ? "justify-center" : "justify-between")}>
                    <div class="flex items-center gap-3">
                      <Icon class="h-5 w-5 shrink-0" />
                      {!navProps.collapsed && item.label}
                    </div>
                    <Show when={!navProps.collapsed && isCounted(item.href)}>
                      <div class="ml-2">
                        {/* Inverted when active: bg-primary is the active item's own background. */}
                        <span class={cn(
                          "inline-flex items-center justify-center text-xs font-medium rounded-full h-6 w-6",
                          isActive() ? "bg-background text-foreground" : "bg-primary text-primary-foreground"
                        )}>
                          {formatNumber(countOf(item.href as CountedHref), language())}
                        </span>
                      </div>
                    </Show>
                  </div>
                </Button>
              </a>
            )
          }}
        </For>
      </nav>

      <div class={cn("p-4 border-t shrink-0 flex gap-2", navProps.collapsed ? "flex-col" : "flex-row")}>
        <Show when={navProps.showToggle}>
          <Button
            variant="ghost"
            onClick={() => setIsCollapsed((v) => !v)}
            class={cn("gap-3 border border-foreground text-muted-foreground hover:text-foreground shrink-0", navProps.collapsed ? "w-full justify-center px-0" : "px-3")}
            title={navProps.collapsed ? tNavigation("expandMenu") : tNavigation("collapseMenu")}
            aria-label={navProps.collapsed ? tNavigation("expandMenu") : tNavigation("collapseMenu")}
          >
            {navProps.collapsed ? <PanelLeftOpen class="h-5 w-5 shrink-0" /> : <PanelLeftClose class="h-5 w-5 shrink-0" />}
          </Button>
        </Show>

        <Show when={!navProps.collapsed}>
          <Button
            variant="ghost"
            class="flex-1 gap-3 border border-foreground text-muted-foreground hover:text-destructive justify-start"
            onClick={handleLogout}
            aria-label={tNavigation("logout")}
          >
            <LogOut class="h-5 w-5 shrink-0" />
            {tNavigation("logout")}
          </Button>
        </Show>
      </div>
    </>
  )

  return (
    <div class="min-h-screen flex flex-col">
      <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />

      {/* Owner whose establishment has no business profile yet (legacy: no category). */}
      <Show when={needsOnboarding()}>
        <Suspense>
          <EstablishmentOnboardingModal
            open
            initialRevision={user()?.establishment?.preferencesRevision ?? 0}
            onSaved={refreshUserProfile}
          />
        </Suspense>
      </Show>

      <div class="flex-1 flex bg-muted/20">
        {/* Desktop Sidebar */}
        <aside
          class={cn(
            "bg-card border-r hidden md:flex flex-col shrink-0 sticky top-16 h-[calc(100vh-4rem)] transition-all duration-300",
            isCollapsed() ? "w-20" : "w-64"
          )}
        >
          <NavContent collapsed={isCollapsed()} showToggle />
        </aside>

        {/* Mobile Sidebar Overlay */}
        <Show when={shouldRenderMobileMenu()}>
          <div
            class={cn(
              "fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm md:hidden duration-200",
              isMobileMenuOpen() ? "animate-in fade-in-0" : "animate-out fade-out-0 fill-mode-forwards"
            )}
          >
            <div
              class={cn(
                "fixed inset-y-0 left-0 w-3/4 max-w-xs bg-card border-r shadow-lg flex flex-col duration-200",
                isMobileMenuOpen() ? "animate-in slide-in-from-left" : "animate-out slide-out-to-left fill-mode-forwards"
              )}
            >
              <div class="flex justify-end p-2 border-b shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label={tNavigation("closeMenu")}
                  title={tNavigation("closeMenu")}
                >
                  <X class="h-5 w-5" />
                </Button>
              </div>
              <NavContent />
            </div>
            <div class="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        </Show>

        {/* min-h keeps the footer level with the end of the sidebar on short
            pages; on long pages it grows with the content. */}
        <div class="flex-1 flex flex-col w-full min-w-0 min-h-[calc(100vh-4rem)]">
          <main class="flex-1 p-4 md:p-6">
            <Suspense fallback={<LoadingOverlay />}>
              {props.children}
            </Suspense>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  )
}
