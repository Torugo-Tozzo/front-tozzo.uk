# Alert Component Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair um primitive `Alert` genérico baseado em CVA e usar sua variante `warning` no gate de tipo obrigatório de `ProductsPage`.

**Architecture:** O novo `Alert` será uma `div` semântica com `role="alert"`, `forwardRef`, `cn()` e variantes CVA `default`, `warning` e `destructive`. `AlertTitle` e `AlertDescription` serão subcomponentes simples e independentes; `ProductsPage` manterá exatamente a lógica e o conteúdo existentes, trocando somente a casca inline pelo primitive.

**Tech Stack:** React 18, TypeScript, class-variance-authority, Tailwind CSS, `@testing-library/react`, Bun test.

**Spec:** `docs/superpowers/sdd/2026-08-29-alert-component-extraction-brief.md`

## Global Constraints

- Não instalar dependência nova; usar CVA + `div` semântica.
- Preservar exatamente as classes da variante `warning`: `border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100`.
- Não alterar a lógica de `hasActiveProductType`, `canCreateProductType` ou `openTypeCreation`.
- Não mexer em API, mobile ou no conteúdo/assertions comportamentais existentes do gate.
- Validar suíte completa, `tsc --noEmit` e `bun run build`.
- Fazer um único commit na branch `feat/product-type-required-onboarding`, sobre `706aa09`, sem `--no-verify` e sem push.

### Task 1: Add the Alert primitive and contract tests

**Files:**
- Create: `src/components/ui/alert.tsx`
- Create: `src/components/ui/alert.test.tsx`

**Interfaces:**
- Produces `Alert`, `AlertTitle`, `AlertDescription` and `alertVariants` exports.
- `Alert` accepts `React.HTMLAttributes<HTMLDivElement>` plus `VariantProps<typeof alertVariants>` and forwards its ref to the container.
- `AlertTitle` and `AlertDescription` accept the matching HTML attributes and forward refs to `h5` and `p`.

- [x] **Step 1: Write failing tests for the primitive contract**

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import { Alert, AlertDescription, AlertTitle } from "./alert"

describe("Alert", () => {
  test.each(["default", "warning", "destructive"])(
    "renders the %s variant as an alert",
    (variant) => {
      render(<Alert variant={variant as "default" | "warning" | "destructive"}>Mensagem</Alert>)
      expect(screen.getByRole("alert")).toBeInTheDocument()
    },
  )

  test("merges a custom className with the selected variant", () => {
    render(<Alert variant="warning" className="custom-alert">Mensagem</Alert>)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveClass("custom-alert")
    expect(alert).toHaveClass("border-amber-500/50")
  })

  test("renders optional title and description subcomponents", () => {
    render(<Alert><AlertTitle>Título</AlertTitle><AlertDescription>Corpo</AlertDescription></Alert>)
    expect(screen.getByRole("heading", { name: "Título" })).toBeInTheDocument()
    expect(screen.getByText("Corpo")).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Run the focused test and verify the expected missing-module failure**

Run: `bun test src/components/ui/alert.test.tsx`

Expected: FAIL because `./alert` does not exist yet.

- [x] **Step 3: Implement the minimal CVA primitive**

Implement `alertVariants` with a base layout (`relative w-full rounded-md border p-4 text-sm`), the three required variants, and `defaultVariants.variant = "default"`. Implement `Alert` with `React.forwardRef`, `role="alert"`, spread HTML props, and `cn(alertVariants({ variant, className }))`. Implement `AlertTitle` as a forwarded `h5` with `font-medium` and `AlertDescription` as a forwarded `p` with `text-sm` and paragraph leading, each using `cn()`.

- [x] **Step 4: Run the focused tests and verify green**

Run: `bun test src/components/ui/alert.test.tsx`

Expected: PASS with all Alert contract tests green.

- [x] **Step 5: Refactor only after green**

Review the component for duplicated class merging, exact warning classes, ref typing, and exports. Keep the implementation limited to the specified primitive API.

### Task 2: Refactor the ProductsPage consumer

**Files:**
- Modify: `src/pages/dashboard/ProductsPage.tsx` (imports and the type-gate wrapper around the existing message/CTA)
- Test: `src/pages/dashboard/ProductsPage.test.tsx` (only if an implementation-specific assertion requires a behavioral selector update)

**Interfaces:**
- Consumes `Alert` from `@/components/ui/alert`.
- Preserves the existing `role="alert"`, translated message, owner CTA, manager instruction, and `openTypeCreation` behavior.

- [x] **Step 1: Add the Alert import and replace only the inline wrapper**

Change the UI block from `<div role="alert" className="...">...</div>` to `<Alert variant="warning">...</Alert>`, retaining the existing `mb-4` spacing via `className="mb-4"` and leaving all children and conditional logic unchanged.

- [x] **Step 2: Run the existing gate tests**

Run: `bun test src/pages/dashboard/ProductsPage.test.tsx`

Expected: PASS; role, text, disabled state, CTA behavior, and dialog behavior remain covered without assertion changes.

### Task 3: Full verification and delivery

**Files:**
- Modify: `src/components/ui/alert.tsx`
- Create: `src/components/ui/alert.test.tsx`
- Modify: `src/pages/dashboard/ProductsPage.tsx`
- Include: `docs/superpowers/plans/2026-08-29-alert-component-extraction.md`

- [x] **Step 1: Run the complete Bun test suite**

Run: `bun test`

Expected: PASS with no test failures.

- [x] **Step 2: Run TypeScript checking**

Run: `bunx tsc --noEmit`

Expected: exit code 0 with no diagnostics.

- [x] **Step 3: Run the production build**

Run: `bun run build`

Expected: exit code 0 after TypeScript and Vite build complete.

- [x] **Step 4: Inspect the final diff and status**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; unrelated pre-existing untracked briefs remain untouched; only the planned files are staged.

- [x] **Step 5: Create the single delivery commit**

```bash
git add src/components/ui/alert.tsx src/components/ui/alert.test.tsx src/pages/dashboard/ProductsPage.tsx docs/superpowers/plans/2026-08-29-alert-component-extraction.md
git commit -m "feat(ui): extract reusable alert component"
```

Expected: one new commit on `feat/product-type-required-onboarding` with parent `706aa09`, no push.
