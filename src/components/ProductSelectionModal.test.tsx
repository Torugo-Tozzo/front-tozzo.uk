import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test"
import { Toaster } from "sonner"

import { ConfirmProvider } from "@/contexts/ConfirmContext"
import api from "@/services/api"
import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import { replaceProperty } from "@/test/replace-property"
import { ProductSelectionModal } from "./ProductSelectionModal"

const product = {
  id: "product-1",
  name: "Hambúrguer Especial",
  price: 24.5,
  productTypeId: "550e8400-e29b-41d4-a716-446655440000",
}

function renderModal() {
  return render(
    <I18nProvider>
      <ConfirmProvider>
        <ProductSelectionModal
          isOpen
          onClose={vi.fn()}
          onConfirm={vi.fn(async () => undefined)}
          title="New order"
          initialClientName="Mesa 7"
          initialItems={[{ productId: product.id, quantity: 2, name: product.name, unitPrice: product.price }]}
        />
        <Toaster />
      </ConfirmProvider>
    </I18nProvider>,
  )
}

describe("ProductSelectionModal chrome", () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  afterEach(() => {
    cleanup()
  })

  test("translates modal chrome, accessible item controls, and preserves business names", async () => {
    const getMock = vi.fn(async (url: string) => {
      if (url === "/tipos") {
        return { data: { types: [{ id: product.productTypeId, description: "BURGER" }] }, headers: {} }
      }
      return { data: { products: [product], total: 1 }, headers: {} }
    })
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)

    try {
      renderModal()

      await waitFor(() => {
        expect(screen.getByText("Hambúrguer Especial")).toBeInTheDocument()
      })

      expect(screen.getByText("Select products and enter the customer.")).toBeInTheDocument()
      expect(screen.getByLabelText("Customer / Table")).toHaveValue("Mesa 7")
      expect(screen.getByPlaceholderText("E.g. Table 10 or customer name")).toBeInTheDocument()
      expect(screen.getByText("Selected items")).toBeInTheDocument()
      expect(screen.getByText("Hambúrguer Especial")).toBeInTheDocument()
      expect(screen.getByText("Total:")).toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0)
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("Available products")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Add product" })).toBeInTheDocument()
      })

      expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Increase quantity" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Remove item" })).toBeInTheDocument()
      expect(screen.queryByText("Selecione os produtos e informe o cliente.")).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })

  test("uses localized read-only sale actions", async () => {
    const getMock = vi.fn(async () => ({ data: { products: [], total: 0 }, headers: {} }))
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)

    try {
    render(
      <I18nProvider>
        <ConfirmProvider>
          <ProductSelectionModal
            isOpen
            onClose={vi.fn()}
            onConfirm={vi.fn(async () => undefined)}
            title="Sale details"
            readOnly
            onCancelSale={vi.fn(async () => undefined)}
          />
        </ConfirmProvider>
      </I18nProvider>,
    )

    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/tipos"))
    expect(screen.getByRole("button", { name: "Cancel sale" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Cancelar Venda" })).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })
})
