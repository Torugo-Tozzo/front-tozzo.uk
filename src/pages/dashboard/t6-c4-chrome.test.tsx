import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test"

import api from "@/services/api"
import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import { replaceProperty } from "@/test/replace-property"
import { Pagination } from "@/components/Pagination"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { PedidosTab } from "@/components/dashboard/PedidosTab"
import ProductsPage from "./ProductsPage"
import EmployeesPage from "./EmployeesPage"
import ChartsPage from "./ChartsPage"

const mockUseAuth = vi.fn()

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
    expect(screen.getByText("Page 2 of 4")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument()
  })

  test("renders translated products chrome while preserving the establishment name", async () => {
    const restoreGet = installApiGet(() => undefined)

    try {
      renderWithProviders(<ProductsPage />)

      expect(screen.getByRole("heading", { name: "Management — Café da Nina" })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "Products" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "New product" })).toBeInTheDocument()
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
      await waitFor(() => expect(screen.getByText("Employee")).toBeInTheDocument())
      expect(screen.queryByText("Funcionário")).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })

  test("renders translated charts filters, empty states, and report actions", async () => {
    const restoreGet = installApiGet(() => undefined)

    try {
      renderWithProviders(<ChartsPage />)

      expect(screen.getByRole("heading", { name: "Reports — Café da Nina" })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "Products sold" })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "Sales by hour" })).toBeInTheDocument()
      expect(screen.getByText("Start date")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Generate Excel" })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText("No data found for the selected filters.")).toBeInTheDocument())
    } finally {
      restoreGet()
    }
  })

  test("renders a translated seller fallback without using presentation text as data", async () => {
    const restoreGet = installApiGet((url) => {
      if (url.includes("/pedidos")) {
        return response({
          orders: [{ id: 1, customerName: "Table 1", total: 12, status: "OPEN", seller: { name: "" } }],
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
