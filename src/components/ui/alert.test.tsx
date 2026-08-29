import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "bun:test"

import { Alert, AlertDescription, AlertTitle } from "./alert"

describe("Alert", () => {
  test.each([
    ["default", ["border", "bg-card"]],
    [
      "warning",
      [
        "border-amber-500/50",
        "bg-amber-50",
        "text-amber-950",
        "dark:bg-amber-950/30",
        "dark:text-amber-100",
      ],
    ],
    ["destructive", ["border-destructive/50", "bg-destructive/10", "text-destructive"]],
  ] as const)("renders the %s variant as an alert", (variant, classes) => {
    render(<Alert variant={variant}>Mensagem</Alert>)

    const alert = screen.getByRole("alert")
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveClass(...classes)
  })

  test("merges a custom className with the selected variant", () => {
    render(
      <Alert variant="warning" className="custom-alert">
        Mensagem
      </Alert>,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveClass("custom-alert")
    expect(alert).toHaveClass("border-amber-500/50")
  })

  test("renders optional title and description subcomponents", () => {
    render(
      <Alert>
        <AlertTitle>Título</AlertTitle>
        <AlertDescription>Corpo</AlertDescription>
      </Alert>,
    )

    expect(screen.getByRole("heading", { name: "Título" })).toBeInTheDocument()
    expect(screen.getByText("Corpo")).toBeInTheDocument()
  })
})
