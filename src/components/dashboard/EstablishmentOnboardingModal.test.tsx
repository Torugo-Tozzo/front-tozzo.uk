import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { I18nProvider } from "@/i18n/provider"
import { i18n } from "@/i18n/config"
import api from "@/services/api"
import { replaceProperty } from "@/test/replace-property"
import { EstablishmentOnboardingModal } from "./EstablishmentOnboardingModal"

function renderModal(onSaved = vi.fn()) {
  return {
    onSaved,
    ...render(
      <I18nProvider>
        <EstablishmentOnboardingModal open establishmentId={42} onSaved={onSaved} />
      </I18nProvider>,
    ),
  }
}

describe("EstablishmentOnboardingModal", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("saves food as a business profile while preserving the optional food category", async () => {
    const user = userEvent.setup()
    const patchMock = vi.fn().mockResolvedValue({ data: {} })
    const restorePatch = replaceProperty(api, "patch", patchMock as typeof api.patch)

    try {
      const { onSaved } = renderModal()

      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument()

      await user.click(screen.getByRole("checkbox", { name: "Alimentação" }))
      await user.click(screen.getByRole("combobox", { name: "Categoria do estabelecimento" }))
      await user.click(await screen.findByRole("option", { name: "Hamburgueria" }))

      expect(screen.getByDisplayValue("Lanches")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Bebidas")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Salvar perfis" }))

      await waitFor(() => expect(patchMock).toHaveBeenCalledWith("/establishments/preferences", {
        profiles: ["FOOD"],
        visibleModules: ["ORDERS", "KITCHEN", "DELIVERIES", "SALES", "PRODUCTS", "EMPLOYEES", "SCHEDULE", "DEVICES", "REPORTS", "SETTINGS"],
        expectedRevision: 0,
      }))
      expect(patchMock).toHaveBeenCalledWith("/establishments/42", { category: "HAMBURGUERIA" })
      expect(onSaved).toHaveBeenCalledTimes(1)
    } finally {
      restorePatch()
    }
  })
  it("combines store and services without asking for a food category", async () => {
    const user = userEvent.setup()
    const patchMock = vi.fn().mockResolvedValue({ data: {} })
    const restorePatch = replaceProperty(api, "patch", patchMock as typeof api.patch)
    try {
      renderModal()
      await user.click(screen.getByRole("checkbox", { name: "Loja" }))
      await user.click(screen.getByRole("checkbox", { name: "Prestador de serviços" }))
      expect(screen.queryByRole("combobox", { name: "Categoria do estabelecimento" })).not.toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Salvar perfis" }))
      await waitFor(() => expect(patchMock).toHaveBeenCalledWith("/establishments/preferences", {
        profiles: ["STORE", "SERVICES"],
        visibleModules: ["SALES", "PRODUCTS", "SERVICES", "ESTIMATES", "EMPLOYEES", "DEVICES", "REPORTS", "SETTINGS"],
        expectedRevision: 0,
      }))
      expect(patchMock).toHaveBeenCalledTimes(1)
    } finally { restorePatch() }
  })
  it("does not add suggestions again after success", async () => {
    const post = vi.fn().mockResolvedValue({ data: {} })
    const restore = replaceProperty(api, "post", post as typeof api.post)
    try {
      renderModal()
      const user = userEvent.setup()
      await user.click(screen.getByRole("checkbox", { name: "Alimentação" }))
      await user.click(screen.getByRole("combobox", { name: "Categoria do estabelecimento" }))
      await user.click(await screen.findByRole("option", { name: "Hamburgueria" }))
      const button = screen.getByRole("button", { name: "Adicionar tipos sugeridos" })
      await user.dblClick(button)
      await waitFor(() => expect(post).toHaveBeenCalledTimes(4))
      expect(button).toBeDisabled()
      await user.click(button)
      expect(post).toHaveBeenCalledTimes(4)
    } finally { restore() }
  })

  it("retries only unfinished suggestions after a partial failure", async () => {
    const post = vi.fn().mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: {} })
    const restore = replaceProperty(api, "post", post as typeof api.post)
    try {
      renderModal()
      const user = userEvent.setup()
      await user.click(screen.getByRole("checkbox", { name: "Alimentação" }))
      await user.click(screen.getByRole("combobox", { name: "Categoria do estabelecimento" }))
      await user.click(await screen.findByRole("option", { name: "Hamburgueria" }))
      const button = screen.getByRole("button", { name: "Adicionar tipos sugeridos" })
      await user.click(button)
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)
      await waitFor(() => expect(button).toBeDisabled())
      expect(post.mock.calls.filter(([, body]) => body.description === "Lanches")).toHaveLength(1)
      expect(post).toHaveBeenCalledTimes(5)
    } finally { restore() }
  })

})
