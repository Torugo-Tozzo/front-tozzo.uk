import { A } from "@solidjs/router"
import { useTranslation } from "@/i18n/solid"
import { buttonVariants } from "@/components/ui/button"

export default function TermsOfUsePage() {
  const { t } = useTranslation("legal")

  return (
    <div class="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 class="text-3xl font-bold">{t("termsTitle")}</h1>
      <p class="text-sm text-muted-foreground border rounded-md p-3">{t("draftNotice")}</p>
      <p>{t("termsIntro")}</p>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("termsAccountTitle")}</h2>
        <p>{t("termsAccountBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("termsUseTitle")}</h2>
        <p>{t("termsUseBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("termsLiabilityTitle")}</h2>
        <p>{t("termsLiabilityBody")}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-xl font-semibold">{t("termsChangesTitle")}</h2>
        <p>{t("termsChangesBody")}</p>
      </section>

      <A class={buttonVariants({ variant: "outline" })} href="/login">{t("backToRegister")}</A>
    </div>
  )
}
