import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LoadingOverlay() {
  const { t } = useTranslation("common")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">{t("loading")}</p>
      </div>
    </div>
  );
}
