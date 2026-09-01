# Fase 2 — Tiers de precificação (Front) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard web reflete os 3 tiers (Free/Pago/Enterprise): checkout novo, paywall quando a API retorna `PLAN_UPGRADE_REQUIRED`/`REPORT_QUOTA_EXCEEDED`, tela de dispositivos e seção de plano/uso nas configurações.

**Architecture:** Componente `PaywallBanner` reutilizável (reaproveita o padrão `Alert variant="warning"` já usado em `ProductsPage.tsx`) plugado nos dois pontos que a API passou a bloquear por plano (`ChartsPage`, `EmployeesPage`). `PlanSelectionPage` passa a chamar o endpoint genérico `POST /payments/stripe/checkout`. `DevicesPage` é página nova, seguindo o padrão lista+empty-state+loading de `EmployeesPage.tsx`.

**Tech Stack:** Vite + React 18 + TS + Tailwind + Radix + `react-router` + `bun:test` + `@testing-library/react`.

**Spec:** `C:\RN\TozzoBurger\docs\superpowers\specs\2026-08-30-fase-2-tiers-precificacao-design.md`

**Depende de:** o plano da API (`api/api-tozzo.uk/docs/superpowers/plans/2026-08-31-fase-2-tiers-precificacao-api.md`) — os códigos de erro (`PLAN_UPGRADE_REQUIRED`, `REPORT_QUOTA_EXCEEDED`, `DEVICE_LIMIT_REACHED`, `PRODUCT_LIMIT_REACHED`) e os campos novos de `GET /estabelecimentos` (`plan`, `extraDevices`, `reportCount`, `reportCountResetAt`, `printCountToday`, `_count.devices`) só existem depois desse plano rodar.

## Global Constraints

- Este projeto tem um sistema fechado de i18n com 2 testes de guarda (`src/i18n/resources.test.ts`, `src/i18n/ui-inventory.test.ts`) — rodar `bun test src/i18n` depois de qualquer alteração em locale/JSON.
  - `resources.test.ts` exige **exatamente** os namespaces `common, auth, navigation, orders, sales, products, employees, charts, settings, sync, printer, status, errors, catalog, legal` em **todos** os 6 locales (`en, pt-BR, es, fr, zh, hi`) — não criar namespace novo, reaproveitar `errors`/`settings`/`navigation`.
  - `ui-inventory.test.ts` mantém uma lista manual (`requiredUiInventory`) de `{ source: "arquivo:linha", key: "namespace.chave" }` — toda chave nova referenciada por uma chamada **literal** `t("chave")`/`tErrors("chave")` precisa de uma entrada aqui, com a linha exata do arquivo final (conferir depois de escrever o código, não adivinhar). Chaves de `errors.*` só ficam isentas dessa entrada se forem lidas *dinamicamente* via `localizedError(...)`/`getErrorTranslationKey(...)` já presente no mesmo arquivo (é o caso de `createProduct`/`createEmployee` — não da entrada explícita porque essas páginas já chamam `localizedError`).
- Toda chave nova vai pro `en.json` e pro `pt-BR.json` com o texto real (fornecido abaixo). Pros outros 4 locales (`es`, `fr`, `zh`, `hi`), adicionar a mesma chave traduzida, seguindo o tom das strings vizinhas do mesmo arquivo — isso é tradução de verdade, não pode ficar em inglês/português nos outros arquivos (quebraria a paridade que os testes de guarda checam pelo menos em "não vazio", mas a intenção do produto é que sejam traduzidas).
- `plan`/`extraDevices`/`reportCount`/`reportCountResetAt`/`printCountToday` chegam do backend em **camelCase direto** (não têm entrada em `LEGACY_FIELD_NAMES`, passam sem renomear — ver `api/api-tozzo.uk/lib/legacyWire.ts`).

---

## Task 1: Domain model + `PaywallBanner`

**Files:**
- Modify: `src/domain/models.ts:1-9`
- Create: `src/components/dashboard/PaywallBanner.tsx`, `src/components/dashboard/PaywallBanner.test.tsx`

**Interfaces:**
- Produces: `EstablishmentPlan = 'FREE' | 'PAGO' | 'PAGO_LEGADO' | 'ENTERPRISE'`, `Establishment` ganha `plan`, `extraDevices`, `reportCount`, `reportCountResetAt`, `printCountToday?`; `Device { id, info, lastSeen, createdAt }`; `PaywallCode = 'PLAN_UPGRADE_REQUIRED' | 'REPORT_QUOTA_EXCEEDED' | 'DEVICE_LIMIT_REACHED'`; `<PaywallBanner code={PaywallCode} role={string} />` — usado pelas Tasks 3 e 4.

- [ ] **Step 1: Estender `src/domain/models.ts`**

```ts
export type EstablishmentStatus = 'ACTIVE' | 'PENDING_PAYMENT' | 'SUSPENDED';
export type EstablishmentPlan = 'FREE' | 'PAGO' | 'PAGO_LEGADO' | 'ENTERPRISE';
export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'CUSTOMER';
export type OrderItemStatus = 'REQUESTED' | 'IN_PREPARATION' | 'DELIVERED';

export interface Establishment {
  id: number | string;
  tradeName: string;
  status: EstablishmentStatus;
  plan?: EstablishmentPlan;
  extraDevices?: number;
  reportCount?: number;
  reportCountResetAt?: string;
  printCountToday?: number;
}

export interface Device {
  id: number | string;
  info?: Record<string, unknown> | null;
  lastSeen?: string | null;
  createdAt?: string;
}
```

(Os demais tipos do arquivo continuam sem mudança.)

- [ ] **Step 2: Rodar `tsc` (só checagem de tipo, sem teste de runtime pra uma interface)**

Run: `bunx tsc --noEmit`
Expected: sem erro (adição de campos opcionais não quebra nenhum uso existente).

- [ ] **Step 3: Adicionar as chaves de i18n do `PaywallBanner` em `en.json` e `pt-BR.json`, namespace `errors`**

Em `src/i18n/locales/en.json`, dentro do bloco `"errors": { ... }` (a partir da linha 617), adicionar:

```json
"planUpgradeRequired": "This feature is only available on paid plans.",
"reportQuotaExceeded": "Monthly report limit reached on the Free plan.",
"deviceLimitReached": "Device limit reached for your current plan.",
"upgradeCta": "Upgrade plan",
"askOwnerCta": "Ask the owner to upgrade the plan to unlock this."
```

Em `src/i18n/locales/pt-BR.json`, no mesmo bloco `"errors"`:

```json
"planUpgradeRequired": "Este recurso está disponível apenas em planos pagos.",
"reportQuotaExceeded": "Limite mensal de relatórios atingido no plano Free.",
"deviceLimitReached": "Limite de dispositivos atingido no seu plano atual.",
"upgradeCta": "Fazer upgrade",
"askOwnerCta": "Peça pro dono fazer upgrade do plano pra liberar isso."
```

Adicionar as mesmas 5 chaves, traduzidas, em `es.json`, `fr.json`, `zh.json`, `hi.json` (mesmo bloco `errors`).

- [ ] **Step 4: Escrever o teste de `PaywallBanner`**

```tsx
// src/components/dashboard/PaywallBanner.test.tsx
import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import { PaywallBanner } from "./PaywallBanner";

function renderBanner(code: "PLAN_UPGRADE_REQUIRED" | "REPORT_QUOTA_EXCEEDED" | "DEVICE_LIMIT_REACHED", role: string) {
  i18n.changeLanguage("en");
  return render(
    <I18nextProvider i18n={i18n}>
      <PaywallBanner code={code} role={role} />
    </I18nextProvider>
  );
}

describe("PaywallBanner", () => {
  test("mostra mensagem de upgrade e CTA de upgrade pro OWNER", () => {
    renderBanner("PLAN_UPGRADE_REQUIRED", "OWNER");
    expect(screen.getByText(/only available on paid plans/i)).toBeTruthy();
    expect(screen.getByText(/upgrade plan/i)).toBeTruthy();
  });

  test("mostra instrucao pro dono quando role nao e OWNER", () => {
    renderBanner("PLAN_UPGRADE_REQUIRED", "MANAGER");
    expect(screen.getByText(/ask the owner/i)).toBeTruthy();
  });

  test("mensagem certa pra REPORT_QUOTA_EXCEEDED", () => {
    renderBanner("REPORT_QUOTA_EXCEEDED", "OWNER");
    expect(screen.getByText(/monthly report limit/i)).toBeTruthy();
  });

  test("mensagem certa pra DEVICE_LIMIT_REACHED", () => {
    renderBanner("DEVICE_LIMIT_REACHED", "OWNER");
    expect(screen.getByText(/device limit reached/i)).toBeTruthy();
  });
});
```

- [ ] **Step 5: Rodar (deve falhar — componente não existe)**

Run: `bun test src/components/dashboard/PaywallBanner.test.tsx`
Expected: FAIL

- [ ] **Step 6: Implementar `PaywallBanner.tsx`**

```tsx
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type PaywallCode = "PLAN_UPGRADE_REQUIRED" | "REPORT_QUOTA_EXCEEDED" | "DEVICE_LIMIT_REACHED";

interface PaywallBannerProps {
  code: PaywallCode;
  role?: string;
}

export function PaywallBanner({ code, role }: PaywallBannerProps) {
  const { t: tErrors } = useTranslation("errors");
  const navigate = useNavigate();
  const isOwner = role === "OWNER";

  const message = code === "PLAN_UPGRADE_REQUIRED"
    ? tErrors("planUpgradeRequired")
    : code === "REPORT_QUOTA_EXCEEDED"
      ? tErrors("reportQuotaExceeded")
      : tErrors("deviceLimitReached");

  return (
    <Alert variant="warning" className="mb-4">
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription>
        {isOwner ? (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => navigate("/plan")}>
            {tErrors("upgradeCta")}
          </Button>
        ) : (
          <p className="mt-2">{tErrors("askOwnerCta")}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 7: Rodar o teste (deve passar)**

Run: `bun test src/components/dashboard/PaywallBanner.test.tsx`
Expected: PASS

- [ ] **Step 8: Registrar as 5 chaves em `src/i18n/ui-inventory.test.ts`**

No array `requiredUiInventory`, adicionar (ajustar o número da linha pra bater com o arquivo real depois de escrito — a chamada `tErrors("planUpgradeRequired")` fica dentro do ternário, então a linha é a mesma pras 3 primeiras; `upgradeCta`/`askOwnerCta` ficam nas linhas do JSX):

```ts
{ source: "src/components/dashboard/PaywallBanner.tsx:20", key: "errors.planUpgradeRequired" },
{ source: "src/components/dashboard/PaywallBanner.tsx:22", key: "errors.reportQuotaExceeded" },
{ source: "src/components/dashboard/PaywallBanner.tsx:24", key: "errors.deviceLimitReached" },
{ source: "src/components/dashboard/PaywallBanner.tsx:32", key: "errors.upgradeCta" },
{ source: "src/components/dashboard/PaywallBanner.tsx:34", key: "errors.askOwnerCta" },
```

- [ ] **Step 9: Rodar os testes de i18n**

Run: `bun test src/i18n`
Expected: PASS — se `ui-inventory.test.ts` reclamar de linha errada, abrir `PaywallBanner.tsx`, conferir o número real de cada `tErrors(...)` e corrigir a entrada correspondente.

- [ ] **Step 10: Commit**

```bash
git add src/domain/models.ts src/components/dashboard/PaywallBanner.tsx src/components/dashboard/PaywallBanner.test.tsx src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(plan): add Establishment plan fields and reusable PaywallBanner"
```

---

## Task 2: `error-keys.ts` — `PRODUCT_LIMIT_REACHED`

**Files:**
- Modify: `src/i18n/error-keys.ts`, `src/i18n/error-keys.test.ts`
- Modify (i18n): `src/i18n/locales/*.json` (bloco `errors`)

**Interfaces:**
- Produces: `getErrorTranslationKey("createProduct", "PRODUCT_LIMIT_REACHED")` → `{ namespace: "errors", key: "productLimitReached" }`.

- [ ] **Step 1: Estender o teste existente**

Em `src/i18n/error-keys.test.ts`, adicionar:

```ts
test("mapeia PRODUCT_LIMIT_REACHED pro createProduct", () => {
  expect(getErrorTranslationKey("createProduct", "PRODUCT_LIMIT_REACHED")).toEqual({ namespace: "errors", key: "productLimitReached" });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `bun test src/i18n/error-keys.test.ts`
Expected: FAIL (cai no fallback `createProduct` genérico em vez do específico, já que `PRODUCT_LIMIT_REACHED` ainda não está mapeado)

- [ ] **Step 3: Adicionar a chave e o mapeamento em `error-keys.ts`**

No tipo `ErrorKey` (linha 28-50), adicionar `| "productLimitReached"`. No bloco `createProduct` de `errorKeyByContext` (linha 71 — hoje `createProduct: { namespace: "errors", key: "createProduct" }` no `fallbackByContext`, sem entrada em `errorKeyByContext` ainda), adicionar:

```ts
const errorKeyByContext: Partial<Record<ErrorContext, Record<string, ErrorTranslation>>> = {
  // ...blocos existentes sem mudança...
  createProduct: {
    PRODUCT_LIMIT_REACHED: { namespace: "errors", key: "productLimitReached" },
  },
};
```

- [ ] **Step 4: Adicionar `errors.productLimitReached` em todos os 6 locales**

`en.json`: `"productLimitReached": "Product limit reached on your current plan."`
`pt-BR.json`: `"productLimitReached": "Limite de produtos atingido no plano atual."`
`es.json`/`fr.json`/`zh.json`/`hi.json`: mesma chave, traduzida.

- [ ] **Step 5: Rodar o teste**

Run: `bun test src/i18n`
Expected: PASS. Nenhuma entrada nova em `ui-inventory.test.ts` é necessária — `ProductsPage.tsx` já chama `localizedError("createProduct", error)`, que satisfaz a detecção dinâmica do namespace `errors` (ver `hasTranslationUsage` em `ui-inventory.test.ts:462`).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/error-keys.ts src/i18n/error-keys.test.ts src/i18n/locales/*.json
git commit -m "feat(plan): map PRODUCT_LIMIT_REACHED error code for product creation"
```

---

## Task 3: `ChartsPage` — paywall no carregamento do relatório

**Files:**
- Modify: `src/pages/dashboard/ChartsPage.tsx` (estado + `fetchChartData`, em torno das linhas 195-217)
- Test: `src/pages/dashboard/ChartsPage.test.tsx` (criar, seguindo o padrão de `ProductsPage.test.tsx`)

**Interfaces:**
- Consumes: `PaywallBanner`, `getErrorCode` (de `@/services/api`).

- [ ] **Step 1: Escrever o teste**

```tsx
// src/pages/dashboard/ChartsPage.test.tsx
import { beforeEach, describe, expect, test, vi } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/test/i18n-provider"; // mesmo helper usado por ProductsPage.test.tsx
import api from "@/services/api";
import { replaceProperty } from "@/test/replace-property";
import ChartsPage from "./ChartsPage";

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ChartsPage />
      </I18nProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } });
});

describe("ChartsPage — paywall", () => {
  test("mostra PaywallBanner quando a API retorna PLAN_UPGRADE_REQUIRED", async () => {
    const getMock = vi.fn().mockRejectedValue({ response: { status: 403, data: { code: "PLAN_UPGRADE_REQUIRED" } } });
    replaceProperty(api, "get", getMock);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/only available on paid plans/i)).toBeTruthy();
    });
  });

  test("mostra PaywallBanner quando a API retorna REPORT_QUOTA_EXCEEDED", async () => {
    const getMock = vi.fn().mockRejectedValue({ response: { status: 403, data: { code: "REPORT_QUOTA_EXCEEDED" } } });
    replaceProperty(api, "get", getMock);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/monthly report limit/i)).toBeTruthy();
    });
  });
});
```

Nota: usar o helper de `I18nProvider`/`replaceProperty` real do repo (mesmo import que `ProductsPage.test.tsx` usa) — conferir o caminho exato desses helpers antes de escrever (`src/test/`), o snippet acima assume os nomes já vistos em `ProductsPage.test.tsx`.

- [ ] **Step 2: Rodar (deve falhar)**

Run: `bun test src/pages/dashboard/ChartsPage.test.tsx`
Expected: FAIL (hoje o catch só faz `toast.error(tErrors("generic"))`, não renderiza banner nenhum)

- [ ] **Step 3: Implementar o estado de paywall em `ChartsPage.tsx`**

Adicionar import: `import { PaywallBanner, type PaywallCode } from "@/components/dashboard/PaywallBanner"` e `import { getErrorCode } from "@/services/api"`.

Adicionar estado (perto dos outros `useState` do componente): `const [paywallCode, setPaywallCode] = useState<PaywallCode | null>(null)`.

Em `fetchChartData` (linha 195-217), trocar o catch:

```ts
const response = await api.get("/graficos", { params })
setPaywallCode(null)
// ...resto do try sem mudança (formatação de chartData/periodTotal)...
} catch (error) {
  const code = getErrorCode(error)
  if (code === "PLAN_UPGRADE_REQUIRED" || code === "REPORT_QUOTA_EXCEEDED") {
    setPaywallCode(code)
  } else {
    console.error("Error fetching chart data", error)
    toast.error(tErrors("generic"))
  }
  setChartData([])
} finally {
  setIsChartLoading(false)
}
```

No JSX de retorno do componente, logo depois do título/antes dos filtros, renderizar:

```tsx
{paywallCode && <PaywallBanner code={paywallCode} role={user?.role} />}
```

(usar a variável de `user` já obtida via `useAuth()` no topo do componente — linha 3 do arquivo já importa `useAuth`, conferir se o componente já desestrutura `user`; se não, adicionar `const { user } = useAuth()`).

- [ ] **Step 4: Rodar o teste**

Run: `bun test src/pages/dashboard/ChartsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/ChartsPage.tsx src/pages/dashboard/ChartsPage.test.tsx
git commit -m "feat(charts): show paywall banner on PLAN_UPGRADE_REQUIRED/REPORT_QUOTA_EXCEEDED"
```

---

## Task 4: `EmployeesPage` — paywall no carregamento (GERENTE + FREE)

**Files:**
- Modify: `src/pages/dashboard/EmployeesPage.tsx` (estado + `fetchEmployees`, linhas 126-146)
- Test: `src/pages/dashboard/EmployeesPage.test.tsx` (estender se já existir, senão criar seguindo o mesmo padrão da Task 3)

**Interfaces:**
- Consumes: `PaywallBanner`, `getErrorCode`.

- [ ] **Step 1: Escrever/estender o teste**

```tsx
test("mostra PaywallBanner quando GERENTE em plano FREE carrega a pagina", async () => {
  mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } });
  const getMock = vi.fn().mockRejectedValue({ response: { status: 403, data: { code: "PLAN_UPGRADE_REQUIRED" } } });
  replaceProperty(api, "get", getMock);

  renderPage();

  await waitFor(() => {
    expect(screen.getByText(/ask the owner/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `bun test src/pages/dashboard/EmployeesPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar**

Adicionar `import { PaywallBanner, type PaywallCode } from "@/components/dashboard/PaywallBanner"`, `import { getErrorCode } from "@/services/api"`, estado `const [paywallCode, setPaywallCode] = useState<PaywallCode | null>(null)`.

Em `fetchEmployees` (linha 126-146):

```ts
const fetchEmployees = async () => {
  try {
    const response = await api.get(`/usuarios?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`)
    setPaywallCode(null)
    const { data, total } = parseListResponse<Employee>(response)
    setEmployees(data)
    setTotalItems(total)
    if (total > 0) {
      setTotalPages(Math.ceil(total / limit))
      setHasMore(page < Math.ceil(total / limit))
    } else {
      setTotalPages(0)
      setHasMore(data.length === limit)
    }
  } catch (error) {
    const code = getErrorCode(error)
    if (code === "PLAN_UPGRADE_REQUIRED") {
      setPaywallCode(code)
    } else {
      console.error("Error fetching employees", error)
      toast.error(localizedError("loadEmployees", error))
    }
  }
}
```

No JSX, antes da tabela/formulário principal, adicionar `{paywallCode && <PaywallBanner code={paywallCode} role={user?.role} />}` e — se `paywallCode` estiver setado — não renderizar a tabela/botão "adicionar funcionário" (retornar cedo ou envolver o resto do conteúdo num `{!paywallCode && (...)}`).

- [ ] **Step 4: Rodar o teste**

Run: `bun test src/pages/dashboard/EmployeesPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Rodar a suíte inteira do front**

Run: `bun test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/dashboard/EmployeesPage.tsx src/pages/dashboard/EmployeesPage.test.tsx
git commit -m "feat(employees): show paywall banner for GERENTE on FREE plan"
```

---

## Task 5: `PlanSelectionPage` — 3 tiers, checkout genérico

**Files:**
- Modify: `src/pages/PlanSelectionPage.tsx` (inteiro)
- Test: `src/pages/PlanSelectionPage.test.tsx` (criar)

**Interfaces:**
- Consumes: `POST /payments/stripe/checkout` com body `{ tier: 'PAGO' | 'ENTERPRISE', interval: 'monthly' | 'annual' }` (API Task 7).

- [ ] **Step 1: Escrever o teste**

```tsx
// src/pages/PlanSelectionPage.test.tsx
import { beforeEach, describe, expect, test, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/test/i18n-provider";
import api from "@/services/api";
import { replaceProperty } from "@/test/replace-property";
import PlanSelectionPage from "./PlanSelectionPage";

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { establishment: { status: "PENDING_PAYMENT" } } });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <PlanSelectionPage />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("PlanSelectionPage", () => {
  test("mostra os 3 tiers com os precos novos", () => {
    renderPage();
    expect(screen.getByText(/R\$\s?0/)).toBeTruthy();
    expect(screen.getByText(/14,90/)).toBeTruthy();
    expect(screen.getByText(/79,90/)).toBeTruthy();
  });

  test("checkout do Pago chama /payments/stripe/checkout com tier PAGO", async () => {
    const postMock = vi.fn().mockResolvedValue({ data: { url: "https://checkout.stripe.com/x" } });
    replaceProperty(api, "post", postMock);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /assinar.*pago|subscribe.*pago/i }));

    expect(postMock).toHaveBeenCalledWith("/payments/stripe/checkout", { tier: "PAGO", interval: "monthly" });
  });

  test("checkout do Enterprise chama /payments/stripe/checkout com tier ENTERPRISE", async () => {
    const postMock = vi.fn().mockResolvedValue({ data: { url: "https://checkout.stripe.com/x" } });
    replaceProperty(api, "post", postMock);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /assinar.*enterprise|subscribe.*enterprise/i }));

    expect(postMock).toHaveBeenCalledWith("/payments/stripe/checkout", { tier: "ENTERPRISE", interval: "monthly" });
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `bun test src/pages/PlanSelectionPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Reescrever `PlanSelectionPage.tsx`**

Trocar o `handleCheckout` (linha 28-50) por uma versão genérica por tier:

```tsx
const handleCheckout = async (tier: 'PAGO' | 'ENTERPRISE', interval: 'monthly' | 'annual') => {
  setLoading(true);
  try {
    const response = await api.post('/payments/stripe/checkout', { tier, interval });
    if (response.data.url) {
      window.location.href = response.data.url;
    } else {
      console.error('Resposta inesperada:', response.data);
      toast.error(tErrors('paymentUrl'));
    }
  } catch (error: any) {
    console.error("Erro no checkout:", error);
    const translation = getErrorTranslationKey('payment', getErrorCode(error));
    toast.error(tErrors(translation.namespace === 'errors' ? translation.key : 'payment'));
  } finally {
    setLoading(false);
  }
};
```

Adicionar um 3º card (Enterprise) ao JSX existente, ao lado dos 2 cards de Free/Pago — reaproveitar exatamente o markup dos cards existentes (linha ~60-113 do arquivo original), com:
- Card **Free**: preço `formatCurrencyBRL(0)`, sem botão de checkout (é o tier padrão de quem nunca assinou) — só um selo "Plano atual" se `user?.establishment?.status !== 'ACTIVE'`.
- Card **Pago**: preço `formatCurrencyBRL(14.9)` mensal / `formatCurrencyBRL(60.91)` anual (texto igual ao já existente, só o valor mensal mudou de 6.90 pra 14.90), 2 botões (`onClick={() => handleCheckout('PAGO', 'monthly')}` / `onClick={() => handleCheckout('PAGO', 'annual')}`).
- Card **Enterprise**: preço `formatCurrencyBRL(79.9)` + texto "+ R$8,00/dispositivo extra acima de 15", 1 botão (`onClick={() => handleCheckout('ENTERPRISE', 'monthly')}`).

Manter o redirect de topo (linha 22-26) sem mudança nesta task — reavaliar esse gate faz parte do sub-item de auth da Fase 2 (fora do escopo deste plano de tiers).

- [ ] **Step 4: Adicionar as chaves de texto novas (namespace usado hoje pela página — conferir qual `useTranslation(...)` o arquivo já usa e reaproveitar)**

Adicionar (no mesmo namespace já usado pela página, texto real):
- Inglês: `"enterpriseTitle": "Enterprise"`, `"enterpriseDescription": "For establishments with high device volume."`, `"enterpriseExtraDevice": "+ R$8.00 per extra device above 15"`, `"subscribeEnterprise": "Subscribe to Enterprise"`.
- Português: `"enterpriseTitle": "Enterprise"`, `"enterpriseDescription": "Para estabelecimentos com alto volume de dispositivos."`, `"enterpriseExtraDevice": "+ R$8,00 por dispositivo extra acima de 15"`, `"subscribeEnterprise": "Assinar Enterprise"`.
- Traduzir as mesmas 4 chaves nos outros 4 locales.

Atualizar `src/i18n/ui-inventory.test.ts` com as entradas correspondentes (source:linha reais do arquivo final).

- [ ] **Step 5: Rodar o teste**

Run: `bun test src/pages/PlanSelectionPage.test.tsx src/i18n`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/PlanSelectionPage.tsx src/pages/PlanSelectionPage.test.tsx src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(plan): add Enterprise tier and generic tiered checkout"
```

---

## Task 6: `DevicesPage` — nova

**Files:**
- Create: `src/pages/dashboard/DevicesPage.tsx`, `src/pages/dashboard/DevicesPage.test.tsx`
- Modify: `src/App.tsx:60-77` (rota), `src/layouts/DashboardLayout.tsx:68-75` (nav item)

**Interfaces:**
- Consumes: `GET /dispositivos` (existente, `listDevices`), `DELETE /dispositivos/:id` (existente, agora restrito a `OWNER` pela API Task 4.1), `useConfirm` (`@/contexts/ConfirmContext`).

- [ ] **Step 1: Escrever o teste**

```tsx
// src/pages/dashboard/DevicesPage.test.tsx
import { beforeEach, describe, expect, test, vi } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/test/i18n-provider";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import api from "@/services/api";
import { replaceProperty } from "@/test/replace-property";
import DevicesPage from "./DevicesPage";

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

function renderPage() {
  return render(
    <I18nProvider>
      <ConfirmProvider>
        <DevicesPage />
      </ConfirmProvider>
    </I18nProvider>
  );
}

describe("DevicesPage", () => {
  test("lista dispositivos retornados pela API", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } });
    const getMock = vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: { os: "android" }, lastSeen: new Date().toISOString() }] });
    replaceProperty(api, "get", getMock);

    renderPage();

    await waitFor(() => expect(screen.getByText("dev-1")).toBeTruthy());
  });

  test("botao remover so aparece pro OWNER", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "MANAGER" } });
    const getMock = vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: {}, lastSeen: null }] });
    replaceProperty(api, "get", getMock);

    renderPage();

    await waitFor(() => expect(screen.getByText("dev-1")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /remove|remover/i })).toBeNull();
  });

  test("OWNER consegue remover apos confirmar", async () => {
    mockUseAuth.mockReturnValue({ user: { role: "OWNER" } });
    const getMock = vi.fn().mockResolvedValue({ data: [{ id: "dev-1", info: {}, lastSeen: null }] });
    const deleteMock = vi.fn().mockResolvedValue({ data: { message: "ok" } });
    replaceProperty(api, "get", getMock);
    replaceProperty(api, "delete", deleteMock);

    renderPage();
    await waitFor(() => expect(screen.getByText("dev-1")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: /remove|remover/i }));
    await userEvent.click(await screen.findByRole("button", { name: /confirm|confirmar/i }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("/dispositivos/dev-1"));
  });
});
```

- [ ] **Step 2: Rodar (deve falhar — página não existe)**

Run: `bun test src/pages/dashboard/DevicesPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar `DevicesPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import api from "@/services/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration";
import { formatDate } from "@/i18n/format";
import type { Device } from "@/domain/models";

export default function DevicesPage() {
  const { t } = useTranslation("settings");
  const { user } = useAuth();
  const confirm = useConfirm();
  const isOwner = user?.role === "OWNER";

  const [devices, setDevices] = useState<Device[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const showSkeleton = useMinLoadingDuration(isFetching);
  const [removingId, setRemovingId] = useState<string | number | null>(null);

  const fetchDevices = async () => {
    setIsFetching(true);
    try {
      const response = await api.get("/dispositivos");
      setDevices(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching devices", error);
      toast.error(t("devices.loadError"));
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRemove = async (device: Device) => {
    const confirmed = await confirm({
      description: t("devices.removeConfirmDescription"),
      confirmLabel: t("devices.removeConfirmButton"),
      destructive: true,
    });
    if (!confirmed) return;

    setRemovingId(device.id);
    try {
      await api.delete(`/dispositivos/${device.id}`);
      setDevices((current) => current.filter((d) => d.id !== device.id));
    } catch (error) {
      console.error("Error removing device", error);
      toast.error(t("devices.removeError"));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("devices.title")}</h1>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("devices.columns.id")}</TableHead>
              <TableHead>{t("devices.columns.lastSeen")}</TableHead>
              {isOwner && <TableHead className="text-right">{t("devices.columns.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  {isOwner && <TableCell />}
                </TableRow>
              ))
            ) : devices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOwner ? 3 : 2}>{t("devices.noResults")}</TableCell>
              </TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>{device.id}</TableCell>
                  <TableCell>{device.lastSeen ? formatDate(device.lastSeen) : t("devices.neverSeen")}</TableCell>
                  {isOwner && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={removingId === device.id}
                        onClick={() => handleRemove(device)}
                      >
                        {t("devices.removeButton")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Adicionar as chaves de i18n (`en.json`/`pt-BR.json`, namespace `settings`, bloco novo `devices`)**

```json
"devices": {
  "title": "Devices",
  "loadError": "Error loading devices.",
  "removeError": "Error removing device.",
  "removeButton": "Remove",
  "removeConfirmDescription": "Remove this device? It will need to register again to sync.",
  "removeConfirmButton": "Remove",
  "noResults": "No devices registered yet.",
  "neverSeen": "Never synced",
  "columns": { "id": "Device", "lastSeen": "Last sync", "actions": "Actions" }
}
```

Português:

```json
"devices": {
  "title": "Dispositivos",
  "loadError": "Erro ao carregar dispositivos.",
  "removeError": "Erro ao remover dispositivo.",
  "removeButton": "Remover",
  "removeConfirmDescription": "Remover este dispositivo? Ele vai precisar se registrar de novo pra sincronizar.",
  "removeConfirmButton": "Remover",
  "noResults": "Nenhum dispositivo registrado ainda.",
  "neverSeen": "Nunca sincronizou",
  "columns": { "id": "Dispositivo", "lastSeen": "Última sincronização", "actions": "Ações" }
}
```

Traduzir o mesmo bloco em `es.json`/`fr.json`/`zh.json`/`hi.json`. Registrar as entradas correspondentes em `ui-inventory.test.ts` (source = `DevicesPage.tsx:<linha real>`).

- [ ] **Step 5: Adicionar a rota em `src/App.tsx`**

Dentro do array `children` da rota `/dashboard` (linhas 60-77), adicionar:

```tsx
{ path: "devices", lazy: lazyPage(() => import('./pages/dashboard/DevicesPage')) },
```

- [ ] **Step 6: Adicionar o item de navegação em `src/layouts/DashboardLayout.tsx`**

No array `navItems` (linhas 68-75), adicionar entre `employees` e `charts`:

```tsx
import { Smartphone } from "lucide-react" // adicionar ao import existente de lucide-react
// ...
{ href: "/dashboard/devices", label: tNavigation("devices"), icon: Smartphone },
```

Adicionar `"devices": "Devices"` (`en.json`) / `"devices": "Dispositivos"` (`pt-BR.json`) no bloco `"navigation"`, + tradução nos outros 4 locales.

- [ ] **Step 7: Rodar os testes**

Run: `bun test src/pages/dashboard/DevicesPage.test.tsx src/i18n`
Expected: PASS

- [ ] **Step 8: Rodar a suíte inteira + `tsc` + build**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: tudo verde (o `build` confirma que a rota lazy carrega sem erro de import).

- [ ] **Step 9: Commit**

```bash
git add src/pages/dashboard/DevicesPage.tsx src/pages/dashboard/DevicesPage.test.tsx src/App.tsx src/layouts/DashboardLayout.tsx src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(devices): add dashboard devices page with owner-only removal"
```

---

## Task 7: `SettingsPage` — seção "Plano e uso"

**Files:**
- Modify: `src/pages/dashboard/SettingsPage.tsx` (fetch de estabelecimento em torno da linha 96, JSX antes da linha 417)
- Test: `src/pages/dashboard/SettingsPage.test.tsx` (estender)

**Interfaces:**
- Consumes: `GET /estabelecimentos` (agora retornando `plan`/`reportCount`/`printCountToday`/`_count.devices`, API Task 1/4/6).

- [ ] **Step 1: Estender o teste existente**

Adicionar ao `SettingsPage.test.tsx` (seguir o padrão de mock de `api.get('/estabelecimentos')` já usado no arquivo):

```tsx
test("mostra plano FREE e contadores de uso", async () => {
  const getMock = vi.fn().mockResolvedValue({
    data: {
      id: "estab-1",
      plan: "FREE",
      printCountToday: 12,
      reportCount: 2,
      _count: { devices: 2 },
    },
  });
  replaceProperty(api, "get", getMock);

  renderPage();

  await waitFor(() => expect(screen.getByText(/free/i)).toBeTruthy());
  expect(screen.getByText(/12.*30/)).toBeTruthy();
  expect(screen.getByText(/2.*5/)).toBeTruthy();
});

test("plano pago mostra ilimitado em vez de contador", async () => {
  const getMock = vi.fn().mockResolvedValue({
    data: { id: "estab-1", plan: "PAGO", printCountToday: 5, reportCount: 0, _count: { devices: 3 } },
  });
  replaceProperty(api, "get", getMock);

  renderPage();

  await waitFor(() => expect(screen.getByText(/unlimited|ilimitado/i)).toBeTruthy());
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `bun test src/pages/dashboard/SettingsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Estender `readEstablishmentResponse` e o `useEffect` de fetch**

Em `SettingsPage.tsx`, o tipo `EstablishmentResponse` (linha 38-41) e a função `readEstablishmentResponse` (linha 47-62) hoje só extraem `id`/`category`. Estender:

```ts
type EstablishmentResponse = {
  id: number | string | null;
  category: EstablishmentCategory | null;
  plan: EstablishmentPlan | null;
  printCountToday: number | null;
  reportCount: number | null;
  deviceCount: number | null;
};

function readEstablishmentResponse(data: unknown, fallbackId: number | string | null): EstablishmentResponse {
  const rawData = Array.isArray(data) ? data[0] : data;
  if (!rawData || typeof rawData !== "object") {
    return { id: fallbackId, category: null, plan: null, printCountToday: null, reportCount: null, deviceCount: null };
  }
  const rawEstablishment = rawData as Record<string, unknown>;
  const id = typeof rawEstablishment.id === "number" || typeof rawEstablishment.id === "string"
    ? rawEstablishment.id
    : fallbackId;
  const count = rawEstablishment._count as { devices?: number } | undefined;

  return {
    id,
    category: isEstablishmentCategory(rawEstablishment.category) ? rawEstablishment.category : null,
    plan: typeof rawEstablishment.plan === "string" ? rawEstablishment.plan as EstablishmentPlan : null,
    printCountToday: typeof rawEstablishment.printCountToday === "number" ? rawEstablishment.printCountToday : null,
    reportCount: typeof rawEstablishment.reportCount === "number" ? rawEstablishment.reportCount : null,
    deviceCount: typeof count?.devices === "number" ? count.devices : null,
  };
}
```

No corpo do componente, o `useEffect` que roda `readEstablishmentResponse` está condicionado a `canEditCategory` (linha 89: `if (!canEditCategory) return`) — **essa seção de plano precisa aparecer pra qualquer role**, então adicionar um segundo `useState`/efeito independente (não reaproveitar o efeito gated por `canEditCategory`):

```ts
const [planInfo, setPlanInfo] = useState<EstablishmentResponse | null>(null);

useEffect(() => {
  let cancelled = false;
  api.get('/estabelecimentos').then((response) => {
    if (cancelled) return;
    setPlanInfo(readEstablishmentResponse(response.data, fallbackEstablishmentId));
  }).catch((error) => {
    console.error('Error fetching plan info', error);
  });
  return () => { cancelled = true; };
}, [fallbackEstablishmentId]);
```

Import `EstablishmentPlan` de `@/domain/models`.

- [ ] **Step 4: Adicionar a seção no JSX (antes do placeholder `moreComingSoon`, linha 417)**

```tsx
{planInfo && (
  <div className="p-6 border rounded-lg bg-card space-y-3">
    <h2 className="text-xl font-semibold">{t('plan.title')}</h2>
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{t('plan.currentPlan')}</span>
      <span className="font-medium">{t(`plan.tiers.${planInfo.plan ?? 'FREE'}` as never)}</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{t('plan.printsToday')}</span>
      <span className="font-medium">
        {planInfo.plan === 'FREE' || planInfo.plan === null ? `${planInfo.printCountToday ?? 0}/30` : t('plan.unlimited')}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{t('plan.reportsThisMonth')}</span>
      <span className="font-medium">
        {planInfo.plan === 'FREE' || planInfo.plan === null ? `${planInfo.reportCount ?? 0}/5` : t('plan.unlimited')}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{t('plan.devices')}</span>
      <span className="font-medium">{planInfo.deviceCount ?? 0}</span>
    </div>
    {isOwner && (planInfo.plan === 'FREE' || planInfo.plan === null) && (
      <Button type="button" variant="outline" size="sm" onClick={() => navigate('/plan')}>
        {t('plan.upgradeButton')}
      </Button>
    )}
  </div>
)}
```

Adicionar `import { useNavigate } from "react-router-dom"` e `const navigate = useNavigate()` no topo do componente.

- [ ] **Step 5: Adicionar as chaves de i18n (`settings.plan.*`) em todos os 6 locales**

Inglês:
```json
"plan": {
  "title": "Plan & usage",
  "currentPlan": "Current plan",
  "tiers": { "FREE": "Free", "PAGO": "Pago", "PAGO_LEGADO": "Pago (legacy price)", "ENTERPRISE": "Enterprise" },
  "printsToday": "Prints today",
  "reportsThisMonth": "Reports this month",
  "unlimited": "Unlimited",
  "devices": "Devices in use",
  "upgradeButton": "Upgrade plan"
}
```

Português:
```json
"plan": {
  "title": "Plano e uso",
  "currentPlan": "Plano atual",
  "tiers": { "FREE": "Free", "PAGO": "Pago", "PAGO_LEGADO": "Pago (preço legado)", "ENTERPRISE": "Enterprise" },
  "printsToday": "Impressões hoje",
  "reportsThisMonth": "Relatórios este mês",
  "unlimited": "Ilimitado",
  "devices": "Dispositivos em uso",
  "upgradeButton": "Fazer upgrade"
}
```

Traduzir o mesmo bloco em `es.json`/`fr.json`/`zh.json`/`hi.json`. Registrar as entradas em `ui-inventory.test.ts` (source = `SettingsPage.tsx:<linha real>`).

- [ ] **Step 6: Rodar os testes**

Run: `bun test src/pages/dashboard/SettingsPage.test.tsx src/i18n`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/SettingsPage.tsx src/pages/dashboard/SettingsPage.test.tsx src/i18n/locales/*.json src/i18n/ui-inventory.test.ts
git commit -m "feat(settings): add plan and usage section"
```

---

## Task 8: Revisão final da branch

- [ ] **Step 1: Rodar a suíte completa + `tsc` + build**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: tudo verde.

- [ ] **Step 2: QA visual manual (navegador)**

Rodar `bun run dev`, logar como DONO e como GERENTE (2 estabelecimentos de teste, um FREE outro PAGO), conferir:
- `PlanSelectionPage` mostra os 3 cards com preços certos.
- `ChartsPage`/`EmployeesPage` mostram o `PaywallBanner` certo pro GERENTE em estabelecimento FREE.
- `DevicesPage` lista dispositivos, botão remover só aparece pro DONO.
- `SettingsPage` mostra a seção de plano/uso com os números certos.

- [ ] **Step 3: Atualizar `C:\RN\plano.md`**

Marcar que o plano de implementação do front está pronto/executado, junto com o da API.
