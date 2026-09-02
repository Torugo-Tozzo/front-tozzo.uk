import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import { replaceProperty } from "@/test/replace-property"
import api from "@/services/api"
import type { UserRole } from "@/domain/models"
import SettingsPage from "./SettingsPage"

const mockUseAuth = vi.fn()
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }))

function authValue(role: UserRole) {
  return { user: { id: 7, name: "Ana", email: "ana@example.com", role, establishmentId: 42, establishment: { id: 42, tradeName: "Hamburgueria da Ana", status: "ACTIVE" } }, logout: vi.fn(), refreshUserProfile: vi.fn().mockResolvedValue(undefined) }
}

function renderPage() {
  return render(<MemoryRouter><I18nProvider><ThemeProvider><SettingsPage /></ThemeProvider></I18nProvider></MemoryRouter>)
}

describe("SettingsPage", () => {
  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.classList.remove("light", "dark")
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() })
    vi.spyOn(api, "get").mockResolvedValue({ data: { id: 42 } })
    await act(async () => { await i18n.changeLanguage("pt-BR") })
  })

  afterEach(() => vi.restoreAllMocks())

  it("renders the page heading, locale picker, and printing section", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Idioma atual" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Largura do papel" })).toBeInTheDocument()
  })

  it("toggles the theme when the mode button is clicked", async () => {
    const user = userEvent.setup()
    renderPage()

    expect(document.documentElement.classList.contains("light")).toBe(true)
    await user.click(screen.getByRole("button", { name: i18n.t("accessibility.toggleTheme", { ns: "common" }) }))

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark")
  })

  it("changes the active locale immediately and persists the selected value", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("combobox", { name: "Idioma atual" }))
    await user.click(await screen.findByRole("option", { name: "Español" }))

    expect(screen.getByRole("heading", { name: "Configuración" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Idioma: Español")
    expect(localStorage.getItem("tozzo.locale")).toBe("es")
  })

  it("shows and persists the selected paper width", async () => {
    localStorage.setItem("tozzo.printerWidth", "58mm")
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByRole("combobox", { name: "Largura do papel" })).toHaveTextContent("58mm")

    await user.click(screen.getByRole("combobox", { name: "Largura do papel" }))
    await user.click(await screen.findByRole("option", { name: "110mm" }))
    expect(localStorage.getItem("tozzo.printerWidth")).toBe("110mm")
  })

  it("shows free plan usage counters", async () => {
    mockUseAuth.mockReturnValue(authValue("OWNER"))
    const restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: { id: 42, plan: "FREE", printCountToday: 12, reportCount: 2, deviceCount: 2 } }) as typeof api.get)
    try {
      renderPage()
      await waitFor(() => expect(screen.getByText("Plano e uso")).toBeInTheDocument())
      expect(screen.getByText("12/30")).toBeInTheDocument()
      expect(screen.getByText("2/5")).toBeInTheDocument()
      // Regressão: deviceCount vinha aninhado em _count.devices, que o
      // toLegacyWire do backend renomeia recursivamente (devices -> dispositivos)
      // — o front nunca achava o campo e sempre mostrava 0. Ver
      // establishments.controller.ts (deviceCount achatado).
      expect(screen.getByText("2")).toBeInTheDocument()
    } finally { restoreGet() }
  })

  it("shows unlimited usage for paid plans", async () => {
    mockUseAuth.mockReturnValue(authValue("OWNER"))
    const restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: { id: 42, plan: "PAGO", printCountToday: 5, reportCount: 0, deviceCount: 3 } }) as typeof api.get)
    try {
      renderPage()
      await waitFor(() => expect(screen.getAllByText("Ilimitado").length).toBeGreaterThan(0))
      expect(screen.getByText("3")).toBeInTheDocument()
    } finally { restoreGet() }
  })

  it("shows data/privacy only for owners", async () => {
    const restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: { id: 42 } }) as typeof api.get)
    try {
      mockUseAuth.mockReturnValue(authValue("MANAGER"))
      const { unmount } = renderPage()
      expect(screen.queryByRole("heading", { name: "Dados e privacidade" })).not.toBeInTheDocument()

      unmount()
      mockUseAuth.mockReturnValue(authValue("OWNER"))
      renderPage()
      expect(screen.getByRole("heading", { name: "Dados e privacidade" })).toBeInTheDocument()
    } finally { restoreGet() }
  })

  it("exports data by downloading a JSON blob", async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue(authValue("OWNER"))
    const getMock = vi.fn().mockResolvedValue({ data: { establishment: { id: 42 }, users: [], products: [], orders: [], sales: [] } })
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
    try {
      renderPage()
      await user.click(screen.getByRole("button", { name: "Exportar meus dados" }))
      await waitFor(() => expect(getMock).toHaveBeenCalledWith("/auth/export-data"))
    } finally { restoreGet() }
  })

  it("requires a password and calls delete-account on confirm", async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue(authValue("OWNER"))
    const postMock = vi.fn().mockResolvedValue({ data: { message: "ok" } })
    const restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: { id: 42 } }) as typeof api.get)
    const restorePost = replaceProperty(api, "post", postMock as typeof api.post)
    try {
      renderPage()
      await user.click(screen.getByRole("button", { name: "Excluir minha conta" }))
      const confirmButton = screen.getByRole("button", { name: "Excluir permanentemente" })
      expect(confirmButton).toBeDisabled()
      await user.type(screen.getByLabelText("Senha atual"), "senha123")
      await user.click(confirmButton)
      await waitFor(() => expect(postMock).toHaveBeenCalledWith("/auth/delete-account", { password: "senha123" }))
    } finally {
      restoreGet()
      restorePost()
    }
  })

  it("shows establishment information only to owners and removes the fixed category card", async () => {
    const restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: { id: 42 } }) as typeof api.get)
    try {
      mockUseAuth.mockReturnValue(authValue("MANAGER"))
      const { unmount } = renderPage()
      expect(screen.queryByRole("heading", { name: "Editar Informações do Estabelecimento" })).not.toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: "Categoria do estabelecimento" })).not.toBeInTheDocument()

      unmount()
      mockUseAuth.mockReturnValue(authValue("OWNER"))
      renderPage()
      await waitFor(() => expect(screen.getByRole("heading", { name: "Editar Informações do Estabelecimento" })).toBeInTheDocument())
    } finally {
      restoreGet()
    }
  })

  it("saves establishment information through PUT and refreshes the navbar name", async () => {
    const user = userEvent.setup()
    const auth = authValue("OWNER")
    mockUseAuth.mockReturnValue(auth)
    const getMock = vi.fn().mockResolvedValue({ data: { id: 42, tradeName: "Burger", phone: "11999999999", zipCode: "01001000", addressStreet: "Rua A", addressNumber: "10", addressComplement: "Sala 1", addressNeighborhood: "Centro", addressCity: "São Paulo", addressState: "SP", cnpj: "123" } })
    const putMock = vi.fn().mockResolvedValue({ data: { id: 42 } })
    const restoreGet = replaceProperty(api, "get", getMock as typeof api.get)
    const restorePut = replaceProperty(api, "put", putMock as typeof api.put)
    try {
      renderPage()
      const tradeName = await screen.findByRole("textbox", { name: "Nome do estabelecimento" })
      await user.clear(tradeName)
      await user.type(tradeName, "Novo Burger")
      await user.click(screen.getByRole("button", { name: "Salvar informações" }))
      await waitFor(() => expect(putMock).toHaveBeenCalledWith("/estabelecimentos", {
        tradeName: "Novo Burger", phone: "11999999999", zipCode: "01001000", addressStreet: "Rua A", addressNumber: "10", addressComplement: "Sala 1", addressNeighborhood: "Centro", addressCity: "São Paulo", addressState: "SP", cnpj: "123",
      }))
      // Regressão: nome editado aqui também aparece na navbar (fora desta
      // página), que lê user.establishment.tradeName do AuthContext — sem
      // refreshUserProfile() a navbar só atualizava depois de um F5.
      await waitFor(() => expect(auth.refreshUserProfile).toHaveBeenCalled())
    } finally {
      restoreGet()
      restorePut()
    }
  })
})
