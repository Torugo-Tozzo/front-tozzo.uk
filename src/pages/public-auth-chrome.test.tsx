import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { Toaster } from "sonner"
import { ConfirmProvider } from "@/contexts/ConfirmContext"

import api from "@/services/api"
import { i18n } from "@/i18n/config"
import { I18nProvider } from "@/i18n/provider"
import { replaceProperty } from "@/test/replace-property"
import LandingPage from "./LandingPage"
import LoginPage from "./LoginPage"
import NotFoundPage from "./NotFoundPage"
import PaymentSuccessPage from "./PaymentSuccessPage"
import PlanSelectionPage from "./PlanSelectionPage"
import MainLayout from "@/layouts/MainLayout"

const mockUseAuth = vi.fn()

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

function renderRoute(element: React.ReactElement, path = "/") {
  return render(
    <I18nProvider>
      <ConfirmProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="*" element={element} />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    </I18nProvider>,
  )
}

function renderPlanRoute(user: { establishment: { status: string; plan: string | null } }) {
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    user,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    refreshUserProfile: vi.fn(),
  })

  return render(
    <I18nProvider>
      <ConfirmProvider>
        <MemoryRouter initialEntries={["/plan"]}>
          <Routes>
            <Route path="/plan" element={<PlanSelectionPage />} />
            <Route path="/dashboard" element={<p>Dashboard</p>} />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    </I18nProvider>,
  )
}

function RegistrationDestination() {
  const location = useLocation()
  return <p>{`Registration destination ${location.search}`}</p>
}

describe("public and auth chrome", () => {
  beforeEach(async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      refreshUserProfile: vi.fn(),
    })
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  afterEach(() => {
    cleanup()
  })

  test("renders the landing page chrome in the active locale", () => {
    renderRoute(<LandingPage />)

    expect(screen.getByText("Smart management for")).toBeInTheDocument()
    expect(screen.getByText("Restaurants and bars")).toBeInTheDocument()
    expect(screen.getByText("Kitchen management")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View plans" })).toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByText("Enterprise")).toBeInTheDocument()
  })

  test("sends unauthenticated paid-plan subscribers straight to registration", async () => {
    render(
      <I18nProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<RegistrationDestination />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Subscribe monthly" }))

    await waitFor(() => expect(screen.getByText("Registration destination ?tab=register")).toBeInTheDocument())
  })

  test("renders login labels, placeholders, and actions in the active locale", () => {
    renderRoute(<LoginPage />, "/login")

    expect(screen.getByText("Manage your establishment with ease")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Register" })).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@example.com")
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
  })

  test("renders the plan selection and payment success chrome in the active locale", () => {
    const { unmount } = renderRoute(<PlanSelectionPage />, "/plan")

    expect(screen.getByRole("heading", { name: /you do not have a plan yet/i })).toBeInTheDocument()
    expect(screen.getByText("Monthly")).toBeInTheDocument()
    expect(screen.getByText("Most popular")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Subscribe annually" })).toBeInTheDocument()

    unmount()
    renderRoute(<PaymentSuccessPage />, "/payment/success")

    expect(screen.getByRole("heading", { name: "Payment confirmed!" })).toBeInTheDocument()
    expect(screen.getByText("We are preparing your environment...")).toBeInTheDocument()
    expect(screen.getByText("You will be redirected in a moment.")).toBeInTheDocument()
  })

  test("keeps ACTIVE FREE establishments on the plan selection page", () => {
    renderPlanRoute({ establishment: { status: "ACTIVE", plan: "FREE" } })

    expect(screen.getByRole("heading", { name: /you do not have a plan yet/i })).toBeInTheDocument()
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })

  test("redirects ACTIVE paid establishments to the dashboard", async () => {
    renderPlanRoute({ establishment: { status: "ACTIVE", plan: "PAGO" } })

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument()
    })
  })

  test("keeps pending-payment establishments without a plan on plan selection", () => {
    renderPlanRoute({ establishment: { status: "PENDING_PAYMENT", plan: null } })

    expect(screen.getByRole("heading", { name: /you do not have a plan yet/i })).toBeInTheDocument()
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })

  test("renders not-found actions in the active locale", () => {
    renderRoute(<NotFoundPage />, "/missing")

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Go to home" })).toBeInTheDocument()
  })

  test("renders shared public layout and accessible chrome in the active locale", () => {
    renderRoute(<MainLayout />)

    expect(screen.getByText(/All rights reserved\./)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "LinkedIn" })).toBeInTheDocument()
  })

  test("shows a localized login error selected by API code", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const postMock = vi.fn().mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: "AUTH_INVALID_CREDENTIALS",
          message: "Invalid credentials.",
        },
      },
    })
    const restorePost = replaceProperty(api, "post", postMock as typeof api.post)

    try {
      renderRoute(
        <>
          <LoginPage />
          <Toaster />
        </>,
        "/login",
      )

      fireEvent.submit(document.querySelector("form")!)

      await waitFor(() => {
        expect(screen.getByText("Login failed. Check your credentials.")).toBeInTheDocument()
      })
      expect(screen.queryByText("Invalid credentials.")).not.toBeInTheDocument()
    } finally {
      consoleError.mockRestore()
      restorePost()
    }
  })
})
