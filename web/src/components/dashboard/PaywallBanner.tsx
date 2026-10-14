import { Show } from "solid-js"
import { useNavigate } from "@solidjs/router"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/solid"

export type PaywallCode = "PLAN_UPGRADE_REQUIRED" | "REPORT_QUOTA_EXCEEDED"

interface PaywallBannerProps {
  code: PaywallCode
  role?: string
}

/**
 * Shown in place of a screen the plan does not include (a 403
 * PLAN_UPGRADE_REQUIRED; see isPlanUpgradeRequired()). The React app has the
 * same banner but never reached it (plan S0).
 */
export function PaywallBanner(props: PaywallBannerProps) {
  const { t: tErrors } = useTranslation("errors")
  const navigate = useNavigate()

  return (
    <Alert variant="warning" class="mb-4">
      <AlertTitle>
        {props.code === "PLAN_UPGRADE_REQUIRED" ? tErrors("planUpgradeRequired") : tErrors("reportQuotaExceeded")}
      </AlertTitle>
      <AlertDescription>
        <Show when={props.role === "OWNER"} fallback={<span class="mt-2 block">{tErrors("askOwnerCta")}</span>}>
          <Button type="button" variant="outline" size="sm" class="mt-3" onClick={() => navigate("/plan")}>
            {tErrors("upgradeCta")}
          </Button>
        </Show>
      </AlertDescription>
    </Alert>
  )
}
