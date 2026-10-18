import { A } from "@solidjs/router"
import { useTranslation } from "@/i18n/solid"
import { buttonVariants } from "@/components/ui/button"

export default function PrivacyPolicyPage() {
  const { t } = useTranslation("legal")

  return (
    <div class="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 class="text-3xl font-bold">{t("privacyTitle")}</h1>
      <p class="text-sm text-muted-foreground border rounded-md p-3">{t("draftNotice")}</p>
      <p>{t("privacyIntro")}</p>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("privacyControllerTitle")}</h2>
        <p>{t("privacyControllerBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("privacyDataCollectedTitle")}</h2>
        <p>{t("privacyDataCollectedBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("privacyPurposeTitle")}</h2>
        <p>{t("privacyPurposeBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("privacySharingTitle")}</h2>
        <p>{t("privacySharingBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("privacyRightsTitle")}</h2>
        <p>{t("privacyRightsBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("privacyRetentionTitle")}</h2>
        <p>{t("privacyRetentionBody")}</p>
      </section>

      <A class={buttonVariants({ variant: "outline" })} href="/login">{t("backToRegister")}</A>
    </div>
  )
}
