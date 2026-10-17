import { Button } from "@/components/ui/button"
import { Ghost } from "lucide-solid"
import { useNavigate } from "@solidjs/router"
import { useTranslation } from "@/i18n/solid"

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { t } = useTranslation("common")

  return (
    <div class="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4 text-center">
      <div class="space-y-6 max-w-md">
        <div class="flex justify-center">
          <div class="relative">
            <div class="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
            <Ghost class="h-32 w-32 text-primary relative z-10 animate-bounce" />
          </div>
        </div>

        <div class="space-y-2">
          <h1 class="text-4xl font-bold tracking-tight">{t("notFound.code")}</h1>
          <h2 class="text-2xl font-semibold text-muted-foreground">
            {t("notFound.title")}
          </h2>
          <p class="text-muted-foreground">
            {t("notFound.description")}
          </p>
        </div>

        <div class="flex gap-4 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline">
            {t("notFound.back")}
          </Button>
          <Button onClick={() => navigate("/")}>
            {t("notFound.home")}
          </Button>
        </div>
      </div>
    </div>
  )
}
