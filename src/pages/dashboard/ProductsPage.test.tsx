import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "bun:test"

import { ConfirmProvider } from "@/contexts/ConfirmContext"
import api from "@/services/api"
import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import { replaceProperty } from "@/test/replace-property"
import ProductsPage from "./ProductsPage"

const mockUseAuth = vi.fn()

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

function renderPage() {
  return render(
    <I18nProvider>
      <ConfirmProvider>
        <ProductsPage />
      </ConfirmProvider>
    </I18nProvider>,
  )
}

function mockProductRequests(types: unknown[]) {
  const getMock = vi.fn(async (url: string) => {
    if (url.startsWith("/tipos")) {
      return { data: url === "/tipos?all=true" ? types : { types, total: types.length }, headers: {} }
    }

    return { data: { products: [], total: 0 }, headers: {} }
  })
  const postMock = vi.fn(async () => ({ data: {}, headers: {} }))
  const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
  const restorePost = replaceProperty(api, "post", postMock as typeof api.post)

  return { getMock, postMock, restore: () => { restoreGet(); restorePost() } }
}

describe("ProductsPage product type gate", () => {
  beforeEach(async () => {
    mockUseAuth.mockReset()
    localStorage.clear()
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  test("blocks product creation for an owner without an active type and opens the type dialog", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const requests = mockProductRequests([{ id: 1, description: "Burger", isActive: false }])

    try {
      renderPage()

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent("Add at least one active product type before creating a product.")
      expect(screen.getByRole("button", { name: "New product" })).toBeDisabled()

      const user = userEvent.setup()
      await user.click(screen.getByRole("button", { name: "Add a product type" }))

      expect(screen.getByRole("tab", { name: "Types", hidden: true })).toHaveAttribute("aria-selected", "true")
      expect(screen.getByRole("heading", { name: "Add product type" })).toBeInTheDocument()
    } finally {
      requests.restore()
    }
  })

  test("blocks product creation for a manager without an active type and shows no creation CTA", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } })
    const requests = mockProductRequests([])

    try {
      renderPage()

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent("Ask the owner to add an active product type before creating a product.")
      expect(screen.getByRole("button", { name: "New product" })).toBeDisabled()
      expect(screen.queryByRole("button", { name: "Add a product type" })).not.toBeInTheDocument()
    } finally {
      requests.restore()
    }
  })

  test("keeps product creation available and submits the selected active type", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const requests = mockProductRequests([{ id: 1, description: "Burger", isActive: true }])

    try {
      renderPage()

      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
      const user = userEvent.setup()
      const newProductButton = screen.getByRole("button", { name: "New product" })
      expect(newProductButton).toBeEnabled()
      await user.click(newProductButton)

      const dialog = screen.getByRole("dialog")
      await user.type(screen.getByRole("textbox", { name: "Name" }), "Burger")
      await user.type(screen.getByRole("textbox", { name: "Price" }), "1250")
      const typeSelect = dialog.querySelector('select[name="productTypeId"]') as HTMLSelectElement
      expect(typeSelect?.hasAttribute("required")).toBe(true)

      await user.click(screen.getByRole("combobox", { name: "Type" }))
      await user.click(screen.getByRole("option", { name: "Burger" }))
      expect(typeSelect).toHaveValue("1")
      await user.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() => expect(requests.postMock).toHaveBeenCalledWith("/produtos", {
        name: "Burger",
        price: 12.5,
        ingredients: "",
        productTypeId: "1",
      }))
    } finally {
      requests.restore()
    }
  }, 15000)
})
