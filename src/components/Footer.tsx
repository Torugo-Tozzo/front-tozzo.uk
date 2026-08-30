import { Github, Linkedin, Mail } from "lucide-react"
import { Button } from "./ui/button"
import { useTranslation } from "react-i18next"

export function Footer() {
  const { t } = useTranslation("common")

  return (
    // py-4 + linha unica de h-10 (botoes icon) = 72px, igual ao rodape da
    // sidebar (p-4 + Button h-10 + p-4) - pra alinhar as duas border-t na
    // mesma altura quando ambos ficam no fim da tela.
    <footer className="border-t py-4 bg-muted/40 mt-auto">
      <div className="container mx-auto px-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-muted-foreground text-sm">
            {t("footerCopyright", { year: new Date().getFullYear() })}
          </p>
          <a href="/privacidade" target="_blank" rel="noreferrer" className="text-muted-foreground text-sm underline hover:text-primary">
            {t("footerPrivacy")}
          </a>
          <a href="/termos" target="_blank" rel="noreferrer" className="text-muted-foreground text-sm underline hover:text-primary">
            {t("footerTerms")}
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://www.linkedin.com/in/victor-hugo-tozzo/" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="border border-foreground hover:text-primary">
              <Linkedin className="h-5 w-5" />
              <span className="sr-only">{t("accessibility.linkedin")}</span>
            </Button>
          </a>
          <a href="https://github.com/Torugo-Tozzo" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="border border-foreground hover:text-primary">
              <Github className="h-5 w-5" />
              <span className="sr-only">{t("accessibility.github")}</span>
            </Button>
          </a>
          <a href="mailto:victorhugo.tozzo@gmail.com">
            <Button variant="ghost" size="icon" className="border border-foreground hover:text-primary">
              <Mail className="h-5 w-5" />
              <span className="sr-only">{t("accessibility.email")}</span>
            </Button>
          </a>
        </div>
      </div>
    </footer>
  )
}
