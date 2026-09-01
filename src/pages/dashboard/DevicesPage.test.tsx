import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "bun:test"
import { I18nProvider } from "@/i18n/provider"
import { ConfirmProvider } from "@/contexts/ConfirmContext"
import { i18n } from "@/i18n/config"
import api from "@/services/api"
import { replaceProperty } from "@/test/replace-property"
import DevicesPage from "./DevicesPage"

const mockUseAuth = vi.fn()
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }))

function renderPage() { return render(<I18nProvider><ConfirmProvider><DevicesPage /></ConfirmProvider></I18nProvider>) }

describe("DevicesPage", () => {
  beforeEach(async () => { mockUseAuth.mockReset(); await act(async () => { await i18n.changeLanguage("en") }) })
  test("lists devices returned by the API", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const restore = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: {}, lastSeen: null }] }) as typeof api.get)
    try { renderPage(); await waitFor(() => expect(screen.getByText("dev-1")).toBeTruthy()) } finally { restore() }
  })
  test("only owners see the remove button", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } })
    const restore = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: {}, lastSeen: null }] }) as typeof api.get)
    try { renderPage(); await waitFor(() => expect(screen.getByText("dev-1")).toBeTruthy()); expect(screen.queryByRole("button", { name: /remove/i })).toBeNull() } finally { restore() }
  })
  test("owners can remove a device after confirming", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: {}, lastSeen: null }] }) as typeof api.get)
    const deleteMock = vi.fn().mockResolvedValue({ data: { message: "ok" } })
    const restoreDelete = replaceProperty(api, "delete", deleteMock as typeof api.delete)
    try { renderPage(); await waitFor(() => expect(screen.getByText("dev-1")).toBeTruthy()); await userEvent.click(screen.getByRole("button", { name: /remove/i })); await userEvent.click((await screen.findAllByRole("button", { name: /remove/i })).at(-1)!); await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("/dispositivos/dev-1")) } finally { restoreDelete(); restoreGet() }
  })
})
