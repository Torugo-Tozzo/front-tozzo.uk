import { Show } from "solid-js"
import { LogOut, Menu } from "lucide-solid"

import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import logo from "@/assets/images/logo.svg"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { useTranslation } from "@/i18n/solid"

interface NavbarProps {
  // Only the DashboardLayout passes it (opens the sidebar drawer on mobile).
  onMenuClick?: () => void
}

export function Navbar(props: NavbarProps) {
  const { isAuthenticated, user, logout } = useAuth()
  const confirm = useConfirm()
  const { t: tCommon } = useTranslation("common")
  const { t: tAuth } = useTranslation("auth")
  const { t: tNavigation } = useTranslation("navigation")

  const establishmentLabel = () => user()?.establishment?.tradeName
    || (user()?.establishment?.status === "PENDING_PAYMENT"
      ? tAuth("pendingPayment")
      : tCommon("notInformed"))

  const handleLogout = async () => {
    if (!(await confirm({
      title: tCommon("logoutConfirmation.title"),
      description: tCommon("logoutConfirmation.description"),
      confirmLabel: tCommon("logoutConfirmation.confirm"),
    }))) return
    void logout()
  }

  return (
    <header class="border-b bg-background sticky top-0 z-50">
      <div class="w-full px-4 h-16 flex items-center justify-between relative">
        <div class="flex items-center gap-2">
          <Show when={props.onMenuClick}>
            <Button variant="ghost" size="icon" class="md:hidden -ml-2" onClick={() => props.onMenuClick?.()}>
              <Menu class="h-5 w-5" />
              <span class="sr-only">{tCommon("accessibility.openMenu")}</span>
            </Button>
          </Show>
          <a href="/" class="flex items-center gap-2 font-bold text-xl">
            <img src={logo} alt="Tozzo.uk" class="h-12 w-12 object-contain" />
            <span>Tozzo.uk</span>
          </a>
        </div>

        <Show when={isAuthenticated() && user()?.establishment}>
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
            <span class="font-semibold text-lg">{establishmentLabel()}</span>
          </div>
        </Show>

        <nav class="flex items-center gap-4">
          <ModeToggle />
          <Show
            when={isAuthenticated()}
            fallback={
              <a href="/login">
                <Button variant="outline">{tNavigation("login")}</Button>
              </a>
            }
          >
            <div class="flex items-center gap-4">
              <span class="text-sm font-medium hidden sm:inline-block">
                {user()?.name || tCommon("notInformed")}
              </span>
              <Button variant="ghost" size="icon" onClick={handleLogout} title={tCommon("accessibility.logout")} class="border border-foreground text-muted-foreground hover:text-destructive">
                <LogOut class="h-5 w-5" />
                <span class="sr-only">{tCommon("accessibility.logout")}</span>
              </Button>
            </div>
          </Show>
        </nav>
      </div>
    </header>
  )
}
