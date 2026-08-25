import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { ConfirmProvider } from "@/contexts/ConfirmContext"

import api from "@/services/api"
import { i18n } from "@/i18n/config"
import { I18nProvider } from "@/i18n/provider"
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
    vi.restoreAllMocks()
  })

  test("renders the landing page chrome in the active locale", () => {
    renderRoute(<LandingPage />)

    expect(screen.getByText("Smart management for")).toBeInTheDocument()
    expect(screen.getByText("Restaurants and bars")).toBeInTheDocument()
    expect(screen.getByText("Kitchen management")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View plans" })).toBeInTheDocument()
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
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(api, "post").mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: "AUTH_INVALID_CREDENTIALS",
          message: "Invalid credentials.",
        },
      },
    })

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
  })
})
