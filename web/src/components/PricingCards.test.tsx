import { render, screen } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { I18nProvider } from "@/i18n/solid"
import { i18n } from "@/i18n/config"
import { PricingCards } from "./PricingCards"

function renderCards(props: Partial<import('solid-js').ComponentProps<typeof PricingCards>> = {}) {
  const onSelectPaid = vi.fn()
  const onSelectEnterprise = vi.fn()
  const onSelectFree = vi.fn()

  const cardProps = { onSelectFree, onSelectPaid, onSelectEnterprise, ...props }
  render(() => <I18nProvider><PricingCards {...cardProps} /></I18nProvider>)

  return { onSelectFree, onSelectPaid, onSelectEnterprise }
}

beforeEach(async () => { await i18n.changeLanguage('en') })
describe("PricingCards", () => {
  test("renders the three tiers and monthly prices", () => {
    renderCards()

    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Monthly" })).toBeInTheDocument()
    expect(screen.getByText("Enterprise")).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?0/)).toBeInTheDocument()
    expect(screen.getByText(/14[,.]90/)).toBeInTheDocument()
    expect(screen.getByText(/79[,.]90/)).toBeInTheDocument()
  })

  test("shows plan limits so Free's caps are visible against the unlimited paid tiers", () => {
    // Achado durante QA visual: o card Free dizia "Full access to the system",
    // igual aos pagos, sem diferenciar os limites reais (produtos/
    // dispositivos/impressões/relatórios). Regressão pra garantir que os
    // limites concretos aparecem, não só um texto genérico de "acesso completo".
    renderCards()

    expect(screen.getByText(/60 registered products/i)).toBeInTheDocument()
    expect(screen.getByText(/3 devices/i)).toBeInTheDocument()
    expect(screen.getByText(/30 prints per day/i)).toBeInTheDocument()
    expect(screen.getByText(/5 reports per month/i)).toBeInTheDocument()
    expect(screen.getAllByText(/unlimited products, prints, and reports/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/8 devices/i)).toBeInTheDocument()
    expect(screen.getByText(/15 devices included/i)).toBeInTheDocument()
  })

  test("changes the Pago price and callback interval with the shared toggle", async () => {
    const user = userEvent.setup()
    const callbacks = renderCards()

    await user.click(screen.getByRole("button", { name: /subscribe monthly/i }))
    expect(callbacks.onSelectPaid).toHaveBeenCalledWith("monthly")

    await user.click(screen.getByRole("button", { name: "Annual" }))
    expect(screen.getByText(/60[,.]91/)).toBeInTheDocument()
    expect(screen.getByText(/5[,.]07/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /subscribe annually/i }))
    await user.click(screen.getByRole("button", { name: /subscribe.*enterprise/i }))

    expect(callbacks.onSelectPaid).toHaveBeenLastCalledWith("annual")
    expect(callbacks.onSelectEnterprise).toHaveBeenCalledTimes(1)
  })

  test("marks only the corresponding tier as the current plan", () => {
    renderCards({ currentPlan: "ENTERPRISE" })

    expect(screen.getAllByText("Current plan")).toHaveLength(1)
    expect(screen.getByText("Enterprise").closest("div.relative")?.textContent).toContain("Current plan")
  })

  test("does not render a Free CTA when onSelectFree is omitted", () => {
    renderCards({ onSelectFree: undefined })

    expect(screen.queryByRole("button", { name: /free/i })).not.toBeInTheDocument()
  })
})
