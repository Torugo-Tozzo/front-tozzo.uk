# Design System Front — Fase 4: Paleta + Tabela + Tela "Atendimento" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Fase 4 palette (marca preto/branco/cinza + cores de status por urgência) and redesigned pedidos table to the front dashboard, and ship a new "Atendimento" landing page that unifies Pedidos/Vendas/Produtos into tabs, replacing `OrdersPage` as the dashboard index.

**Architecture:** Design tokens move into CSS variables (`src/index.css`) consumed via existing Tailwind `hsl(var(--x))` convention, plus one raw-hex token (`--row-bg`) for the two-tone row background. Status color/label mapping lives in one module (`src/lib/status.ts`) consumed by two new primitives (`StatusSelect`, `IconButton`) and by a new `accentColor` prop on `TableRow`. The existing `OrdersPage`/`SalesPage` CRUD logic (fetch/poll/SSE/pagination/modal wiring) is extracted into two tab components (`PedidosTab`, `VendasTab`) under `src/components/atendimento/`, reused by the new `AtendimentoPage`. A third, genuinely new tab (`ProdutosQuickTab`) gives quick product search + fast-create. `AtendimentoPage` becomes the `/dashboard` index route; the old `/dashboard/orders` and `/dashboard/sales` routes become redirects so no existing links break.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind (shadcn-style tokens in `src/index.css` + `tailwind.config.js`), Radix UI primitives already wrapped in `src/components/ui/`, `react-router-dom` v7 (`useSearchParams` for tab state), Vitest + React Testing Library (already configured, see `vitest.config.ts`), `lucide-react` icons, `class-variance-authority` for variants.

## Global Constraints

- No hardcoded status/brand hex inside page components — everything routes through `src/lib/status.ts` or the CSS tokens in `src/index.css`. (Spec: "Implementação — restrição importante".)
- Status colors (exact hex, do not change): `ABERTO` `#dc2626`, `EM_PREPARO` `#d97706`, `ENTREGANDO` `#2563eb`, `FECHADO` `#6b7280`.
- Brand palette (exact hex): black `#000000`, white `#FFFFFF`, brand gray `#454545`. Light background `#FFFFFF`, light row bg `#FAF6F0`. Dark background `#161616` (not pure black), dark row bg `#454545`.
- Status selector / icon-button "chips" always render `bg-white text-black` in both themes (fixed, not theme-variable driven) — confirmed bug from brainstorm: using the theme text variable made the text disappear in dark mode.
- **Confirmed with user (2026-08-06):** the status selector stays hidden/disabled for `FECHADO` orders — backend (`pedidos.controller.ts:206`) still rejects any status change away from `FECHADO`. Do not add backend logic to reopen closed orders in this plan; that is explicitly deferred.
- `Badge` and `EmptyState` primitives are **not** part of this plan (spec lists them under "Em aberto — não brainstormado", no approved visual design yet). Do not add them.
- `ProductsPage`, `EmployeesPage` full-page palette application is out of scope (same "Em aberto" list) — only the new `ProdutosQuickTab` (lightweight, separate component) is in scope.
- The "adicionar rápido à venda/pedido em andamento" cross-tab cart wiring mentioned in the spec is deferred — out of scope for this plan (see Task 8 note). The core motivating use case (creating a product mid-flow) is still solved: `ProductSelectionModal` re-fetches `/produtos` every time it opens, so a product created via the Produtos tab is immediately available next time "+ Novo Pedido"/"+ Nova Venda" is opened.
- Follow existing repo conventions: `bun` is the package manager for this repo (`bun.lock` canonical) — use `bun run test` / `bun run build`, not `npm`/`yarn`.
- Branch: `feat/design-system-front` (already exists, created from `dev`, currently checked out). Target `dev` when opening the PR — do not merge to `main`.

---

## File Structure

**New files:**
- `src/lib/status.ts` — status color/label map, single source of truth.
- `src/lib/status.test.ts` — unit tests for the map.
- `src/components/ui/icon-button.tsx` — reusable icon action button (Printer/Pencil/Trash2/Eye).
- `src/components/ui/icon-button.test.tsx`
- `src/components/ui/status-select.tsx` — `Select` wrapper with colored border + fixed white chip styling.
- `src/components/ui/status-select.test.tsx`
- `src/components/atendimento/PedidosTab.tsx` — extracted + redesigned `OrdersPage` table logic.
- `src/components/atendimento/VendasTab.tsx` — extracted + redesigned `SalesPage` table logic.
- `src/components/atendimento/ProdutosQuickTab.tsx` — new lightweight product search + quick-create.
- `src/components/atendimento/ProdutosQuickTab.test.tsx`
- `src/pages/dashboard/AtendimentoPage.tsx` — new landing page, 3 tabs, shared "+ Novo X" header button.
- `src/pages/dashboard/AtendimentoPage.test.tsx`

**Modified files:**
- `src/index.css` — palette tokens (light/dark).
- `tailwind.config.js` — register `row` color token.
- `src/components/ui/table.tsx` — `TableRow` gains optional `accentColor` prop.
- `src/components/ui/table.test.tsx` (new test file for the modified component).
- `src/App.tsx` — routing: `AtendimentoPage` as index + `/atendimento`, `/orders` and `/sales` become redirects.
- `src/layouts/DashboardLayout.tsx` — nav items collapse Pedidos+Vendas into one "Atendimento" entry.

**Deleted files:**
- `src/pages/dashboard/OrdersPage.tsx` (logic moved to `PedidosTab`).
- `src/pages/dashboard/SalesPage.tsx` (logic moved to `VendasTab`).

**Already modified, uncommitted (from the 2026-08-06 brainstorm session, committed in Task 0):**
`index.html`, `public/logo.png` → `public/logo.svg`, `src/assets/images/logo.png` → `src/assets/images/logo.svg`, `src/components/Navbar.tsx`, `src/layouts/DashboardLayout.tsx`, `src/pages/LoginPage.tsx`.

---

### Task 0: Commit the pending logo swap

The branch already has an uncommitted logo swap (PNG→SVG) from the brainstorm session sitting in the working tree. Commit it first so the design-system work starts from a clean baseline.

**Files:** `index.html`, `public/logo.png` (deleted), `public/logo.svg` (new), `src/assets/images/logo.png` (deleted), `src/assets/images/logo.svg` (new), `src/components/Navbar.tsx`, `src/layouts/DashboardLayout.tsx`, `src/pages/LoginPage.tsx`.

- [ ] **Step 1: Verify the diff is only the logo swap**

Run: `git -C C:/RN/front/front-tozzo.uk status` and `git -C C:/RN/front/front-tozzo.uk diff -- src/components/Navbar.tsx src/layouts/DashboardLayout.tsx src/pages/LoginPage.tsx index.html`

Expected: only `.png`→`.svg` import/href changes, no other edits.

- [ ] **Step 2: Commit**

```bash
cd C:/RN/front/front-tozzo.uk
git add index.html public/logo.svg public/logo.png src/assets/images/logo.svg src/assets/images/logo.png src/components/Navbar.tsx src/layouts/DashboardLayout.tsx src/pages/LoginPage.tsx
git commit -m "feat(design-system): trocar logo PNG por SVG limpo"
```

---

### Task 1: Design tokens — palette in `src/index.css` + `tailwind.config.js`

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

**Interfaces:**
- Produces: CSS variables `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--muted-foreground`, `--border`, `--input`, `--row-bg` (all consumed by existing Tailwind classes like `bg-background`, `text-muted-foreground`, plus the new `bg-row` utility used by Task 5).

- [ ] **Step 1: Update `:root` (light) tokens in `src/index.css`**

Replace the `:root` block (lines 6–36) with:

```css
  :root {
    /* Paleta de marca (Fase 4, spec 2026-08-06): preto/branco puros, sem
       os tons "slate" default do shadcn. --border e --muted-foreground
       aqui sao a versao solida das rgba(...) do spec, ja pre-misturadas
       com o fundo branco (nao dava pra usar hsl(var(--x) / <alpha>) sem
       reestruturar a convencao de cor do tailwind.config.js inteira). */
    --background: 0 0% 100%;
    --foreground: 0 0% 0%;

    --card: 0 0% 100%;
    --card-foreground: 0 0% 0%;

    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 0%;

    --primary: 0 0% 0%;
    --primary-foreground: 0 0% 100%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 0 0% 27%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 0 0% 87%;
    --input: 0 0% 87%;
    --ring: 222.2 84% 4.9%;

    --radius: 0.5rem;

    /* Fundo de linha/card (creme), raw hex - nao segue a convencao
       hsl(var(--x)) porque nao precisa compor com opacidade. */
    --row-bg: #FAF6F0;
  }
```

- [ ] **Step 2: Update `.dark` tokens in `src/index.css`**

Replace the `.dark` block (lines 38–67) with:

```css
  .dark {
    /* #161616, nao preto puro - testado e rejeitado no brainstorm por
       ficar "pesado". */
    --background: 0 0% 8.6%;
    --foreground: 0 0% 100%;

    --card: 0 0% 8.6%;
    --card-foreground: 0 0% 100%;

    --popover: 0 0% 8.6%;
    --popover-foreground: 0 0% 100%;

    --primary: 0 0% 100%;
    --primary-foreground: 0 0% 0%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 0 0% 73%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 0 0% 36%;
    --input: 0 0% 36%;
    --ring: 212.7 26.8% 83.9%;
    color-scheme: dark;

    /* #454545, cinza da marca - fundo de linha/card no dark. */
    --row-bg: #454545;
  }
```

- [ ] **Step 3: Register the `row` color token in `tailwind.config.js`**

In `theme.extend.colors`, add after the `card` entry:

```js
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        row: "var(--row-bg)",
```

- [ ] **Step 4: Verify nothing broke**

Run: `cd C:/RN/front/front-tozzo.uk && bun run test`

Expected: existing suite (13 tests) still passes — `SettingsPage.test.tsx` in particular exercises the theme toggle and should still find `.light`/`.dark` classes on `document.documentElement` (token *values* changed, not the class-toggling mechanism).

- [ ] **Step 5: Manual visual check**

Run: `bun run dev`, open `http://localhost:5173/login`, toggle dark mode. Confirm: light background is pure white, dark background is dark charcoal (not black), primary button flips black↔white correctly.

- [ ] **Step 6: Commit**

```bash
git add src/index.css tailwind.config.js
git commit -m "feat(design-system): tokens de paleta preto/branco/creme (light+dark)"
```

---

### Task 2: `src/lib/status.ts` — status color/label map

**Files:**
- Create: `src/lib/status.ts`
- Test: `src/lib/status.test.ts`

**Interfaces:**
- Produces: `type PedidoStatus`, `STATUS_OPTIONS: { value: PedidoStatus; label: string }[]`, `getStatusColor(status: string): string`, `getStatusLabel(status: string): string`. Consumed by Task 4 (`StatusSelect`) and Tasks 6–7 (`TableRow accentColor`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/status.test.ts
import { describe, it, expect } from 'vitest'
import { STATUS_OPTIONS, getStatusColor, getStatusLabel } from './status'

describe('status', () => {
  it('lists all 4 order statuses in workflow order', () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'ABERTO', 'EM_PREPARO', 'ENTREGANDO', 'FECHADO',
    ])
  })

  it('maps each status to its approved hex color', () => {
    expect(getStatusColor('ABERTO')).toBe('#dc2626')
    expect(getStatusColor('EM_PREPARO')).toBe('#d97706')
    expect(getStatusColor('ENTREGANDO')).toBe('#2563eb')
    expect(getStatusColor('FECHADO')).toBe('#6b7280')
  })

  it('falls back to the FECHADO color for an unknown status', () => {
    expect(getStatusColor('QUALQUER_COISA')).toBe('#6b7280')
  })

  it('maps each status to its Portuguese label', () => {
    expect(getStatusLabel('EM_PREPARO')).toBe('Em Preparo')
  })

  it('falls back to the raw string for an unknown status label', () => {
    expect(getStatusLabel('X')).toBe('X')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/RN/front/front-tozzo.uk && bunx vitest run src/lib/status.test.ts`
Expected: FAIL — `Cannot find module './status'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/status.ts
export type PedidoStatus = 'ABERTO' | 'EM_PREPARO' | 'ENTREGANDO' | 'FECHADO'

export const STATUS_OPTIONS: { value: PedidoStatus; label: string }[] = [
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EM_PREPARO', label: 'Em Preparo' },
  { value: 'ENTREGANDO', label: 'Entregando' },
  { value: 'FECHADO', label: 'Fechado' },
]

// Semantica por urgencia (nao por "fase burocratica") - decidido no
// brainstorm 2026-08-06: ABERTO = precisa de atencao da cozinha (vermelho),
// nao "erro/perigo" generico.
const STATUS_COLORS: Record<PedidoStatus, string> = {
  ABERTO: '#dc2626',
  EM_PREPARO: '#d97706',
  ENTREGANDO: '#2563eb',
  FECHADO: '#6b7280',
}

const STATUS_LABELS: Record<PedidoStatus, string> = {
  ABERTO: 'Aberto',
  EM_PREPARO: 'Em Preparo',
  ENTREGANDO: 'Entregando',
  FECHADO: 'Fechado',
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as PedidoStatus] ?? STATUS_COLORS.FECHADO
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as PedidoStatus] ?? status
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/status.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/status.ts src/lib/status.test.ts
git commit -m "feat(design-system): mapa central status->cor/label"
```

---

### Task 3: `IconButton` component

**Files:**
- Create: `src/components/ui/icon-button.tsx`
- Test: `src/components/ui/icon-button.test.tsx`

**Interfaces:**
- Consumes: `Button`/`buttonVariants` from `src/components/ui/button.tsx` (`variant`/`size` props already defined there).
- Produces: `IconButton({ icon: React.ReactNode, label: string, ...ButtonProps })`, `IconButtonProps`. Consumed by Tasks 6–7.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/icon-button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Trash2 } from 'lucide-react'
import { IconButton } from './icon-button'

describe('IconButton', () => {
  it('renders the icon and exposes an accessible label', () => {
    render(<IconButton icon={<Trash2 data-testid="icon" />} label="Excluir pedido" />)
    expect(screen.getByRole('button', { name: 'Excluir pedido' })).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<IconButton icon={<Trash2 />} label="Excluir" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<IconButton icon={<Trash2 />} label="Excluir" onClick={onClick} disabled />)
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/ui/icon-button.test.tsx`
Expected: FAIL — `Cannot find module './icon-button'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ui/icon-button.tsx
import * as React from "react"
import { Button, type ButtonProps } from "./button"

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'children'> {
  icon: React.ReactNode
  label: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = "ghost", ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </Button>
  )
)
IconButton.displayName = "IconButton"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/ui/icon-button.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/icon-button.tsx src/components/ui/icon-button.test.tsx
git commit -m "feat(design-system): componente IconButton reutilizavel"
```

---

### Task 4: `StatusSelect` component

**Files:**
- Create: `src/components/ui/status-select.tsx`
- Test: `src/components/ui/status-select.test.tsx`

**Interfaces:**
- Consumes: `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue` from `src/components/ui/select.tsx`; `STATUS_OPTIONS`, `getStatusColor`, `PedidoStatus` from `src/lib/status.ts` (Task 2).
- Produces: `StatusSelect({ value: PedidoStatus, onValueChange: (v: PedidoStatus) => void, disabled?: boolean, className?: string })`. Consumed by Tasks 6.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/status-select.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusSelect } from './status-select'

describe('StatusSelect', () => {
  it('shows the current status label', () => {
    render(<StatusSelect value="EM_PREPARO" onValueChange={vi.fn()} />)
    expect(screen.getByText('Em Preparo')).toBeInTheDocument()
  })

  it('applies the status color as the trigger border color', () => {
    render(<StatusSelect value="ABERTO" onValueChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveStyle({ borderColor: '#dc2626' })
  })

  it('calls onValueChange with the new status when an option is picked', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<StatusSelect value="ABERTO" onValueChange={onValueChange} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Em Preparo' }))
    expect(onValueChange).toHaveBeenCalledWith('EM_PREPARO')
  })

  it('is disabled when disabled=true', () => {
    render(<StatusSelect value="FECHADO" onValueChange={vi.fn()} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/ui/status-select.test.tsx`
Expected: FAIL — `Cannot find module './status-select'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ui/status-select.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { STATUS_OPTIONS, getStatusColor, type PedidoStatus } from "@/lib/status"
import { cn } from "@/lib/utils"

interface StatusSelectProps {
  value: PedidoStatus
  onValueChange: (value: PedidoStatus) => void
  disabled?: boolean
  className?: string
}

export function StatusSelect({ value, onValueChange, disabled, className }: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as PedidoStatus)} disabled={disabled}>
      {/* bg-white/text-black fixos nos dois temas - decisao do brainstorm:
          usar a variavel de tema aqui fazia o texto sumir no dark mode. */}
      <SelectTrigger
        className={cn("w-[150px] border-2 bg-white text-black", className)}
        style={{ borderColor: getStatusColor(value) }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/ui/status-select.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/status-select.tsx src/components/ui/status-select.test.tsx
git commit -m "feat(design-system): componente StatusSelect (borda colorida por status)"
```

---

### Task 5: `TableRow` accent color variant

**Files:**
- Modify: `src/components/ui/table.tsx`
- Test: `src/components/ui/table.test.tsx`

**Interfaces:**
- Produces: `TableRow` gains an optional `accentColor?: string` prop. When set, renders a 4px colored left border, the `bg-row` background (Task 1's token), and a hover scale+shadow. When unset, behavior is byte-for-byte identical to today (`hover:bg-muted/50`) — every other table in the app (`ProductsPage`, `EmployeesPage`, etc.) must keep working unchanged. Consumed by Tasks 6–7.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/table.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Table, TableBody, TableRow, TableCell } from './table'

describe('TableRow', () => {
  it('renders with default hover styling when no accentColor is given', () => {
    render(
      <Table><TableBody>
        <TableRow><TableCell>plain row</TableCell></TableRow>
      </TableBody></Table>
    )
    const row = screen.getByText('plain row').closest('tr')!
    expect(row.className).toContain('hover:bg-muted/50')
    expect(row.className).not.toContain('bg-row')
    expect(row.style.borderLeftColor).toBe('')
  })

  it('renders the colored left border and row background when accentColor is given', () => {
    render(
      <Table><TableBody>
        <TableRow accentColor="#dc2626"><TableCell>accented row</TableCell></TableRow>
      </TableBody></Table>
    )
    const row = screen.getByText('accented row').closest('tr')!
    expect(row.className).toContain('bg-row')
    expect(row.className).toContain('border-l-4')
    expect(row.style.borderLeftColor).toBe('rgb(220, 38, 38)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/ui/table.test.tsx`
Expected: FAIL — second test fails (`accentColor` prop not applied, `bg-row`/`border-l-4` absent).

- [ ] **Step 3: Modify `TableRow` in `src/components/ui/table.tsx`**

Replace the existing `TableRow` block with:

```tsx
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  accentColor?: string
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, accentColor, style, ...props }, ref) => (
    <tr
      ref={ref}
      style={accentColor ? { borderLeftColor: accentColor, ...style } : style}
      className={cn(
        "border-b transition-all duration-150 data-[state=selected]:bg-muted",
        accentColor
          ? "bg-row border-l-4 hover:scale-[1.012] hover:shadow-md relative"
          : "hover:bg-muted/50",
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = "TableRow"
```

(Only the `TableRow` declaration changes — everything else in the file, including the `export { ... }` block, stays as-is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/ui/table.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `bun run test`
Expected: all existing tests still pass (no other table consumer passes `accentColor`, so their rows keep the `hover:bg-muted/50` branch).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/table.tsx src/components/ui/table.test.tsx
git commit -m "feat(design-system): TableRow ganha variante accentColor (barra + fundo creme/dark)"
```

---

### Task 6: `PedidosTab` — extract + redesign the orders table

**Files:**
- Create: `src/components/atendimento/PedidosTab.tsx`
- Reference (being replaced, do not modify yet): `src/pages/dashboard/OrdersPage.tsx`

**Interfaces:**
- Consumes: `StatusSelect` (Task 4), `IconButton` (Task 3), `getStatusColor` from `src/lib/status.ts` (Task 2), `TableRow accentColor` (Task 5), existing `ProductSelectionModal`, `Pagination`, `useRealtimeEvents`, `api`/`getErrorMessage`, `parseListResponse`.
- Produces: `PedidosTab({ onReady?: (handlers: { openCreate: () => void }) => void })`. `onReady` is called once after mount with an `openCreate` function the parent can invoke to open the "novo pedido" modal — this is how `AtendimentoPage` (Task 9) drives the shared "+ Novo Pedido" header button without lifting all of `PedidosTab`'s state up.

- [ ] **Step 1: Create `src/components/atendimento/PedidosTab.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusSelect } from "@/components/ui/status-select"
import { IconButton } from "@/components/ui/icon-button"
import { Printer, Pencil, Trash2, Loader2 } from "lucide-react"
import api, { getErrorMessage } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
import { getStatusColor, type PedidoStatus } from "@/lib/status"

type OrderItem = {
  produtoId: number
  quantidade: number
  produto?: { nome: string } | null
}

type Order = {
  id: number
  cliente: string
  total: number
  status: PedidoStatus
  dataCriacao: string
  updatedAt: string
  vendedor?: { id: number; nome: string } | null
  itens?: OrderItem[]
}

function isOrdersEqual(a: Order[], b: Order[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.id !== bi.id) return false
    if (ai.status !== bi.status) return false
    if ((ai.updatedAt || ai.dataCriacao) !== (bi.updatedAt || bi.dataCriacao)) return false
    if (ai.total !== bi.total) return false
  }
  return true
}

function formatItemsSummary(itens?: OrderItem[]): string {
  if (!itens || itens.length === 0) return ""
  return itens.map((i) => `${i.quantidade}x ${i.produto?.nome ?? "Produto"}`).join(", ")
}

interface PedidosTabProps {
  onReady?: (handlers: { openCreate: () => void }) => void
}

export function PedidosTab({ onReady }: PedidosTabProps) {
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [statusFilter, setStatusFilter] = useState<string>('NAO_FECHADOS')
  const [orders, setOrders] = useState<Order[]>([])
  const [totalPages, setTotalPages] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [currentOrderItems, setCurrentOrderItems] = useState<any[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const ordersRef = useRef<Order[]>([])

  const loadOrdersRaw = useCallback(async () => {
    const params: any = { page, limit }
    if (statusFilter) {
      params.status = statusFilter
    }

    const response = await api.get(`/pedidos`, { params })

    let { data, total } = parseListResponse<Order>(response)

    if (statusFilter === 'NAO_FECHADOS') {
      data = data.filter((o) => o.status !== 'FECHADO')
      total = data.length
    }

    return { data, total }
  }, [page, limit, statusFilter])

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, total } = await loadOrdersRaw()
      setOrders(data)
      ordersRef.current = data

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching orders", error)
    } finally {
      setIsLoading(false)
    }
  }, [loadOrdersRaw, limit, page])

  const poll = useCallback(async () => {
    try {
      const { data } = await loadOrdersRaw()
      const previous = ordersRef.current || []
      if (!isOrdersEqual(previous, data)) {
        setOrders(data)
        ordersRef.current = data
      }
    } catch (err) {
      console.error('[PedidosTab] Error polling orders', err)
    }
  }, [loadOrdersRaw])

  useRealtimeEvents(['pedidos'], poll)

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Fallback: SSE eh o caminho principal (useRealtimeEvents acima), esse
  // interval mais espaçado so cobre o caso de conexao SSE falhar silenciosamente.
  useEffect(() => {
    let interval: number | null = null

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 60000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      const visibility = (typeof document !== 'undefined' && document.visibilityState) || 'unknown'
      if (visibility === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [poll])

  const handleOpenCreateModal = useCallback(() => {
    setCurrentOrder(null)
    setCurrentOrderItems([])
    setIsModalOpen(true)
  }, [])

  useEffect(() => {
    onReady?.({ openCreate: handleOpenCreateModal })
  }, [onReady, handleOpenCreateModal])

  const handleEditClick = async (order: Order) => {
    setCurrentOrder(order)
    try {
      const response = await api.get(`/pedidos`, { params: { id: order.id } })

      let orderData = null
      if (response.data.data && Array.isArray(response.data.data)) {
        orderData = response.data.data[0]
      } else if (Array.isArray(response.data)) {
        orderData = response.data[0]
      }

      if (orderData && orderData.itens) {
        const items = orderData.itens.map((item: any) => ({
          produtoId: item.produtoId ?? (item.produto ? item.produto.id : undefined),
          quantidade: Number(item.quantidade) || 0,
          precoHistorico: item.precoHistorico != null ? Number(item.precoHistorico) : (item.preco != null ? Number(item.preco) : (item.produto ? Number(item.produto.preco || 0) : undefined)),
        })).filter((i: any) => i.produtoId != null && i.produtoId !== '')
        setCurrentOrderItems(items)
      } else {
        setCurrentOrderItems([])
      }
    } catch (error) {
      console.error("Error fetching order details", error)
      setCurrentOrderItems([])
    }
    setIsModalOpen(true)
  }

  const handleModalConfirm = async (cliente: string, itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]) => {
    try {
      if (currentOrder) {
        await api.put(`/pedidos/${currentOrder.id}`, { cliente, itens })
      } else {
        await api.post("/pedidos", { cliente, itens })
      }

      fetchOrders()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error saving order", error)
      toast.error(getErrorMessage(error, "Erro ao salvar pedido"))
    }
  }

  const handleDeleteOrder = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return
    setDeletingId(id)
    try {
      await api.delete(`/pedidos/${id}`)
      fetchOrders()
    } catch (error) {
      console.error("Error deleting order", error)
      toast.error(getErrorMessage(error, "Erro ao excluir pedido"))
    } finally {
      setDeletingId(null)
    }
  }

  const handleCloseOrder = async (id: number) => {
    if (!confirm("Tem certeza que deseja fechar este pedido? Ele será transformado em venda.")) return
    try {
      await api.post(`/pedidos/${id}/status`, { status: 'FECHADO' })
      fetchOrders()
    } catch (error) {
      console.error("Error closing order", error)
      toast.error(getErrorMessage(error, "Erro ao fechar pedido"))
    }
  }

  const handleChangeStatus = async (id: number, newStatus: string) => {
    setUpdatingStatusId(id)
    try {
      await api.post(`/pedidos/${id}/status`, { status: newStatus })
      fetchOrders()
    } catch (error) {
      console.error('Error updating order status', error)
      toast.error(getErrorMessage(error, 'Erro ao atualizar status do pedido'))
    } finally {
      setUpdatingStatusId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="w-[200px]">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NAO_FECHADOS">Não Fechados</SelectItem>
            <SelectItem value="ABERTO">Aberto</SelectItem>
            <SelectItem value="EM_PREPARO">Em Preparo</SelectItem>
            <SelectItem value="ENTREGANDO">Entregando</SelectItem>
            <SelectItem value="FECHADO">Fechado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={currentOrder ? "Editar Pedido (Adicionar Itens)" : "Novo Pedido"}
        initialClientName={currentOrder?.cliente || ""}
        initialOrderItems={currentOrderItems as any}
        isEditing={!!currentOrder}
        onCloseOrder={currentOrder ? () => handleCloseOrder(currentOrder.id) : undefined}
        initialStatus={currentOrder?.status}
        onChangeStatus={currentOrder ? (val: string) => handleChangeStatus(currentOrder.id, val) : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right justify-end flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, index) => (
                  <TableRow key={order.id} accentColor={getStatusColor(order.status)}>
                    <TableCell className="text-center">{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.cliente || "Não Informado"}</div>
                      {formatItemsSummary(order.itens) && (
                        <div
                          className="text-sm text-muted-foreground truncate max-w-[280px]"
                          title={formatItemsSummary(order.itens)}
                        >
                          {formatItemsSummary(order.itens)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.vendedor?.nome || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusSelect
                          value={order.status}
                          disabled={order.status === 'FECHADO' || updatingStatusId === order.id}
                          onValueChange={(val) => {
                            if (!confirm('Tem certeza que deseja alterar o status do pedido?')) return
                            handleChangeStatus(order.id, val)
                          }}
                        />
                        {updatingStatusId === order.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(order.updatedAt || order.dataCriacao).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <IconButton icon={<Printer className="h-4 w-4" />} label="Impressão (em breve)" disabled />
                        <IconButton icon={<Pencil className="h-4 w-4" />} label="Editar pedido" onClick={() => handleEditClick(order)} />
                        <IconButton
                          icon={deletingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          label="Excluir pedido"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deletingId === order.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            hasMore={hasMore}
            onPageChange={setPage}
            pageSize={limit}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit)
              setPage(1)
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd C:/RN/front/front-tozzo.uk && bunx tsc --noEmit`
Expected: no new errors from this file (existing `OrdersPage.tsx` still exists and still compiles too — it's deleted in Task 10).

- [ ] **Step 3: Commit**

```bash
git add src/components/atendimento/PedidosTab.tsx
git commit -m "feat(design-system): extrair e redesenhar tabela de pedidos em PedidosTab"
```

---

### Task 7: `VendasTab` — extract + redesign the sales table

**Files:**
- Create: `src/components/atendimento/VendasTab.tsx`
- Reference (being replaced, do not modify yet): `src/pages/dashboard/SalesPage.tsx`

**Interfaces:**
- Consumes: `IconButton` (Task 3), `getStatusColor('FECHADO')` from `src/lib/status.ts` (Task 2, reused for the row accent — a venda is always a closed/paid record), `TableRow accentColor` (Task 5), existing `ProductSelectionModal`, `Pagination`, `useRealtimeEvents`, `api`/`getErrorMessage`, `parseListResponse`.
- Produces: `VendasTab({ onReady?: (handlers: { openCreate: () => void }) => void })`, same `onReady` contract as `PedidosTab`.

- [ ] **Step 1: Create `src/components/atendimento/VendasTab.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconButton } from "@/components/ui/icon-button"
import { Printer, Eye, Search, Loader2 } from "lucide-react"
import api, { getErrorMessage } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { getStatusColor } from "@/lib/status"

type SaleItem = {
  produtoId: number
  quantidade: number
  produto?: { nome: string } | null
}

type Sale = {
  id: number
  cliente: string
  total: number
  horario: string
  vendedor?: { id: number; nome: string } | null
  itens?: SaleItem[]
}

function isSalesEqual(a: Sale[], b: Sale[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.id !== bi.id) return false
    if (ai.total !== bi.total) return false
    if ((ai.horario || '') !== (bi.horario || '')) return false
  }
  return true
}

function formatItemsSummary(itens?: SaleItem[]): string {
  if (!itens || itens.length === 0) return ""
  return itens.map((i) => `${i.quantidade}x ${i.produto?.nome ?? "Produto"}`).join(", ")
}

interface VendasTabProps {
  onReady?: (handlers: { openCreate: () => void }) => void
}

export function VendasTab({ onReady }: VendasTabProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [currentSaleItems, setCurrentSaleItems] = useState<{ produtoId: number | string; quantidade: number; precoHistorico?: number }[]>([])
  const [currentSaleClient, setCurrentSaleClient] = useState("")
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)
  const [currentSaleId, setCurrentSaleId] = useState<number | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [loadingSaleId, setLoadingSaleId] = useState<number | null>(null)

  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const formatTime = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${min}`
  }

  const now = new Date()
  const ago24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [startDate, setStartDate] = useState(formatDate(ago24))
  const [startTime, setStartTime] = useState(formatTime(ago24))
  const [endDate, setEndDate] = useState(formatDate(now))
  const [endTime, setEndTime] = useState(formatTime(now))
  const [periodTotal, setPeriodTotal] = useState(0)
  const salesRef = useRef<Sale[]>([])
  const filterRef = useRef({ startDate, startTime, endDate, endTime })

  useEffect(() => {
    filterRef.current = { startDate, startTime, endDate, endTime }
  }, [startDate, startTime, endDate, endTime])

  const fetchSales = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: any = { page, limit }
      if (startDate && startTime) {
        params.dataInicial = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      if (endDate && endTime) {
        params.dataFinal = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      const response = await api.get(`/vendas`, { params })
      const { data, total } = parseListResponse<Sale>(response, 'vendas')
      const fechamento = Number(response.data.fechamento) || 0

      setSales(data)
      salesRef.current = data
      setTotalItems(total)
      setPeriodTotal(fechamento)

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching sales", error)
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, startDate, startTime, endDate, endTime])

  useEffect(() => {
    fetchSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  const poll = useCallback(async () => {
    try {
      const { startDate, startTime, endDate, endTime } = filterRef.current
      const params: any = { page, limit }

      if (startDate && startTime) {
        params.dataInicial = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      if (endDate && endTime) {
        params.dataFinal = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      const response = await api.get(`/vendas`, { params })
      const { data, total } = parseListResponse<Sale>(response, 'vendas')
      const fechamento = Number(response.data.fechamento) || 0

      const previous = salesRef.current || []
      if (!isSalesEqual(previous, data)) {
        setSales(data)
        salesRef.current = data
        setTotalItems(total)
        setPeriodTotal(fechamento)

        if (total > 0) {
          setTotalPages(Math.ceil(total / limit))
          setHasMore(page < Math.ceil(total / limit))
        } else {
          setTotalPages(0)
          setHasMore(data.length === limit)
        }
      }
    } catch (err) {
      console.error('Error polling sales', err)
    }
  }, [page, limit])

  useRealtimeEvents(['vendas'], poll)

  useEffect(() => {
    let interval: number | null = null

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 60000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [poll])

  const handleModalConfirm = async (cliente: string, itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]) => {
    setIsLoading(true)
    try {
      await api.post("/vendas", { cliente, itens })
      await fetchSales()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error creating sale", error)
      toast.error(getErrorMessage(error, "Erro ao criar venda"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleInfoClick = async (sale: Sale) => {
    setLoadingSaleId(sale.id)
    try {
      if (sale.itens && Array.isArray(sale.itens)) {
        const items = sale.itens.map((item: any) => ({
          produtoId: item.produtoId ?? (item.produto ? item.produto.id : undefined),
          quantidade: Number(item.quantidade) || 0,
          precoHistorico: item.precoHistorico != null ? Number(item.precoHistorico) : (item.preco != null ? Number(item.preco) : (item.produto ? Number(item.produto.preco || 0) : undefined)),
        })).filter((i: any) => i.produtoId != null && i.produtoId !== '')
        setCurrentSaleItems(items)
      } else {
        setCurrentSaleItems([])
      }

      setCurrentSaleClient(sale.cliente)
      setCurrentSaleId(sale.id)
      setIsReadOnlyModal(true)
      setIsModalOpen(true)
    } catch (error) {
      console.error("Error fetching sale details", error)
      toast.error(getErrorMessage(error, "Erro ao carregar detalhes da venda"))
    } finally {
      setLoadingSaleId(null)
    }
  }

  const handleNewSaleClick = useCallback(() => {
    setCurrentSaleClient("")
    setCurrentSaleItems([])
    setIsReadOnlyModal(false)
    setCurrentSaleId(null)
    setIsModalOpen(true)
  }, [])

  useEffect(() => {
    onReady?.({ openCreate: handleNewSaleClick })
  }, [onReady, handleNewSaleClick])

  const handleCancelSale = async (id: number) => {
    try {
      await api.delete(`/vendas/${id}`)
      await fetchSales()
      setIsModalOpen(false)
      setCurrentSaleId(null)
    } catch (error) {
      console.error('Error cancelling sale', error)
      toast.error(getErrorMessage(error, 'Erro ao cancelar venda'))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Hora Inicial</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Hora Final</Label>
              <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={isLoading} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => { setPage(1); fetchSales(); }} className="w-full md:w-auto" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setCurrentSaleId(null); setIsReadOnlyModal(false) }}
        onConfirm={handleModalConfirm}
        title={isReadOnlyModal ? "Detalhes da Venda" : "Nova Venda"}
        initialClientName={currentSaleClient}
        initialOrderItems={currentSaleItems as any}
        readOnly={isReadOnlyModal}
        onCancelSale={isReadOnlyModal && currentSaleId ? async () => handleCancelSale(currentSaleId) : undefined}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Vendas no Período</CardTitle>
            <div className="text-sm text-muted-foreground mt-1">Total de registros: {totalItems}</div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-muted-foreground">Fechamento do Período</span>
            <span className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(periodTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right justify-end flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma venda encontrada no período.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale, index) => (
                  <TableRow key={sale.id} accentColor={getStatusColor('FECHADO')}>
                    <TableCell className="text-center">{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{sale.cliente || "Não Informado"}</div>
                      {formatItemsSummary(sale.itens) && (
                        <div
                          className="text-sm text-muted-foreground truncate max-w-[280px]"
                          title={formatItemsSummary(sale.itens)}
                        >
                          {formatItemsSummary(sale.itens)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sale.vendedor?.nome || "-"}</TableCell>
                    <TableCell>{sale.horario ? new Date(sale.horario).toLocaleString() : "-"}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <IconButton icon={<Printer className="h-4 w-4" />} label="Impressão (em breve)" disabled />
                        <IconButton
                          icon={loadingSaleId === sale.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                          label="Ver detalhes"
                          onClick={() => handleInfoClick(sale)}
                          disabled={loadingSaleId === sale.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            hasMore={hasMore}
            onPageChange={setPage}
            pageSize={limit}
            onPageSizeChange={(newLimit) => { setLimit(newLimit); setPage(1) }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/atendimento/VendasTab.tsx
git commit -m "feat(design-system): extrair e redesenhar tabela de vendas em VendasTab"
```

---

### Task 8: `ProdutosQuickTab` — new lightweight product tab

**Files:**
- Create: `src/components/atendimento/ProdutosQuickTab.tsx`
- Test: `src/components/atendimento/ProdutosQuickTab.test.tsx`

This is genuinely new code (not an extraction), so it gets a real test, unlike Tasks 6–7 which move already-shipped, previously-untested logic.

**Scope note:** per spec, this tab is search + compact list + a quick-create form — **not** the "adicionar rápido ao pedido/venda em andamento" cart integration also mentioned in the spec. That needs a shared draft-cart state across tabs that was never designed (how it reconciles with `ProductSelectionModal`'s own item list is unspecified) — building it now would be a half-finished feature. The concrete use case in the spec (needing a product that doesn't exist yet, mid-sale) is still solved: `ProductSelectionModal` re-fetches `/produtos` every time it opens, so a product created here shows up immediately in the next "+ Novo Pedido"/"+ Nova Venda".

**Interfaces:**
- Consumes: `api`, `getErrorMessage` from `src/services/api.ts`; existing `Select`/`Dialog`/`Input`/`Label`/`Button` primitives.
- Produces: `ProdutosQuickTab({ onReady?: (handlers: { openCreate: () => void }) => void })`, same `onReady` contract as Tasks 6–7 (here `openCreate` opens the "Produto novo" dialog).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/atendimento/ProdutosQuickTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProdutosQuickTab } from './ProdutosQuickTab'
import api from '@/services/api'

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

describe('ProdutosQuickTab', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/tipos') return Promise.resolve({ data: [{ id: 1, descricao: 'Lanches' }] })
      return Promise.resolve({ data: [{ id: 10, nome: 'X-Bacon', preco: '25.00', tipoProdutoId: 1 }] })
    })
  })

  it('lists products with their type name and formatted price', async () => {
    render(<ProdutosQuickTab />)
    expect(await screen.findByText('X-Bacon')).toBeInTheDocument()
    expect(screen.getByText('Lanches')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*25,00/)).toBeInTheDocument()
  })

  it('exposes an openCreate handler via onReady that opens the quick-create dialog', async () => {
    let handlers: { openCreate: () => void } | null = null
    render(<ProdutosQuickTab onReady={(h) => { handlers = h }} />)
    await waitFor(() => expect(handlers).not.toBeNull())

    handlers!.openCreate()
    expect(await screen.findByText('Produto novo')).toBeInTheDocument()
  })

  it('creates a product and refreshes the list', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    let handlers: { openCreate: () => void } | null = null
    render(<ProdutosQuickTab onReady={(h) => { handlers = h }} />)
    await waitFor(() => expect(handlers).not.toBeNull())
    handlers!.openCreate()

    await user.type(await screen.findByLabelText('Nome'), 'Coca-Cola')
    await user.type(screen.getByLabelText('Preço'), '600')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Lanches' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/produtos', {
      nome: 'Coca-Cola',
      preco: 6,
      ingredientes: '',
      tipoProdutoId: 1,
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/atendimento/ProdutosQuickTab.test.tsx`
Expected: FAIL — `Cannot find module './ProdutosQuickTab'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/atendimento/ProdutosQuickTab.tsx
import { useState, useEffect, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Loader2 } from "lucide-react"
import api, { getErrorMessage } from "@/services/api"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

type ProductType = { id: number; descricao: string }
type Product = { id: number; nome: string; preco: number; tipoProdutoId: number }

interface ProdutosQuickTabProps {
  onReady?: (handlers: { openCreate: () => void }) => void
}

export function ProdutosQuickTab({ onReady }: ProdutosQuickTabProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [types, setTypes] = useState<ProductType[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [typeId, setTypeId] = useState("")

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await api.get("/produtos", { params: { search } })
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
      setProducts(data.map((p: any) => ({ ...p, preco: Number(p.preco) || 0 })))
    } catch (error) {
      console.error("Error fetching products", error)
    } finally {
      setIsLoading(false)
    }
  }, [search])

  const fetchTypes = useCallback(async () => {
    try {
      const response = await api.get("/tipos", { params: { all: true } })
      setTypes(response.data.map((t: any) => ({ id: t.id, descricao: t.descricao })))
    } catch (error) {
      console.error("Error fetching types", error)
    }
  }, [])

  useEffect(() => {
    fetchTypes()
  }, [fetchTypes])

  useEffect(() => {
    const delay = setTimeout(fetchProducts, 300)
    return () => clearTimeout(delay)
  }, [fetchProducts])

  const getTypeName = (id: number) => types.find((t) => t.id === id)?.descricao ?? "-"

  const openCreate = useCallback(() => {
    setName("")
    setPrice("")
    setTypeId("")
    setIsDialogOpen(true)
  }, [])

  useEffect(() => {
    onReady?.({ openCreate })
  }, [onReady, openCreate])

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "")
    setPrice((parseInt(rawValue || "0") / 100).toFixed(2))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!typeId) {
      toast.warning("Selecione um tipo de produto.")
      return
    }
    setIsSaving(true)
    try {
      await api.post("/produtos", {
        nome: name,
        preco: parseFloat(price),
        ingredientes: "",
        tipoProdutoId: parseInt(typeId),
      })
      toast.success("Produto criado.")
      setIsDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error("Error creating product", error)
      toast.error(getErrorMessage(error, "Erro ao criar produto"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Produtos</CardTitle>
        <div className="relative w-[250px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{getTypeName(product.tipoProdutoId)}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.preco)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produto novo</DialogTitle>
            <DialogDescription>Cadastro rápido — para edição completa, use a página Produtos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-name">Nome</Label>
              <Input id="quick-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-price">Preço</Label>
              <Input id="quick-price" value={price} onChange={handlePriceChange} placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-type">Tipo</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger id="quick-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>{type.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/atendimento/ProdutosQuickTab.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/atendimento/ProdutosQuickTab.tsx src/components/atendimento/ProdutosQuickTab.test.tsx
git commit -m "feat(design-system): nova aba Produtos (busca + cadastro rapido)"
```

---

### Task 9: `AtendimentoPage` — compose the 3 tabs

**Files:**
- Create: `src/pages/dashboard/AtendimentoPage.tsx`
- Test: `src/pages/dashboard/AtendimentoPage.test.tsx`

**Interfaces:**
- Consumes: `PedidosTab` (Task 6), `VendasTab` (Task 7), `ProdutosQuickTab` (Task 8), `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `src/components/ui/tabs.tsx`, `useSearchParams` from `react-router-dom`, `useAuth` from `src/contexts/AuthContext`.
- Produces: default-exported `AtendimentoPage` component, routed as both `/dashboard` (index) and `/dashboard/atendimento` in Task 10. Reads/writes the `?tab=` query param (`pedidos` default, `vendas`, `produtos`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/dashboard/AtendimentoPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AtendimentoPage from './AtendimentoPage'
import api from '@/services/api'

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [], headers: {} }), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { estabelecimento: { nomeFantasia: 'Loja Teste' } } }),
}))

vi.mock('@/hooks/useRealtimeEvents', () => ({
  useRealtimeEvents: () => {},
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AtendimentoPage />
    </MemoryRouter>
  )
}

describe('AtendimentoPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockClear()
  })

  it('defaults to the Pedidos tab and shows the matching action button', async () => {
    renderAt('/dashboard/atendimento')
    expect(await screen.findByRole('button', { name: /Novo Pedido/i })).toBeInTheDocument()
  })

  it('reads the initial tab from the ?tab= query param', async () => {
    renderAt('/dashboard/atendimento?tab=vendas')
    expect(await screen.findByRole('button', { name: /Nova Venda/i })).toBeInTheDocument()
  })

  it('switches the action button label when the user changes tabs', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard/atendimento')
    await screen.findByRole('button', { name: /Novo Pedido/i })

    await user.click(screen.getByRole('tab', { name: 'Produtos' }))

    expect(await screen.findByRole('button', { name: /Novo Produto/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/pages/dashboard/AtendimentoPage.test.tsx`
Expected: FAIL — `Cannot find module './AtendimentoPage'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/pages/dashboard/AtendimentoPage.tsx
import { useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, ClipboardList } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { PedidosTab } from "@/components/atendimento/PedidosTab"
import { VendasTab } from "@/components/atendimento/VendasTab"
import { ProdutosQuickTab } from "@/components/atendimento/ProdutosQuickTab"

type TabKey = 'pedidos' | 'vendas' | 'produtos'
const VALID_TABS: TabKey[] = ['pedidos', 'vendas', 'produtos']

const TAB_ACTION_LABEL: Record<TabKey, string> = {
  pedidos: '+ Novo Pedido',
  vendas: '+ Nova Venda',
  produtos: '+ Novo Produto',
}

export default function AtendimentoPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: TabKey = VALID_TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'pedidos'
  const [createHandler, setCreateHandler] = useState<(() => void) | null>(null)

  const handleTabChange = (value: string) => {
    setSearchParams(value === 'pedidos' ? {} : { tab: value }, { replace: true })
    setCreateHandler(null)
  }

  const registerCreateHandler = useCallback((handlers: { openCreate: () => void }) => {
    setCreateHandler(() => handlers.openCreate)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-8 w-8" />
          {`Atendimento${user?.estabelecimento?.nomeFantasia ? ` — ${user.estabelecimento.nomeFantasia}` : ''}`}
        </h1>
        <Button onClick={() => createHandler?.()} disabled={!createHandler}>
          <Plus className="mr-2 h-4 w-4" /> {TAB_ACTION_LABEL[activeTab]}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <PedidosTab onReady={registerCreateHandler} />
        </TabsContent>
        <TabsContent value="vendas">
          <VendasTab onReady={registerCreateHandler} />
        </TabsContent>
        <TabsContent value="produtos">
          <ProdutosQuickTab onReady={registerCreateHandler} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/pages/dashboard/AtendimentoPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/AtendimentoPage.tsx src/pages/dashboard/AtendimentoPage.test.tsx
git commit -m "feat(design-system): pagina Atendimento (Pedidos+Vendas+Produtos em abas)"
```

---

### Task 10: Routing — `AtendimentoPage` as index, redirect old routes, delete old pages

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/pages/dashboard/OrdersPage.tsx`
- Delete: `src/pages/dashboard/SalesPage.tsx`

**Interfaces:**
- Consumes: `AtendimentoPage` (Task 9).

- [ ] **Step 1: Update the import line in `src/App.tsx`**

Change line 2 from:

```tsx
import { createBrowserRouter, RouterProvider, Outlet, useNavigation } from 'react-router-dom'
```

to:

```tsx
import { createBrowserRouter, RouterProvider, Outlet, useNavigation, Navigate } from 'react-router-dom'
```

- [ ] **Step 2: Update the `/dashboard` children in `src/App.tsx`**

Replace:

```tsx
            children: [
              { index: true, lazy: lazyPage(() => import('./pages/dashboard/OrdersPage')) },
              { path: "orders", lazy: lazyPage(() => import('./pages/dashboard/OrdersPage')) },
              { path: "sales", lazy: lazyPage(() => import('./pages/dashboard/SalesPage')) },
              { path: "products", lazy: lazyPage(() => import('./pages/dashboard/ProductsPage')) },
              { path: "employees", lazy: lazyPage(() => import('./pages/dashboard/EmployeesPage')) },
              { path: "charts", lazy: lazyPage(() => import('./pages/dashboard/ChartsPage')) },
              { path: "settings", lazy: lazyPage(() => import('./pages/dashboard/SettingsPage')) },
            ]
```

with:

```tsx
            children: [
              { index: true, lazy: lazyPage(() => import('./pages/dashboard/AtendimentoPage')) },
              { path: "atendimento", lazy: lazyPage(() => import('./pages/dashboard/AtendimentoPage')) },
              { path: "orders", element: <Navigate to="/dashboard/atendimento?tab=pedidos" replace /> },
              { path: "sales", element: <Navigate to="/dashboard/atendimento?tab=vendas" replace /> },
              { path: "products", lazy: lazyPage(() => import('./pages/dashboard/ProductsPage')) },
              { path: "employees", lazy: lazyPage(() => import('./pages/dashboard/EmployeesPage')) },
              { path: "charts", lazy: lazyPage(() => import('./pages/dashboard/ChartsPage')) },
              { path: "settings", lazy: lazyPage(() => import('./pages/dashboard/SettingsPage')) },
            ]
```

- [ ] **Step 3: Delete the now-unused page files**

```bash
cd C:/RN/front/front-tozzo.uk
git rm src/pages/dashboard/OrdersPage.tsx src/pages/dashboard/SalesPage.tsx
```

- [ ] **Step 4: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun run test`
Expected: no errors, no import of the deleted files anywhere (Task 11 will remove the `DashboardLayout` references before this step if done out of order — do Task 11 first if `tsc` complains about stale nav hrefs; hrefs are just strings, so `tsc` won't actually catch that, but grep to be safe: `grep -rn "OrdersPage\|SalesPage" src/` should return nothing).

- [ ] **Step 5: Manual check**

Run: `bun run dev`, visit `/dashboard/orders` and `/dashboard/sales` directly in the browser — both should redirect to `/dashboard/atendimento` with the right tab selected.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(design-system): Atendimento vira landing do dashboard, /orders e /sales redirecionam"
```

---

### Task 11: `DashboardLayout` nav — collapse Pedidos+Vendas into "Atendimento"

**Files:**
- Modify: `src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Update `navItems` (currently lines 30–37)**

Replace:

```tsx
  const navItems = [
    { href: "/dashboard/orders", label: "Pedidos", icon: ClipboardList },
    { href: "/dashboard/sales", label: "Vendas", icon: LayoutDashboard },
    { href: "/dashboard/products", label: "Produtos", icon: ShoppingBag },
    { href: "/dashboard/employees", label: "Funcionários", icon: Users },
    { href: "/dashboard/charts", label: "Relatórios", icon: BarChart3 },
    { href: "/dashboard/settings", label: "Configurações", icon: Settings },
  ]
```

with:

```tsx
  const navItems = [
    { href: "/dashboard/atendimento", label: "Atendimento", icon: ClipboardList },
    { href: "/dashboard/products", label: "Produtos", icon: ShoppingBag },
    { href: "/dashboard/employees", label: "Funcionários", icon: Users },
    { href: "/dashboard/charts", label: "Relatórios", icon: BarChart3 },
    { href: "/dashboard/settings", label: "Configurações", icon: Settings },
  ]
```

- [ ] **Step 2: Update the `isActive`/badge checks (currently lines 51 and 64)**

Replace:

```tsx
          const isActive = location.pathname === item.href || (item.href === "/dashboard/orders" && location.pathname === "/dashboard")
```

with:

```tsx
          const isActive = location.pathname === item.href || (item.href === "/dashboard/atendimento" && location.pathname === "/dashboard")
```

and replace:

```tsx
                  {item.href === "/dashboard/orders" && (
```

with:

```tsx
                  {item.href === "/dashboard/atendimento" && (
```

- [ ] **Step 3: Remove the now-unused `LayoutDashboard` import**

`LayoutDashboard` was only used for the old "Vendas" nav item icon. Remove it from the `lucide-react` import list at the top of the file (verify first: `grep -n "LayoutDashboard" src/layouts/DashboardLayout.tsx` should only show the import line after this edit).

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors (confirms `LayoutDashboard` removal didn't leave a dangling reference).

- [ ] **Step 5: Manual check**

`bun run dev`, confirm the sidebar shows one "Atendimento" entry (not "Pedidos"+"Vendas"), the non-closed-orders count badge still appears on it, and it highlights as active on both `/dashboard` and `/dashboard/atendimento`.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/DashboardLayout.tsx
git commit -m "feat(design-system): nav do dashboard troca Pedidos+Vendas por Atendimento"
```

---

### Task 12: Full regression pass

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `cd C:/RN/front/front-tozzo.uk && bun run test`
Expected: all tests pass (13 pre-existing + ~20 new from this plan).

- [ ] **Step 2: Full build**

Run: `bun run build`
Expected: `tsc && vite build` completes with no type errors and no unused-import warnings.

- [ ] **Step 3: Manual walkthrough**

`bun run dev`, then in the browser:
1. Log in, land on `/dashboard` → confirm it shows "Atendimento" with the Pedidos tab active by default.
2. Create a pedido via "+ Novo Pedido", confirm it appears with the correct status color (red left border for `ABERTO`) and the item summary line under the client name.
3. Change its status via the dropdown in the table (not FECHADO) → confirm the left border color updates.
4. Close a pedido (status → `FECHADO`) → confirm the status dropdown becomes disabled/grayed but still shows the status color.
5. Switch to the Vendas tab → confirm the header button becomes "+ Nova Venda", the table shows items inline, and the "Ver detalhes" icon opens the existing read-only modal (including "Cancelar Venda").
6. Switch to the Produtos tab → search for a product, then use "+ Novo Produto" to create one, confirm it appears in the list.
7. Toggle dark mode (Configurações or the navbar toggle) → confirm the row background switches to solid `#454545`, page background to `#161616`, and the status-select/icon-buttons stay white-chip/black-text (not washed out).
8. Visit `/dashboard/orders` and `/dashboard/sales` directly → confirm both redirect into `/dashboard/atendimento` with the right tab.

- [ ] **Step 4: Update `plano.md` status**

`plano.md` (raiz `C:/RN`) currently marks Fase 4 as "🔨 EM BRAINSTORM ATIVO" with a long "Em aberto" list. Update the Fase 4 section to reflect what shipped in this plan (tokens, pedidos/vendas table redesign, Atendimento page) versus what's still open (Badge/EmptyState, ProductsPage/EmployeesPage palette application, Button variants, responsividade — all still unbrainstormed, unchanged). This is a manual doc edit, not a commit inside the front repo (the file lives in `C:/RN`, which is not a git repo per the project's own CLAUDE.md).

---

## Self-Review Notes

- **Spec coverage:** palette tokens (Task 1), status color map single-source-of-truth (Task 2), `StatusSelect`/`IconButton` primitives (Tasks 3–4), table row accent variant (Task 5), pedidos table redesign incl. items-by-extenso and reordered Ações icons (Task 6), vendas table reusing the same primitives with the Info column folded into Ações (Task 7), Atendimento landing page with 3 tabs and a tab-aware action button (Tasks 8–9), routing/nav integration (Tasks 10–11) — all covered. Logo swap commit (Task 0) closes out the one piece of Fase 4 that was already code-complete but uncommitted.
- **Explicitly deferred (not gaps — matches the spec's own "Em aberto" list plus the user's answer in this session):** reopening `FECHADO` orders (backend unchanged, confirmed with user), `Badge`/`EmptyState` components, `ProductsPage`/`EmployeesPage` full palette rollout, `Button` variant coverage beyond what already exists, dashboard responsiveness, and the cross-tab "add to draft order" cart wiring in the Produtos tab.
- **Type consistency check:** `PedidoStatus` (Task 2) is used as-is in `PedidosTab`'s `Order.status` field and `StatusSelect`'s `value`/`onValueChange` types (Task 4/6) — no mismatched signatures. `onReady?: (handlers: { openCreate: () => void }) => void` is identical across `PedidosTab`, `VendasTab`, `ProdutosQuickTab` (Tasks 6–8) and consumed uniformly in `AtendimentoPage` (Task 9) via one `registerCreateHandler`.
