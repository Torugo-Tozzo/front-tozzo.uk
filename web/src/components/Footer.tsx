import { Github, Linkedin, Mail } from "lucide-solid"

import { Button } from "./ui/button"
import { useTranslation } from "@/i18n/solid"

export function Footer() {
  const { t } = useTranslation("common")

  return (
    // py-4 + one h-10 row (icon buttons) = 72px, the height of the sidebar
    // footer (p-4 + Button h-10 + p-4), so both border-t line up.
    <footer class="border-t py-4 bg-muted/40 mt-auto">
      <div class="container mx-auto px-4 flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-4 flex-wrap">
          <p class="text-muted-foreground text-sm">
            {t("footerCopyright", { year: new Date().getFullYear() })}
          </p>
          <a href="/privacidade" target="_blank" rel="noreferrer" class="text-muted-foreground text-sm underline hover:text-primary">
            {t("footerPrivacy")}
          </a>
          <a href="/termos" target="_blank" rel="noreferrer" class="text-muted-foreground text-sm underline hover:text-primary">
            {t("footerTerms")}
          </a>
        </div>
        <div class="flex items-center gap-4">
          <a href="https://www.linkedin.com/in/victor-hugo-tozzo/" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" class="border border-foreground hover:text-primary">
              <Linkedin class="h-5 w-5" />
              <span class="sr-only">{t("accessibility.linkedin")}</span>
            </Button>
          </a>
          <a href="https://github.com/Torugo-Tozzo" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" class="border border-foreground hover:text-primary">
              <Github class="h-5 w-5" />
              <span class="sr-only">{t("accessibility.github")}</span>
            </Button>
          </a>
          <a href="mailto:suporte@tozzo.uk">
            <Button variant="ghost" size="icon" class="border border-foreground hover:text-primary">
              <Mail class="h-5 w-5" />
              <span class="sr-only">{t("accessibility.email")}</span>
            </Button>
          </a>
        </div>
      </div>
    </footer>
  )
}
