import { act, render, screen, waitFor, within } from "@testing-library/react"
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

function mockProductRequests(types: unknown[], products: unknown[] = []) {
  const getMock = vi.fn(async (url: string) => {
    if (url.startsWith("/tipos")) {
      return { data: url === "/tipos?all=true" ? types : { types, total: types.length }, headers: {} }
    }

    return { data: { products, total: products.length }, headers: {} }
  })
  const postMock = vi.fn(async () => ({ data: {}, headers: {} }))
  const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
  const restorePost = replaceProperty(api, "post", postMock as typeof api.post)

  return { getMock, postMock, restore: () => { restoreGet(); restorePost() } }
}

describe("ProductsPage optional product type", () => {
  beforeEach(async () => {
    mockUseAuth.mockReset()
    localStorage.clear()
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  for (const role of ["OWNER", "MANAGER"]) {
    test(`allows ${role} to create a product without types`, async () => {
      mockUseAuth.mockReturnValue({ user: { role } })
      const requests = mockProductRequests([])
      try {
        renderPage()
        const user = userEvent.setup()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "New product" }))
        await user.type(screen.getByRole("textbox", { name: "Name" }), "Coffee")
        await user.type(screen.getByRole("textbox", { name: "Price" }), "500")
        await user.click(screen.getByRole("button", { name: "Save" }))
        await waitFor(() => expect(requests.postMock).toHaveBeenCalledWith("/produtos", {
          name: "Coffee", price: 5, ingredients: "", productTypeId: null,
        }))
      } finally { requests.restore() }
    })
  }

  test("renders an untyped product without a type badge or color", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const requests = mockProductRequests([], [{ id: "p1", name: "Coffee", price: 5, productTypeId: null }])
    try {
      renderPage()
      const row = (await screen.findByText("Coffee")).closest("tr")!
      expect(within(row).getAllByRole("cell")[2]).toBeEmptyDOMElement()
    } finally { requests.restore() }
  })

  test("clears an existing type when editing a product", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const requests = mockProductRequests([{ id: "t1", description: "Drinks", isActive: true }], [
      { id: "p1", name: "Coffee", price: 5, productTypeId: "t1" },
    ])
    const put = vi.fn(async () => ({ data: {}, headers: {} }))
    const restorePut = replaceProperty(api, "put", put as typeof api.put)
    try {
      renderPage()
      const user = userEvent.setup()
      await user.click(await screen.findByRole("button", { name: "Edit" }))
      await user.click(screen.getByRole("combobox", { name: "Type" }))
      await user.click(screen.getByRole("option", { name: "No type" }))
      await user.click(screen.getByRole("button", { name: "Save changes" }))
      await waitFor(() => expect(put).toHaveBeenCalledWith("/produtos/p1", {
        name: "Coffee", price: 5, ingredients: "", productTypeId: null,
      }))
    } finally { requests.restore(); restorePut() }
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
      expect(typeSelect?.hasAttribute("required")).toBe(false)

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
