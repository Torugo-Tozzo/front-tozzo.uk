import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type PaywallCode = "PLAN_UPGRADE_REQUIRED" | "REPORT_QUOTA_EXCEEDED" | "DEVICE_LIMIT_REACHED";

interface PaywallBannerProps {
  code: PaywallCode;
  role?: string;
}

export function PaywallBanner({ code, role }: PaywallBannerProps) {
  const { t: tErrors } = useTranslation("errors");
  const navigate = useNavigate();
  const isOwner = role === "OWNER";

  const message = code === "PLAN_UPGRADE_REQUIRED"
    ? tErrors("planUpgradeRequired")
    : code === "REPORT_QUOTA_EXCEEDED"
      ? tErrors("reportQuotaExceeded")
      : tErrors("deviceLimitReached");

  return (
    <Alert variant="warning" className="mb-4">
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription>
        {isOwner ? (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => navigate("/plan")}>
            {tErrors("upgradeCta")}
          </Button>
        ) : (
          <span className="mt-2 block">{tErrors("askOwnerCta")}</span>
        )}
      </AlertDescription>
    </Alert>
  );
}
