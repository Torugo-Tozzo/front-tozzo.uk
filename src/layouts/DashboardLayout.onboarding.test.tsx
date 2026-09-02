import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { I18nProvider } from "@/i18n/provider"
import { ThemeProvider } from "@/components/theme-provider"
import { ConfirmProvider } from "@/contexts/ConfirmContext"
import api from "@/services/api"
import { replaceProperty } from "@/test/replace-property"
import DashboardLayout from "./DashboardLayout"

let mockUser: any
const refreshUserProfile = vi.fn()

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, user: mockUser, logout: vi.fn(), refreshUserProfile }),
}))
vi.mock("@/hooks/useRealtimeEvents", () => ({ useRealtimeEvents: vi.fn() }))
vi.mock("@/components/dashboard/EstablishmentOnboardingModal", () => ({
  EstablishmentOnboardingModal: ({ open }: { open: boolean }) => open ? <div data-testid="establishment-onboarding" /> : null,
}))

function renderLayout() {
  return render(<I18nProvider><ThemeProvider><ConfirmProvider><MemoryRouter><DashboardLayout /></MemoryRouter></ConfirmProvider></ThemeProvider></I18nProvider>)
}

describe("DashboardLayout establishment onboarding", () => {
  let restoreGet: () => void

  beforeEach(() => {
    restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ headers: {}, data: [] }) as typeof api.get)
    mockUser = { role: "OWNER", establishmentId: 42, establishment: { id: 42, tradeName: "Burger", category: null } }
  })
  afterEach(() => restoreGet())

  it("opens only for an owner whose establishment has no category", () => {
    renderLayout()
    expect(screen.getByTestId("establishment-onboarding")).toBeInTheDocument()
  })

  it("does not open after category completion or for a non-owner", () => {
    mockUser.establishment.category = "HAMBURGUERIA"
    const { unmount } = renderLayout()
    expect(screen.queryByTestId("establishment-onboarding")).not.toBeInTheDocument()

    unmount()
    mockUser = { role: "MANAGER", establishment: { id: 42, tradeName: "Burger", category: null } }
    renderLayout()
    expect(screen.queryByTestId("establishment-onboarding")).not.toBeInTheDocument()
  })
})
