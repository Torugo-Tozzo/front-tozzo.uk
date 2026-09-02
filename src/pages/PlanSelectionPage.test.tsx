import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter } from "react-router-dom"

import { I18nProvider } from "@/i18n/provider"
import { ConfirmProvider } from "@/contexts/ConfirmContext"
import api from "@/services/api"
import { replaceProperty } from "@/test/replace-property"
import PlanSelectionPage from "./PlanSelectionPage"

const mockUseAuth = vi.fn()
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }))

function renderPage() {
  return render(<MemoryRouter><I18nProvider><ConfirmProvider><PlanSelectionPage /></ConfirmProvider></I18nProvider></MemoryRouter>)
}

describe("PlanSelectionPage", () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ user: { establishment: { status: "PENDING_PAYMENT" } } }))

  test("shows the three tiers with the new prices", () => {
    renderPage()
    expect(screen.getByText(/R\$\s?0/)).toBeTruthy()
    expect(screen.getByText(/14[,.]90/)).toBeTruthy()
    expect(screen.getByText(/79[,.]90/)).toBeTruthy()
  })

  test("checks out Pago through the generic endpoint", async () => {
    const restore = replaceProperty(api, "post", vi.fn().mockResolvedValue({ data: { url: "https://checkout.stripe.com/x" } }) as typeof api.post)
    try {
      renderPage()
      await userEvent.click(screen.getByRole("button", { name: /subscribe monthly|assinar mensal/i }))
      expect(api.post).toHaveBeenCalledWith("/payments/stripe/checkout", { tier: "PAGO", interval: "monthly" })
    } finally { restore() }
  })

  test("checks out annual Pago through the generic endpoint", async () => {
    const restore = replaceProperty(api, "post", vi.fn().mockResolvedValue({ data: { url: "https://checkout.stripe.com/x" } }) as typeof api.post)
    try {
      renderPage()
      await userEvent.click(screen.getByRole("button", { name: "Annual" }))
      await userEvent.click(screen.getByRole("button", { name: /subscribe annually|assinar anualmente/i }))
      expect(api.post).toHaveBeenCalledWith("/payments/stripe/checkout", { tier: "PAGO", interval: "annual" })
    } finally { restore() }
  })

  test("checks out Enterprise through the generic endpoint", async () => {
    const restore = replaceProperty(api, "post", vi.fn().mockResolvedValue({ data: { url: "https://checkout.stripe.com/x" } }) as typeof api.post)
    try {
      renderPage()
      await userEvent.click(screen.getByRole("button", { name: /subscribe.*enterprise|assinar.*enterprise/i }))
      expect(api.post).toHaveBeenCalledWith("/payments/stripe/checkout", { tier: "ENTERPRISE", interval: "monthly" })
    } finally { restore() }
  })
})
