import { Github, Linkedin, Mail } from "lucide-react"
import { Button } from "./ui/button"

export function Footer() {
  return (
    // py-4 + linha unica de h-10 (botoes icon) = 72px, igual ao rodape da
    // sidebar (p-4 + Button h-10 + p-4) - pra alinhar as duas border-t na
    // mesma altura quando ambos ficam no fim da tela.
    <footer className="border-t py-4 bg-muted/40 mt-auto">
      <div className="container mx-auto px-4 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground text-sm">&copy; {new Date().getFullYear()} Tozzo.uk. Todos os direitos reservados.</p>
        <div className="flex items-center gap-4">
          <a href="https://www.linkedin.com/in/victor-hugo-tozzo/" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="border border-foreground hover:text-primary">
              <Linkedin className="h-5 w-5" />
              <span className="sr-only">LinkedIn</span>
            </Button>
          </a>
          <a href="https://github.com/Torugo-Tozzo" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="border border-foreground hover:text-primary">
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </Button>
          </a>
          <a href="mailto:victorhugo.tozzo@gmail.com">
            <Button variant="ghost" size="icon" className="border border-foreground hover:text-primary">
              <Mail className="h-5 w-5" />
              <span className="sr-only">Email</span>
            </Button>
          </a>
        </div>
      </div>
    </footer>
  )
}
