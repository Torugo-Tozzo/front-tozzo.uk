import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

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

  test("opens the selected employee's schedule from the edit dialog", async () => {
    const restore = replaceProperty(api, 'get', vi.fn().mockResolvedValue({ data: [{ id: 'employee-1', name: 'Ana', email: 'ana@example.test', role: 'EMPLOYEE' }], headers: {} }) as typeof api.get)
    function Destination() { const location = useLocation(); return <p>{location.search}</p> }
    try {
      render(<MemoryRouter initialEntries={['/dashboard/employees']}><I18nProvider><ConfirmProvider><Routes><Route path="/dashboard/employees" element={<EmployeesPage />} /><Route path="/dashboard/schedule" element={<Destination />} /></Routes></ConfirmProvider></I18nProvider></MemoryRouter>)
      await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('button', { name: 'View schedule' }))
      expect(screen.getByText('?employeeId=employee-1')).toBeInTheDocument()
    } finally { restore() }
  })
})
