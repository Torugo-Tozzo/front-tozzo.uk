# Pagamento e Cozinha Front Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the payment selector and kitchen dashboard to the web app with role-aware navigation and resilient realtime updates.

**Architecture:** Keep HTTP legacy conversion in `src/services/api.ts`/`src/lib/legacyWire.ts`, add typed kitchen DTOs, and reuse the shared realtime hook. `COOK` gets a dedicated dashboard route and route guard; existing order/sales screens retain their current workflows with payment/readiness additions.

**Tech Stack:** React 18, TypeScript, Vite, React Router, Tailwind, Radix UI, i18next, Bun tests and Testing Library.

**Spec:** API sibling `../api-tozzo.uk/proximas-etapas/001-pagamento-cozinha/00-especificacao.md`, `01-plano-pagamento.md`, `02-plano-cozinha.md`.

## Global Constraints

- Do not modify mobile, add dependencies, or bypass API authorization with UI hiding.
- Add identical i18n keys to `en`, `pt-BR`, `es`, `fr`, `zh`, and `hi`.
- Preserve form state on payment failure and prevent duplicate submissions.
- Do not create a new EventSource; reuse `useRealtimeEvents`, clean timers on unmount, and avoid overlapping refreshes.
- Keep legacy conversion at the HTTP boundary and test serialized payloads.

## Review Focus

- Payment dialog cancel/reopen/failure must not submit or leak the previous selection: cover in `PedidosTab` tests.
- A COOK entering through a direct URL cannot mount finance/management pages or fetch their data: cover in route/auth tests.
- A stale kitchen response cannot overwrite a newer page/unmounted component: cover in kitchen hook/page tests.
- Refresh errors preserve existing cards and disable commands until recovery: cover in kitchen page tests.
- Narrow viewports and keyboard users can operate all kitchen item actions: cover with accessible labels and component tests.

### Task 1: Models, wire conversion, i18n, and role-aware auth/navigation

**Files:**
- Modify: `src/domain/models.ts`, `src/domain/dtos.ts`, `src/lib/legacyWire.ts`, `src/services/api.ts`, `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/App.tsx`, `src/layouts/DashboardLayout.tsx`
- Modify: `src/i18n/config.ts` and all six locale JSON files
- Test: `src/lib/legacyWire.test.ts`, `src/contexts/AuthContext.test.tsx`, `src/components/ProtectedRoute.test.tsx`, `src/layouts/DashboardLayout.test.tsx`

- [ ] Write failing tests for COOK normalization/labels, summarized establishment auth without `/estabelecimentos`, protected route redirects, and `/cozinha/` wire bypass.
- [ ] Run focused tests red.
- [ ] Add `COOK` types, role labels, kitchen route, role-specific layout and auth behavior, and i18n namespace registration with matching keys.
- [ ] Run focused tests plus `bun run i18n:check`; commit `feat: add cook web access boundaries`.

### Task 2: Payment close dialog and sales/receipt display

**Files:**
- Modify: `src/components/dashboard/PedidosTab.tsx`, `src/components/dashboard/VendasTab.tsx`, `src/components/receipt/ReceiptPrintView.tsx`, `src/components/receipt/printReceipt.ts`
- Modify: payment/order locale sections in all six locale JSON files
- Test: `src/components/dashboard/PedidosTab.test.tsx`, `src/components/dashboard/orders-sales-chrome.test.tsx`, `src/components/receipt/printReceipt.test.tsx`

- [ ] Write failing tests for null/five-method payloads, cancel/reopen, duplicate blocking, error retention, payment column and receipt wording for credit/fiado.
- [ ] Run tests red.
- [ ] Implement the controlled dialog and API payload, then expose payment only for closed sales and preserve existing refresh/error behavior.
- [ ] Run focused tests and `bun run i18n:check`; commit `feat: add payment selection to order closing`.

### Task 3: Existing order readiness and item identity preservation

**Files:**
- Modify: `src/domain/models.ts`, `src/components/ProductSelectionModal.tsx`, `src/components/dashboard/PedidosTab.tsx`
- Test: `src/components/ProductSelectionModal.test.tsx`, `src/components/dashboard/PedidosTab.test.tsx`

- [ ] Write failing tests for sending existing item ids, preserving `kitchenReadyAt`, showing the ready badge, restarting a ready item explicitly, and resetting only changed quantities.
- [ ] Run them red.
- [ ] Implement DTO mapping and editor behavior while keeping the three existing order statuses.
- [ ] Run focused order tests; commit `feat: preserve kitchen progress in web orders`.

### Task 4: Kitchen page and resilient refresh workflow

**Files:**
- Create: `src/pages/dashboard/KitchenPage.tsx`, `src/pages/dashboard/KitchenPage.test.tsx`
- Create: `src/domain/kitchen.ts` or equivalent focused API/types module and tests
- Modify: `src/services/api.ts`, `src/App.tsx`, kitchen locale namespace files

- [ ] Write failing tests for three-stage grouping, item actions, pagination, empty/error states, stale response handling, fallback polling, focus/visibility refresh, and no overlapping requests.
- [ ] Run them red.
- [ ] Implement GET/PATCH kitchen service calls, page grouping and controls, shared SSE invalidation, 15-second fallback, 30-second age clock, page correction, and accessible responsive layout.
- [ ] Run kitchen tests and `bun run i18n:check`; commit `feat: add kitchen dashboard`.

### Task 5: Web verification and branch handoff

- [ ] Run `bun run test`, `bun run i18n:check`, and `bun run build` from the front worktree.
- [ ] Review the diff against the API contracts and ensure no mobile files or dependency files changed.
- [ ] Commit verification/documentation corrections as `test: verify payment and kitchen web`.
- [ ] Leave the branch ready for a PR targeting `dev`; do not push or open the external PR automatically.
