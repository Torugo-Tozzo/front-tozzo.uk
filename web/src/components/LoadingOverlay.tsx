import { Loader2 } from "lucide-solid"

import { useTranslation } from "@/i18n/solid"

export function LoadingOverlay() {
  const { t } = useTranslation("common")

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div class="flex flex-col items-center gap-2">
        <Loader2 class="h-10 w-10 animate-spin text-primary" />
        <p class="text-sm text-muted-foreground font-medium animate-pulse">{t("loading")}</p>
      </div>
    </div>
  )
}
