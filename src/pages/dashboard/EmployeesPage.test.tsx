import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter } from "react-router-dom"

import { I18nProvider } from "@/i18n/provider"
import { ConfirmProvider } from "@/contexts/ConfirmContext"
import { i18n } from "@/i18n/config"
import api from "@/services/api"
import { replaceProperty } from "@/test/replace-property"
import EmployeesPage from "./EmployeesPage"

const mockUseAuth = vi.fn()

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

describe("EmployeesPage — paywall", () => {
  beforeEach(async () => {
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } })
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  test("shows PaywallBanner for a manager on the free plan", async () => {
    const restore = replaceProperty(
      api,
      "get",
      vi.fn().mockRejectedValue({ response: { status: 403, data: { code: "PLAN_UPGRADE_REQUIRED" } } }) as typeof api.get,
    )

    try {
      render(
        <MemoryRouter>
          <I18nProvider>
            <ConfirmProvider>
              <EmployeesPage />
            </ConfirmProvider>
          </I18nProvider>
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Ask the owner to upgrade the plan to unlock this.")
      })
      expect(screen.queryByText("Team")).toBeNull()
    } finally {
      restore()
    }
  })
})
