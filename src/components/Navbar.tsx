import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import logo from "@/assets/images/logo.png"
import { useAuth } from "@/contexts/AuthContext"
import { LogOut } from "lucide-react"

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <img src={logo} alt="Tozzo.uk" className="h-12 w-12 object-contain" />
          <span>Tozzo.uk</span>
        </Link>

        {isAuthenticated && user?.estabelecimento && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
            <span className="font-semibold text-lg">{user.estabelecimento.nomeFantasia}</span>
          </div>
        )}

        <nav className="flex items-center gap-4">
          <ModeToggle />
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium hidden sm:inline-block">
                {user?.nome}
              </span>
              <Button variant="ghost" size="icon" onClick={logout} title="Sair">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Sair</span>
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button variant="outline">Fazer Login</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
