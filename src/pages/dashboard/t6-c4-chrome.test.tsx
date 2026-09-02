import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter } from "react-router-dom"

import api from "@/services/api"
import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import { replaceProperty } from "@/test/replace-property"
import { Pagination } from "@/components/Pagination"
import { Navbar } from "@/components/Navbar"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { PedidosTab } from "@/components/dashboard/PedidosTab"
import ProductsPage from "./ProductsPage"
import EmployeesPage from "./EmployeesPage"
import ChartsPage from "./ChartsPage"

const mockUseAuth = vi.fn()
const uuidProductTypeId = "550e8400-e29b-41d4-a716-446655440000"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/contexts/ConfirmContext", () => ({
  useConfirm: () => vi.fn(async () => true),
}))

vi.mock("@/hooks/useRealtimeEvents", () => ({
  useRealtimeEvents: () => undefined,
}))

function renderWithProviders(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function renderChartsPage() {
  return renderWithProviders(
    <MemoryRouter>
      <ChartsPage />
    </MemoryRouter>,
  )
}

function response(data: unknown) {
  return { data, headers: {} }
}

function installApiGet(overrides: (url: string) => unknown | undefined) {
  const getMock = vi.fn(async (url: string) => {
    const overridden = overrides(url)
    if (overridden !== undefined) return overridden

    if (url.includes("/tipos")) return response({ types: [], total: 0 })
    if (url.includes("/produtos")) return response({ products: [], total: 0 })
    if (url.includes("/usuarios")) return response({ data: [], total: 0 })
    if (url.includes("/graficos/lista")) return response({ data: [], total: 0 })
    if (url === "/graficos") return response({ products: [], closing: null })
    if (url.includes("/graficos/vendas-por-horario")) return response([])
    if (url.includes("/pedidos")) return response({ orders: [], total: 0 })
    return response({})
  })

  return replaceProperty(api, "get", getMock as typeof api.get)
}

describe("T6-C4 dashboard chrome", () => {
  beforeEach(async () => {
    cleanup()
    localStorage.clear()
    mockUseAuth.mockReturnValue({
      user: { role: "OWNER", establishment: { tradeName: "Café da Nina" } },
    })
    await act(async () => {
      await i18n.changeLanguage("en")
    })
  })

  afterEach(() => {
    cleanup()
  })

  test("renders locale-aware pagination chrome and accessible navigation labels", () => {
    renderWithProviders(
      <Pagination
        currentPage={2}
        totalPages={4}
        hasMore
        onPageChange={() => undefined}
        pageSize={10}
        onPageSizeChange={() => undefined}
      />,
    )

    expect(screen.getByText("Rows per page")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toBeInTheDocument()
    expect(screen.getByText("Page 2 of 4")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument()
  })

  test("renders translated products chrome while preserving the establishment name", async () => {
    const restoreGet = installApiGet((url) => {
      if (url.includes("/tipos")) {
        return response({ types: [{ id: 1, description: "Burger", isActive: true }], total: 1 })
      }
      return undefined
    })

    try {
      renderWithProviders(<ProductsPage />)

      expect(screen.getByRole("heading", { name: "Management — Café da Nina" })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "Products" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "New product" })).toBeInTheDocument()
      const user = userEvent.setup()
      await user.click(screen.getByRole("button", { name: "New product" }))
      expect(screen.getByRole("combobox", { name: "Type" })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText("No products found.")).toBeInTheDocument())
    } finally {
      restoreGet()
    }
  })

  test("renders translated employee roles and page chrome", async () => {
    const restoreGet = installApiGet((url) => {
      if (url.includes("/usuarios")) {
        return response({ data: [{ id: 7, name: "Ana", email: "ana@example.com", role: "EMPLOYEE" }], total: 1 })
      }
      return undefined
    })

    try {
      renderWithProviders(<EmployeesPage />)

      expect(screen.getByRole("heading", { name: "Employees — Café da Nina" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "New employee" })).toBeInTheDocument()
      const user = userEvent.setup()
      await user.click(screen.getByRole("button", { name: "New employee" }))
      expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText("Employee", { selector: "td span" })).toBeInTheDocument())
      expect(screen.queryByText("Funcionário")).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })

  test("renders translated charts filters, empty states, and report actions", async () => {
    const restoreGet = installApiGet(() => undefined)

    try {
      renderChartsPage()

      expect(screen.getByRole("heading", { name: "Reports — Café da Nina" })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "Products sold" })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "Sales by hour" })).toBeInTheDocument()
      expect(screen.getByText("Start date")).toBeInTheDocument()
      expect(screen.getByRole("combobox", { name: "Food type" })).toBeInTheDocument()
      expect(screen.getByRole("combobox", { name: "Sales visualization" })).toBeInTheDocument()
      expect(screen.getByLabelText("Start date", { selector: "#charts-start-date" })).toBeInTheDocument()
      expect(screen.getByLabelText("Start time", { selector: "#charts-start-time" })).toBeInTheDocument()
      expect(screen.getByLabelText("End date", { selector: "#charts-end-date" })).toBeInTheDocument()
      expect(screen.getByLabelText("End time", { selector: "#charts-end-time" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Generate Excel" })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText("No data found for the selected filters.")).toBeInTheDocument())
    } finally {
      restoreGet()
    }
  })

  test("preserves UUID product type ids in chart filters", async () => {
    const productTypeId = uuidProductTypeId
    const getMock = vi.fn(async (url: string) => {
      if (url === "/tipos") {
        return response({ types: [{ id: productTypeId, description: "CUSTOM_UUID_TYPE" }] })
      }
      if (url === "/graficos") return response({ products: [], closing: null })
      if (url === "/graficos/lista") {
        return response({ data: [{ id: 1, name: "Burger", quantitySold: 1, totalRevenue: 12 }], total: 1 })
      }
      return response([])
    })
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
    const user = userEvent.setup()

    try {
      renderChartsPage()

      await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).not.toBeDisabled())
      await user.click(screen.getByRole("combobox", { name: "Food type" }))
      await user.click(await screen.findByRole("option", { name: "CUSTOM_UUID_TYPE" }))
      await user.click(screen.getByRole("button", { name: "Search" }))

      await waitFor(() => {
        expect(getMock).toHaveBeenCalledWith("/graficos", {
          params: expect.objectContaining({ productTypeId }),
        })
      })
      expect(getMock).toHaveBeenCalledWith("/graficos/lista", {
        params: expect.objectContaining({ productTypeId }),
      })
    } finally {
      restoreGet()
    }
  }, 15000)

  test("preserves UUID product type ids when creating a product", async () => {
    const getMock = vi.fn(async (url: string) => {
      if (url.includes("/tipos")) {
        return response({ types: [{ id: uuidProductTypeId, description: "CUSTOM_UUID_TYPE", isActive: true }] })
      }
      return response({ products: [], total: 0 })
    })
    const postMock = vi.fn(async () => response({}))
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
    const restorePost = replaceProperty(api, "post", postMock as typeof api.post)
    const user = userEvent.setup()

    try {
      renderWithProviders(<ProductsPage />)

      await user.click(screen.getByRole("button", { name: "New product" }))
      await user.type(screen.getByLabelText("Name"), "UUID Burger")
      await user.type(screen.getByLabelText("Price"), "12.50")
      await user.click(screen.getByRole("combobox", { name: "Type" }))
      await user.click(await screen.findByRole("option", { name: "CUSTOM_UUID_TYPE" }))
      await user.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() => {
        expect(postMock).toHaveBeenCalledWith(
          "/produtos",
          expect.objectContaining({ productTypeId: uuidProductTypeId }),
        )
      })
    } finally {
      restorePost()
      restoreGet()
    }
  })

  test("preserves UUID product type ids when updating a product", async () => {
    const getMock = vi.fn(async (url: string) => {
      if (url.includes("/tipos")) {
        return response({ types: [{ id: uuidProductTypeId, description: "CUSTOM_UUID_TYPE" }] })
      }
      return response({
        products: [{ id: 42, name: "Existing UUID Burger", price: 15, ingredients: "beef", productTypeId: uuidProductTypeId }],
        total: 1,
      })
    })
    const putMock = vi.fn(async () => response({}))
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
    const restorePut = replaceProperty(api, "put", putMock as typeof api.put)
    const user = userEvent.setup()

    try {
      renderWithProviders(<ProductsPage />)

      await user.click(await screen.findByRole("button", { name: "Edit" }))
      await user.click(screen.getByRole("button", { name: "Save changes" }))

      await waitFor(() => {
        expect(putMock).toHaveBeenCalledWith(
          "/produtos/42",
          expect.objectContaining({ productTypeId: uuidProductTypeId }),
        )
      })
    } finally {
      restorePut()
      restoreGet()
    }
  })

  test("renders a translated seller fallback without using presentation text as data", async () => {
    const restoreGet = installApiGet((url) => {
      if (url.includes("/pedidos")) {
        return response({
          orders: [{ id: 1, customerName: "Table 1", total: 12, isOpen: true, seller: { name: "" } }],
          total: 1,
        })
      }
      return undefined
    })

    try {
      renderWithProviders(<PedidosTab />)

      await waitFor(() => expect(screen.getByText("Not informed")).toBeInTheDocument())
      expect(screen.queryByText("-")).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })

  test("localizes a missing authenticated user name at the UI boundary", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { name: "", role: "OWNER", establishment: undefined },
      logout: vi.fn(),
    })

    renderWithProviders(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    )

    expect(screen.getByText("Not informed")).toBeInTheDocument()
  })

  test("uses a localized fallback for an unknown employee role", async () => {
    const restoreGet = installApiGet((url) => {
      if (url.includes("/usuarios")) {
        return response({ data: [{ id: 8, name: "Bia", email: "bia@example.com", role: "LEGACY_ROLE" }], total: 1 })
      }
      return undefined
    })

    try {
      renderWithProviders(<EmployeesPage />)

      await waitFor(() => expect(screen.getByText("Not informed")).toBeInTheDocument())
      expect(screen.queryByText("LEGACY_ROLE")).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })

  test("renders translated report format chrome with localized punctuation", async () => {
    const restoreGet = installApiGet((url) => {
      if (url.includes("/graficos/lista")) {
        return response({ data: [{ id: 1, name: "Burger", quantitySold: 1, totalRevenue: 12 }], total: 1 })
      }
      return undefined
    })
    const restorePost = replaceProperty(
      api,
      "post",
      vi.fn(() => new Promise(() => undefined)) as typeof api.post,
    )
    const user = userEvent.setup()

    try {
      renderChartsPage()

      const generateButton = await screen.findByRole("button", { name: "Generate Excel" })
      await waitFor(() => expect(screen.getByText("Total records: 1")).toBeInTheDocument())
      await waitFor(() => expect(generateButton).not.toBeDisabled())
      await user.click(generateButton)

      expect(await screen.findByText("Generating report (Excel)...")).toBeInTheDocument()
    } finally {
      restorePost()
      restoreGet()
    }
  })

  test("uses the translated report filename when the API omits one", async () => {
    const restoreGet = installApiGet((url) => {
      if (url.includes("/graficos/lista")) {
        return response({ data: [{ id: 1, name: "Burger", quantitySold: 1, totalRevenue: 12 }], total: 1 })
      }
      if (url === "/report") {
        return response(new Blob(["report"]))
      }
      return undefined
    })
    const restorePost = replaceProperty(
      api,
      "post",
      vi.fn(async () => ({ status: 201, data: { downloadUrl: "/report" } })) as typeof api.post,
    )
    const createElement = document.createElement.bind(document)
    const anchors: HTMLAnchorElement[] = []
    const restoreCreateElement = replaceProperty(
      document,
      "createElement",
      ((tagName: string) => {
        const element = createElement(tagName)
        if (tagName === "a") anchors.push(element as HTMLAnchorElement)
        return element
      }) as typeof document.createElement,
    )
    const user = userEvent.setup()

    try {
      renderChartsPage()

      const generateButton = await screen.findByRole("button", { name: "Generate Excel" })
      await waitFor(() => expect(screen.getByText("Total records: 1")).toBeInTheDocument())
      await waitFor(() => expect(generateButton).not.toBeDisabled())
      await user.click(generateButton)

      await waitFor(() => expect(anchors.some((anchor) => anchor.download === "report")).toBe(true))
    } finally {
      restoreCreateElement()
      restorePost()
      restoreGet()
    }
  })

  test("passes an empty customer value through the modal instead of persisting a translated fallback", async () => {
    const restoreGet = installApiGet(() => undefined)
    const onConfirm = vi.fn(async () => undefined)
    const user = userEvent.setup()

    try {
      renderWithProviders(
        <ProductSelectionModal
          isOpen
          onClose={() => undefined}
          onConfirm={onConfirm}
          title="New order"
          initialItems={[{ productId: 4, quantity: 1, name: "Burger", price: 12 }]}
        />,
      )

      const confirmButton = await screen.findByRole("button", { name: "Confirm" })
      await waitFor(() => expect(confirmButton).not.toBeDisabled())
      await user.click(confirmButton)

      await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("", [{ productId: 4, quantity: 1, unitPrice: 12 }]))
    } finally {
      restoreGet()
    }
  })
})
