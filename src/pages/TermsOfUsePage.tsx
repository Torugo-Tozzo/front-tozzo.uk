import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export default function TermsOfUsePage() {
  const { t } = useTranslation("legal")

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-3xl font-bold">{t("termsTitle")}</h1>
      <p className="text-sm text-muted-foreground border rounded-md p-3">{t("draftNotice")}</p>
      <p>{t("termsIntro")}</p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("termsAccountTitle")}</h2>
        <p>{t("termsAccountBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("termsUseTitle")}</h2>
        <p>{t("termsUseBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("termsLiabilityTitle")}</h2>
        <p>{t("termsLiabilityBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("termsChangesTitle")}</h2>
        <p>{t("termsChangesBody")}</p>
      </section>

      <Button asChild variant="outline">
        <Link to="/login">{t("backToRegister")}</Link>
      </Button>
    </div>
  )
}
