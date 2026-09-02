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

  it("opens, updates the suggested types, and saves the selected category", async () => {
    const user = userEvent.setup()
    const patchMock = vi.fn().mockResolvedValue({ data: {} })
    const restorePatch = replaceProperty(api, "patch", patchMock as typeof api.patch)

    try {
      const { onSaved } = renderModal()

      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument()

      await user.click(screen.getByRole("combobox", { name: "Categoria do estabelecimento" }))
      await user.click(await screen.findByRole("option", { name: "Hamburgueria" }))

      expect(screen.getByDisplayValue("Lanches")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Bebidas")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Salvar categoria" }))

      await waitFor(() => expect(patchMock).toHaveBeenCalledWith("/establishments/42", { category: "HAMBURGUERIA" }))
      expect(onSaved).toHaveBeenCalledTimes(1)
    } finally {
      restorePatch()
    }
  })
})
