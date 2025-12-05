import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import logo from "@/assets/images/logo.png"

export function Navbar() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <img src={logo} alt="Tozzo.uk" className="h-12 w-12 object-contain" />
          <span>Tozzo.uk</span>
        </Link>
        <nav className="flex items-center gap-4">
          <ModeToggle />
          <Link to="/login">
            <Button variant="outline">Fazer Login</Button>
          </Link>
        </nav>
      </div>
    </header>
  )
}
