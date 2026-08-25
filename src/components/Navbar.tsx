import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import logo from "@/assets/images/logo.svg"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { LogOut, Menu } from "lucide-react"
import { useTranslation } from "react-i18next"

interface NavbarProps {
  // So usado pelo DashboardLayout (abrir o drawer da sidebar no mobile).
  // Sem isso, botao nao aparece - navbar continua igual nas paginas publicas.
  onMenuClick?: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { isAuthenticated, user, logout } = useAuth()
  const confirm = useConfirm()
  const { t: tCommon } = useTranslation("common")
  const { t: tNavigation } = useTranslation("navigation")

  const handleLogout = async () => {
    if (!(await confirm({
      title: tCommon("logoutConfirmation.title"),
      description: tCommon("logoutConfirmation.description"),
      confirmLabel: tCommon("logoutConfirmation.confirm"),
    }))) return
    logout()
  }

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="w-full px-4 h-16 flex items-center justify-between relative">
        <div className="flex items-center gap-2">
          {onMenuClick && (
            <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={onMenuClick}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">{tCommon("accessibility.openMenu")}</span>
            </Button>
          )}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <img src={logo} alt="Tozzo.uk" className="h-12 w-12 object-contain" />
            <span>Tozzo.uk</span>
          </Link>
        </div>

        {isAuthenticated && user?.establishment && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
            <span className="font-semibold text-lg">{user.establishment.tradeName}</span>
          </div>
        )}

        <nav className="flex items-center gap-4">
          <ModeToggle />
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium hidden sm:inline-block">
                {user?.name || tCommon("notInformed")}
              </span>
              <Button variant="ghost" size="icon" onClick={handleLogout} title={tCommon("accessibility.logout")} className="border border-foreground text-muted-foreground hover:text-destructive">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">{tCommon("accessibility.logout")}</span>
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button variant="outline">{tNavigation("login")}</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
