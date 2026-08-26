import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test"

import api from "@/services/api"
import { ConfirmProvider } from "@/contexts/ConfirmContext"
import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import { replaceProperty } from "@/test/replace-property"
import OrdersPage from "@/pages/dashboard/OrdersPage"
import SalesPage from "@/pages/dashboard/SalesPage"

const mockUseAuth = vi.fn()

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/hooks/useRealtimeEvents", () => ({
  useRealtimeEvents: () => undefined,
}))

function renderPage(ui: React.ReactElement) {
  return render(
    <I18nProvider>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </I18nProvider>,
  )
}

describe("orders and sales chrome", () => {
  beforeEach(async () => {
    mockUseAuth.mockReturnValue({
      user: { establishment: { tradeName: "Café da Nina" } },
    })
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  afterEach(() => {
    cleanup()
  })

  test("renders translated order chrome and preserves the establishment name", async () => {
    const getMock = vi.fn(async () => ({ data: { orders: [], total: 0 }, headers: {} }))
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)

    try {
      renderPage(<OrdersPage />)

      expect(screen.getByRole("heading", { name: "Orders — Café da Nina" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "New order" })).toBeInTheDocument()
      expect(screen.getByText("Recent orders")).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Customer / Table" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Created by" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Total" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText("No orders found.")).toBeInTheDocument())
      expect(screen.queryByText("Nenhum pedido encontrado.")).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })

  test("renders translated sales chrome and period summary", async () => {
    const getMock = vi.fn(async () => ({ data: { sales: [], total: 0, closing: 0 }, headers: {} }))
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)

    try {
      renderPage(<SalesPage />)

      expect(screen.getByRole("heading", { name: "Sales — Café da Nina" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "New sale" })).toBeInTheDocument()
      expect(screen.getByText("Sales for the period")).toBeInTheDocument()
      expect(screen.getByText("Total records: 0")).toBeInTheDocument()
      expect(screen.getByText("Period closing")).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Customer / Table" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Created by" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Total" })).toBeInTheDocument()
      expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText("No sales found for this period.")).toBeInTheDocument())
      expect(screen.queryByText("Nenhuma venda encontrada no período.")).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })
})
