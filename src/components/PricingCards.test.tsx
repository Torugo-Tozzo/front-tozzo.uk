import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "bun:test"

import { I18nProvider } from "@/i18n/provider"
import { PricingCards } from "./PricingCards"

function renderCards(props: Partial<React.ComponentProps<typeof PricingCards>> = {}) {
  const onSelectPago = vi.fn()
  const onSelectEnterprise = vi.fn()
  const onSelectFree = vi.fn()

  render(
    <I18nProvider>
      <PricingCards
        onSelectFree={onSelectFree}
        onSelectPago={onSelectPago}
        onSelectEnterprise={onSelectEnterprise}
        {...props}
      />
    </I18nProvider>,
  )

  return { onSelectFree, onSelectPago, onSelectEnterprise }
}

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

  test("changes the Pago price and callback interval with the shared toggle", async () => {
    const user = userEvent.setup()
    const callbacks = renderCards()

    await user.click(screen.getByRole("button", { name: /subscribe monthly/i }))
    expect(callbacks.onSelectPago).toHaveBeenCalledWith("monthly")

    await user.click(screen.getByRole("button", { name: "Annual" }))
    expect(screen.getByText(/60[,.]91/)).toBeInTheDocument()
    expect(screen.getByText(/5[,.]07/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /subscribe annually/i }))
    await user.click(screen.getByRole("button", { name: /subscribe.*enterprise/i }))

    expect(callbacks.onSelectPago).toHaveBeenLastCalledWith("annual")
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
