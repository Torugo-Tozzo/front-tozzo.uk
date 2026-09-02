import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "bun:test"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { I18nProvider } from "@/i18n/provider"
import { ConfirmProvider } from "@/contexts/ConfirmContext"
import { i18n } from "@/i18n/config"
import api from "@/services/api"
import { replaceProperty } from "@/test/replace-property"
import DevicesPage from "./DevicesPage"

const mockUseAuth = vi.fn()
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }))

function DashboardHome() { return <div>Dashboard home</div> }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard/devices"]}>
      <I18nProvider>
        <ConfirmProvider>
          <Routes>
            <Route path="/dashboard/devices" element={<DevicesPage />} />
            <Route path="/dashboard" element={<DashboardHome />} />
          </Routes>
        </ConfirmProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe("DevicesPage", () => {
  beforeEach(async () => {
    mockUseAuth.mockReset()
    await act(async () => { await i18n.changeLanguage("en") })
  })

  test("lists devices returned by the API, without the raw id column", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const restore = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: { platform: "android" }, lastUserName: "Ana", lastSeen: null }] }) as typeof api.get)
    try {
      renderPage()
      await waitFor(() => expect(screen.getByText("Android")).toBeTruthy())
      expect(screen.getByText("Ana")).toBeTruthy()
      expect(screen.queryByText("dev-1")).toBeNull()
    } finally { restore() }
  })

  test("shows the fallback label when platform or user is unknown", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const restore = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: {}, lastUserName: null, lastSeen: null }] }) as typeof api.get)
    try {
      renderPage()
      await waitFor(() => expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0))
    } finally { restore() }
  })

  test("only owners see the remove button", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } })
    const restore = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: { platform: "android" }, lastUserName: "Ana", lastSeen: null }] }) as typeof api.get)
    try {
      renderPage()
      await waitFor(() => expect(screen.getByText("Android")).toBeTruthy())
      expect(screen.queryByRole("button", { name: /remove/i })).toBeNull()
    } finally { restore() }
  })

  test("owners can remove a device after confirming", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } })
    const restoreGet = replaceProperty(api, "get", vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: { platform: "android" }, lastUserName: "Ana", lastSeen: null }] }) as typeof api.get)
    const deleteMock = vi.fn().mockResolvedValue({ data: { message: "ok" } })
    const restoreDelete = replaceProperty(api, "delete", deleteMock as typeof api.delete)
    try {
      renderPage()
      await waitFor(() => expect(screen.getByText("Android")).toBeTruthy())
      await userEvent.click(screen.getByRole("button", { name: /remove/i }))
      await userEvent.click((await screen.findAllByRole("button", { name: /remove/i })).at(-1)!)
      await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("/dispositivos/dev-1"))
    } finally { restoreDelete(); restoreGet() }
  })

  test("redirects EMPLOYEE away and never fetches devices", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "EMPLOYEE" } })
    const getMock = vi.fn().mockResolvedValue({ data: [] })
    const restore = replaceProperty(api, "get", getMock as typeof api.get)
    try {
      renderPage()
      await waitFor(() => expect(screen.getByText("Dashboard home")).toBeTruthy())
      expect(getMock).not.toHaveBeenCalled()
    } finally { restore() }
  })

  test("redirects CUSTOMER away", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "CUSTOMER" } })
    renderPage()
    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeTruthy())
  })
})
