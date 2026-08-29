import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export default function PrivacyPolicyPage() {
  const { t } = useTranslation("legal")

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-3xl font-bold">{t("privacyTitle")}</h1>
      <p className="text-sm text-muted-foreground border rounded-md p-3">{t("draftNotice")}</p>
      <p>{t("privacyIntro")}</p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("privacyControllerTitle")}</h2>
        <p>{t("privacyControllerBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("privacyDataCollectedTitle")}</h2>
        <p>{t("privacyDataCollectedBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("privacyPurposeTitle")}</h2>
        <p>{t("privacyPurposeBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("privacySharingTitle")}</h2>
        <p>{t("privacySharingBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("privacyRightsTitle")}</h2>
        <p>{t("privacyRightsBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{t("privacyRetentionTitle")}</h2>
        <p>{t("privacyRetentionBody")}</p>
      </section>

      <Button asChild variant="outline">
        <Link to="/login">{t("backToRegister")}</Link>
      </Button>
    </div>
  )
}
