import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test"

import api from "@/services/api"
import { ConfirmProvider } from "@/contexts/ConfirmContext"
import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import { replaceProperty } from "@/test/replace-property"
import { PedidosTab } from "./PedidosTab"

vi.mock("@/hooks/useRealtimeEvents", () => ({
  useRealtimeEvents: () => undefined,
}))

const order = {
  id: "order-1",
  customerName: "Table 1",
  total: 30,
  isOpen: true,
  seller: { name: "Ana" },
  items: [
    {
      id: "item-1",
      productId: "product-1",
      quantity: 1,
      unitPriceAtOrder: 18,
      status: "REQUESTED",
      product: { id: "product-1", name: "Burger", price: 18 },
    },
    {
      id: "item-2",
      productId: "product-2",
      quantity: 1,
      unitPriceAtOrder: 12,
      status: "IN_PREPARATION",
      product: { id: "product-2", name: "Fries", price: 12 },
    },
  ],
}

function response(data: unknown) {
  return { data, headers: {} }
}

function renderOrders() {
  return render(
    <I18nProvider>
      <ConfirmProvider>
        <PedidosTab />
      </ConfirmProvider>
    </I18nProvider>,
  )
}

describe("PedidosTab item status workflow", () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  afterEach(() => {
    cleanup()
  })

  test("loads open orders without the removed order-status filter", async () => {
    const getMock = vi.fn(async (url: string) => {
      if (url === "/pedidos") return response({ orders: [order], total: 1 })
      if (url === "/tipos") return response({ types: [] })
      return response({ products: [], total: 0 })
    })
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)

    try {
      renderOrders()

      await waitFor(() => expect(screen.getByText("Table 1")).toBeInTheDocument())
      expect(getMock).toHaveBeenCalledWith("/pedidos", { params: { page: 1, limit: 10 } })
      expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument()
      expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })

  test("shows mixed item statuses and PATCHes only the selected item", async () => {
    const getMock = vi.fn(async (url: string, config?: { params?: { id?: number | string } }) => {
      if (url === "/pedidos") {
        if (config?.params?.id !== undefined) return response({ orders: [order], total: 1 })
        return response({ orders: [order], total: 1 })
      }
      if (url === "/tipos") return response({ types: [] })
      return response({ products: [], total: 0 })
    })
    const patchMock = vi.fn(async () => response({ ...order.items[0], status: "DELIVERED" }))
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
    const restorePatch = replaceProperty(api, "patch", patchMock as typeof api.patch)

    try {
      renderOrders()

      const editButton = await screen.findByRole("button", { name: "Edit order" })
      await userEvent.setup().click(editButton)

      expect(await screen.findByRole("combobox", { name: "Item status: Burger" })).toBeInTheDocument()
      expect(screen.getByText("Requested")).toBeInTheDocument()
      expect(screen.getByText("In preparation")).toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole("combobox", { name: "Item status: Burger" }))
      await user.click(await screen.findByRole("option", { name: "Delivered" }))

      await waitFor(() => {
        expect(patchMock).toHaveBeenCalledWith(
          "/pedidos/order-1/items/item-1",
          { status: "DELIVERED" },
        )
      })
      expect(patchMock).toHaveBeenCalledTimes(1)
    } finally {
      restorePatch()
      restoreGet()
    }
  })
})
