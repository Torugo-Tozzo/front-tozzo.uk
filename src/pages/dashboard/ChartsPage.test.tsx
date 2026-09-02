import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter, Route, Routes, useNavigationType } from "react-router-dom"

import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import api from "@/services/api"
import { replaceProperty } from "@/test/replace-property"
import ChartsPage from "./ChartsPage"

const mockUseAuth = vi.fn()

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

function renderPage(initialEntry = "/dashboard/charts") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <I18nProvider>
        <Routes>
          <Route path="/dashboard/charts" element={<ChartsPage />} />
          <Route path="/dashboard" element={<DashboardHome />} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  )
}

function DashboardHome() {
  return <div>Dashboard home ({useNavigationType()})</div>
}

function mockChartRequestError(code: "PLAN_UPGRADE_REQUIRED" | "REPORT_QUOTA_EXCEEDED") {
  const getMock = vi.fn(async (url: string) => {
    if (url === "/graficos") {
      throw { response: { status: 403, data: { code } } }
    }

    if (url === "/tipos") return { data: { types: [] }, headers: {} }
    if (url === "/graficos/lista") return { data: { data: [], total: 0 }, headers: {} }
    if (url === "/graficos/vendas-por-horario") return { data: [], headers: {} }

    return { data: {}, headers: {} }
  })

  return replaceProperty(api, "get", getMock as typeof api.get)
}

describe("ChartsPage — paywall", () => {
  beforeEach(async () => {
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } })
    localStorage.clear()
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  test("shows the upgrade banner when the chart API returns PLAN_UPGRADE_REQUIRED", async () => {
    const restore = mockChartRequestError("PLAN_UPGRADE_REQUIRED")

    try {
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("This feature is only available on paid plans.")
      })
    } finally {
      restore()
    }
  })

  test("shows the quota banner when the chart API returns REPORT_QUOTA_EXCEEDED", async () => {
    const restore = mockChartRequestError("REPORT_QUOTA_EXCEEDED")

    try {
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("You have reached your monthly report limit.")
      })
    } finally {
      restore()
    }
  })

  test("redirects employees without loading or mounting report content", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "EMPLOYEE" } })
    const getMock = vi.fn(async () => ({ data: {}, headers: {} }))
    const restore = replaceProperty(api, "get", getMock as typeof api.get)

    try {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText("Dashboard home (REPLACE)")).toBeInTheDocument()
      })
      expect(getMock).not.toHaveBeenCalled()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: "Reports" })).not.toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
