import { Github, Linkedin, Mail } from "lucide-react"
import { Button } from "./ui/button"

export function Footer() {
  return (
    <footer className="border-t py-8 bg-muted/40 mt-auto">
      <div className="container mx-auto px-4 flex flex-col items-center gap-6">
        <div className="flex items-center gap-4">
          <a href="https://www.linkedin.com/in/victor-hugo-tozzo/" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="hover:text-primary">
              <Linkedin className="h-5 w-5" />
              <span className="sr-only">LinkedIn</span>
            </Button>
          </a>
          <a href="https://github.com/Torugo-Tozzo" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="hover:text-primary">
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </Button>
          </a>
          <a href="mailto:victorhugo.tozzo@gmail.com">
            <Button variant="ghost" size="icon" className="hover:text-primary">
              <Mail className="h-5 w-5" />
              <span className="sr-only">Email</span>
            </Button>
          </a>
        </div>
        <p className="text-muted-foreground text-sm">&copy; {new Date().getFullYear()} Tozzo.uk. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}
