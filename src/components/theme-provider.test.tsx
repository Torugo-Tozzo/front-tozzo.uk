import { render, screen } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { ModeToggle } from "./mode-toggle"
import { ThemeProvider } from "./theme-provider"

function mockSystemTheme(dark: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList)
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ""
  })

  test("applies the stored theme from the React app's storage key", () => {
    localStorage.setItem("vite-ui-theme", "dark")
    render(() => <ThemeProvider><span /></ThemeProvider>)
    expect(document.documentElement).toHaveClass("dark")
  })

  test("follows the system preference when the theme is system", () => {
    mockSystemTheme(true)
    render(() => <ThemeProvider defaultTheme="system"><span /></ThemeProvider>)
    expect(document.documentElement).toHaveClass("dark")
    expect(document.documentElement).not.toHaveClass("light")
  })

  test("the toggle flips the effective theme and stores it", async () => {
    mockSystemTheme(false)
    const user = userEvent.setup()
    render(() => <ThemeProvider><ModeToggle /></ThemeProvider>)
    expect(document.documentElement).toHaveClass("light")

    await user.click(screen.getByRole("button"))

    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem("vite-ui-theme")).toBe("dark")
  })
})
