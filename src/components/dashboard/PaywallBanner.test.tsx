import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n/config";
import { PaywallBanner } from "./PaywallBanner";

function renderBanner(code: "PLAN_UPGRADE_REQUIRED" | "REPORT_QUOTA_EXCEEDED" | "DEVICE_LIMIT_REACHED", role: string) {
  i18n.changeLanguage("en");
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <PaywallBanner code={code} role={role} />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("PaywallBanner", () => {
  test("mostra mensagem de upgrade e CTA de upgrade pro OWNER", () => {
    renderBanner("PLAN_UPGRADE_REQUIRED", "OWNER");
    expect(screen.getByText(/only available on paid plans/i)).toBeTruthy();
    expect(screen.getByText(/upgrade plan/i)).toBeTruthy();
  });

  test("mostra instrucao pro dono quando role nao e OWNER", () => {
    renderBanner("PLAN_UPGRADE_REQUIRED", "MANAGER");
    expect(screen.getByText(/ask the owner/i)).toBeTruthy();
  });

  test("mensagem certa pra REPORT_QUOTA_EXCEEDED", () => {
    renderBanner("REPORT_QUOTA_EXCEEDED", "OWNER");
    expect(screen.getByText(/monthly report limit/i)).toBeTruthy();
  });

  test("mensagem certa pra DEVICE_LIMIT_REACHED", () => {
    renderBanner("DEVICE_LIMIT_REACHED", "OWNER");
    expect(screen.getByText(/device limit reached/i)).toBeTruthy();
  });
});
