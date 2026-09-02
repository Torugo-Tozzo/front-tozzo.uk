# Fase 2 — Correções pós-QA visual (Front) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5 achados do QA visual manual da branch `feat/fase-2-tiers-precificacao` (rodada local 2026-09-02, ainda não mergeada em `dev`):
1. "Fazer upgrade" nas Configurações redireciona pra `/dashboard` (Pedidos) em vez de abrir a seleção de plano.
2. A landing page (`/`) mostra preços antigos (R$6,90, só 2 cards) — divergiu do `PlanSelectionPage` (Free/Pago R$14,90/Enterprise, 4 cards) — e o CTA de plano manda usuário não-autenticado pro login em vez de cadastro.
3. FUNCIONARIO vê o item "Relatórios" no menu — não deveria nem aparecer.
4. Nas Configurações, o card "Plano e uso" deveria vir logo abaixo de "Impressão" (hoje vem por último).
5. O card "Categoria do estabelecimento" nas Configurações não deveria existir como painel fixo — era pra ser um modal de primeiro acesso pro DONO. No lugar dele, um card "Editar Informações do Estabelecimento" (nome, telefone, CEP, endereço, CNPJ).

**Branch:** continuar direto em `feat/fase-2-tiers-precificacao` (worktree `C:\RN\front\front-tozzo.uk\.worktrees\feat\fase-2-tiers-precificacao`) — fixup na branch existente, não uma branch nova.

**Depende de:** o plano da API (`api/api-tozzo.uk/docs/superpowers/plans/2026-09-02-fase-2-qa-fixes-api.md`) — Task 5 deste plano usa os campos novos do `PUT /estabelecimentos` (Task 2 do plano da API) e Task 3 deste plano assume o 403 novo (`ROLE_FORBIDDEN`) de `/graficos` (Task 3 do plano da API) já existir no backend local pra validar ponta a ponta, mas o trabalho de front (esconder o item de menu, redirecionar a página) não trava nisso — pode ser feito e testado (mock/isolado) antes da API subir.

**Tech Stack:** Vite + React 18 + TS + Tailwind + Radix + `react-router` + `bun:test` + `@testing-library/react`.

## Global Constraints

- Sistema fechado de i18n com 2 testes de guarda (`src/i18n/resources.test.ts`, `src/i18n/ui-inventory.test.ts`) — rodar `bun test src/i18n` depois de qualquer alteração em locale/JSON.
  - `resources.test.ts` exige as mesmas chaves em **todos** os 6 locales (`en, pt-BR, es, fr, zh, hi`).
  - `ui-inventory.test.ts` mantém uma lista manual (`requiredUiInventory`) de `{ source: "arquivo:linha", key: "namespace.chave" }` — toda chave nova referenciada por `t("chave")` literal precisa de entrada aqui, com a linha exata do arquivo final (conferir depois de escrever o código, não adivinhar).
- Toda chave nova vai pro `en.json` e `pt-BR.json` com o texto real (fornecido abaixo quando aplicável). Pros outros 4 locales (`es`, `fr`, `zh`, `hi`), adicionar a mesma chave **traduzida de verdade** (não copiar en/pt-BR), seguindo o tom das strings vizinhas do mesmo arquivo.
- `bun test --parallel` roda a suíte inteira. `bunx tsc --noEmit` depois de cada task.

---

## Task 1: Corrigir redirecionamento de `/plan` (bug "Fazer upgrade" cai em Pedidos)

**Files:**
- Modify: `src/pages/PlanSelectionPage.tsx`
- Modify/Create: teste cobrindo o `useEffect` de redirecionamento (achar teste existente de `PlanSelectionPage` — ver `src/pages/public-auth-chrome.test.tsx`, que já renderiza `<PlanSelectionPage />` em `"/plan"` — estender lá ou criar `PlanSelectionPage.test.tsx` se não houver um describe dedicado)

**Causa raiz confirmada:** `PlanSelectionPage.tsx:22-26` redireciona pra `/dashboard` sempre que `status === 'ACTIVE'`, sem checar o plano. Um estabelecimento no plano FREE já é `ACTIVE` (não é "pendente de pagamento") — então clicar em "Fazer upgrade" no botão de Configurações (que faz `navigate('/plan')`) cai direto nessa guarda e volta pra `/dashboard` (rota índice = Pedidos), sem nunca mostrar os planos.

- [ ] **Step 1: Corrigir a condição do `useEffect`**

Trocar:

```ts
useEffect(() => {
  if (user?.establishment?.status === 'ACTIVE') {
    navigate('/dashboard');
  }
}, [user, navigate]);
```

por:

```ts
useEffect(() => {
  if (user?.establishment?.status === 'ACTIVE' && user?.establishment?.plan && user.establishment.plan !== 'FREE') {
    navigate('/dashboard');
  }
}, [user, navigate]);
```

Efeito: só quem já está num plano pago ativo (`PAGO`/`PAGO_LEGADO`/`ENTERPRISE`) é redirecionado pra fora da tela de seleção de plano. Quem está `ACTIVE` no plano `FREE` (ou sem plano ainda) vê a tela normalmente — inclusive vindo do botão "Fazer upgrade".

- [ ] **Step 2: Teste de regressão**

Casos a cobrir (mock de `useAuth`/contexto conforme o padrão já usado no arquivo de teste existente):
- `status: 'ACTIVE', plan: 'FREE'` → **não** redireciona, mostra os cards de plano.
- `status: 'ACTIVE', plan: 'PAGO'` → redireciona pra `/dashboard`.
- `status: 'PENDING_PAYMENT', plan: null` → **não** redireciona (fluxo de cadastro normal, comportamento já existente, não deve quebrar).

Run: `bun test src/pages --parallel`
Expected: todos passando, incluindo os já existentes de `PlanSelectionPage`/`public-auth-chrome`.

---

## Task 2: Componente único de pricing (landing page desatualizada + redirect pra cadastro)

> **Atualizado 2026-09-02 (feedback do usuário depois do plano original ter sido escrito):** a estrutura vira **3 cards** (Free / Pago / Enterprise), não 4 — o card "anual" deixa de ser separado e vira um toggle mensal/anual compartilhado, dentro dos cards Pago e Enterprise. Esta seção já reflete a versão corrigida; se a Task 2 já tiver sido implementada com 4 cards antes desta atualização chegar, ajustar em cima (não precisa desfazer e refazer do zero).

**Files:**
- Create: `src/components/PricingCards.tsx`, `src/components/PricingCards.test.tsx`
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/pages/PlanSelectionPage.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/i18n/locales/{en,pt-BR,es,fr,zh,hi}.json`

**Causa raiz confirmada:** `LandingPage.tsx` (seção `#pricing`, linhas ~247-319) tem sua própria cópia hardcoded dos cards de preço — `formatCurrencyBRL(6.9)` mensal / `formatCurrencyBRL(60.91)` anual, só 2 planos — que nunca foi atualizada quando `PlanSelectionPage.tsx` ganhou os tiers reais (Free R$0 / Pago R$14,90 mensal ou R$60,91 anual / Enterprise R$79,90+R$8/dispositivo extra) na Fase 2. As duas telas divergiram porque são duas implementações separadas da mesma informação. Corrigir extraindo um componente único, não só copiar os números novos pra landing (senão a mesma divergência volta na próxima mudança de preço).

Separadamente: `LandingPage.tsx:14-24` (`handleSubscribe`) manda usuário não-autenticado pra `/login` — deveria cair direto na aba de cadastro, já que ele clicou num plano querendo assinar, não entrar numa conta existente.

- [ ] **Step 1: Extrair `src/components/PricingCards.tsx`**

Componente com **3 cards** (Free / Pago / Enterprise), reaproveitando o conteúdo hoje em `PlanSelectionPage.tsx:62-159`. Um toggle único "Mensal"/"Anual" (`useState<'monthly' | 'annual'>`, dois botões ou um switch), acima ou ao lado dos cards, compartilhado pelos 2 cards pagos — não um toggle por card.

- Card Pago: preço muda com o toggle — mensal `formatCurrencyBRL(14.9)` (`plans.monthly`) ou anual `formatCurrencyBRL(60.91)` com a nota de equivalente mensal `formatCurrencyBRL(5.07)` (`plans.equivalentMonthly`), textos já existentes hoje.
- Card Enterprise: mesmo toggle, mas hoje a API **não tem preço anual pro Enterprise** (`TIER_PRICE_CENTS.ENTERPRISE.annual = null` em `api/api-tozzo.uk/modules/payments/payments.controller.ts` — checkout com `interval: 'annual'` retorna 400 `PAYMENT_INVALID_INTERVAL`). Conferir se isso mudou no plano da API (`2026-09-02-fase-2-qa-fixes-api.md`, executado em paralelo) antes de implementar; se continuar sem preço anual, o toggle no card Enterprise fica desabilitado/mostra só "Mensal" — não oferecer uma opção que a API rejeita.

Props:

```ts
type PricingCardsProps = {
  currentPlan?: EstablishmentPlan | null; // se informado, mostra "Plano atual" no card correspondente (comportamento hoje só em PlanSelectionPage)
  onSelectFree?: () => void;   // se ausente, card Free não mostra botão (caso da landing, que só tem CTA nos planos pagos)
  onSelectPago: (interval: 'monthly' | 'annual') => void;
  onSelectEnterprise: (interval: 'monthly' | 'annual') => void;
  loading?: boolean; // desabilita os botões durante checkout em andamento
};
```

Namespace de i18n: manter as mesmas chaves `common:plans.*` já usadas hoje em ambas as páginas (não criar chave nova pra isso — `plans.title`, `plans.monthly`, `plans.annual`, `plans.enterpriseTitle`, etc. já existem e já têm os 6 locales).

- [ ] **Step 2: `PlanSelectionPage.tsx` passa a usar `<PricingCards />`**

Substituir o grid inline (linhas ~62-159) por `<PricingCards currentPlan={user?.establishment?.plan} onSelectFree={undefined} onSelectPago={(interval) => handleCheckout('PAGO', interval)} onSelectEnterprise={(interval) => handleCheckout('ENTERPRISE', interval)} loading={loading} />`. Comportamento visual deve ficar equivalente ao atual (mesmos preços, badges) — o card "anual" separado vira o toggle dentro do card Pago, é troca de implementação/layout, não de preço.

- [ ] **Step 3: `LandingPage.tsx` passa a usar `<PricingCards />`**

Substituir a seção `#pricing` inteira (linhas ~247-319) por `<PricingCards currentPlan={isAuthenticated ? user?.establishment?.plan : null} onSelectPago={handleSubscribe} onSelectEnterprise={handleSubscribe} />` — sem `onSelectFree` (landing não vende "assinar o Free", é o padrão pra quem cadastra). Os CTAs continuam chamando a mesma `handleSubscribe` de hoje (que decide pra onde navegar — corrigida no próximo step); o toggle mensal/anual é só de exibição de preço na landing (usuário não-autenticado vai pro cadastro de qualquer forma, o `interval` escolhido não importa pra esse redirect).

Isso muda visualmente a landing: de 2 cards (mensal/anual só do Pago, preço R$6,90) pra 3 cards (Free/Pago com toggle/Enterprise, preços atuais) — é o comportamento pedido, não regressão.

- [ ] **Step 4: `handleSubscribe` manda pra cadastro, não pra login**

Em `LandingPage.tsx`, trocar:

```ts
} else {
  navigate('/login')
}
```

por:

```ts
} else {
  navigate('/login?tab=register')
}
```

- [ ] **Step 5: `LoginPage.tsx` lê `?tab=register` e abre a aba de cadastro**

Hoje o `<Tabs defaultValue="login" ...>` (linha ~134) sempre abre na aba de login. Tornar controlado:

```ts
import { useSearchParams } from "react-router-dom"
// ...
const [searchParams] = useSearchParams()
const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login'
const [activeTab, setActiveTab] = useState(initialTab)
// ...
<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
```

(mantém tudo o resto do componente igual — só troca `defaultValue` por `value`/`onValueChange` controlado a partir da query string.)

- [ ] **Step 6: Testes**

`PricingCards.test.tsx`: renderiza os 3 cards com os textos/preços corretos; toggle mensal/anual muda o preço exibido nos cards Pago e Enterprise (ou só no Pago, se Enterprise ficar sem anual — ver Step 1); clique em cada CTA chama o callback certo com o `interval` correto; `currentPlan` mostra "Plano atual" no card certo; sem `onSelectFree` o card Free não renderiza botão.

Atualizar/estender os testes existentes de `LandingPage` e `LoginPage` (achar os arquivos `*.test.tsx` correspondentes) cobrindo: landing mostra os 3 planos (não 2); clique em plano pago não-autenticado navega pra `/login?tab=register`; `LoginPage` com `?tab=register` na URL abre a aba de cadastro por padrão.

Run: `bun test src/components src/pages --parallel`
Expected: todos passando.

---

## Task 3: Esconder "Relatórios" pra FUNCIONARIO

**Files:**
- Modify: `src/layouts/DashboardLayout.tsx`
- Modify: `src/pages/dashboard/ChartsPage.tsx`
- Modify/Create: testes correspondentes (`DashboardLayout.test.tsx`, `ChartsPage.test.tsx` — achar os existentes e estender)

**Causa raiz confirmada:** `navItems` em `DashboardLayout.tsx:69-77` é uma lista estática, sem filtro por `role` — todo usuário autenticado vê todos os 7 itens do menu, incluindo "Relatórios" (`/dashboard/charts`). Não há nenhum bloqueio de role no front hoje pra essa rota (o único gate existente em `ChartsPage`/`/graficos` é de plano — paywall FREE —, não de role). Servidor ganha o bloqueio de role em paralelo (Task 3 do plano da API); esta task cobre a UI.

- [ ] **Step 1: Esconder o item de menu pra `role === 'EMPLOYEE'`**

Em `DashboardLayout.tsx`, trocar `const { logout } = useAuth()` (linha 33) por `const { logout, user } = useAuth()`, e filtrar `navItems` antes do `.map` (linha 84):

```ts
const navItems = [
  { href: "/dashboard/orders", label: tNavigation("orders"), icon: ClipboardList },
  { href: "/dashboard/sales", label: tNavigation("sales"), icon: LayoutDashboard },
  { href: "/dashboard/products", label: tNavigation("products"), icon: ShoppingBag },
  { href: "/dashboard/employees", label: tNavigation("employees"), icon: Users },
  { href: "/dashboard/devices", label: tNavigation("devices"), icon: Smartphone },
  { href: "/dashboard/charts", label: tNavigation("reports"), icon: BarChart3 },
  { href: "/dashboard/settings", label: tNavigation("settings"), icon: Settings },
].filter((item) => item.href !== "/dashboard/charts" || user?.role !== "EMPLOYEE")
```

- [ ] **Step 2: Bloquear acesso direto por URL em `ChartsPage.tsx`**

No topo do componente (depois de `const { user } = useAuth()`, linha 110), redirecionar quem digitar `/dashboard/charts` direto na URL sendo FUNCIONARIO:

```ts
const navigate = useNavigate() // se ainda não importado/instanciado no arquivo
useEffect(() => {
  if (user?.role === 'EMPLOYEE') {
    navigate('/dashboard', { replace: true })
  }
}, [user, navigate])
```

Se o componente já tiver um early-return de loading, garantir que esse redirect roda antes de montar o conteúdo real da página (evitar flash do conteúdo antes do redirect).

- [ ] **Step 3: Testes**

`DashboardLayout.test.tsx`: com `user.role === 'EMPLOYEE'`, o link "Relatórios" não está no DOM; com `OWNER`/`MANAGER`, continua aparecendo.

`ChartsPage.test.tsx`: renderizar com `user.role === 'EMPLOYEE'` e confirmar que navega pra `/dashboard` (mock de `useNavigate`) em vez de mostrar o conteúdo da página.

Run: `bun test src/layouts src/pages/dashboard --parallel`
Expected: todos passando.

---

## Task 4: Reordenar "Plano e uso" pra logo abaixo de "Impressão"

**Files:**
- Modify: `src/pages/dashboard/SettingsPage.tsx`

**Contexto:** ordem atual dos cards em `SettingsPage.tsx`: Aparência → Idioma → Impressão → Categoria do estabelecimento (removido na Task 5) → Dados e privacidade → Plano e uso → "Mais em breve". Pedido: "Plano e uso" logo depois de "Impressão".

- [ ] **Step 1: Mover o bloco JSX**

O card de "Plano e uso" é o `{planInfo && (...)}` que hoje está nas linhas ~439-448 (logo antes do `<div className="p-10 border-2 border-dashed ...">` final). Mover esse bloco inteiro pra logo depois do card de Impressão (hoje linhas 273-295) e antes do que passa a ser o card de "Editar Informações do Estabelecimento" (Task 5). Não alterar o conteúdo do bloco, só a posição.

Nova ordem esperada: Aparência → Idioma → Impressão → **Plano e uso** → Editar Informações do Estabelecimento → Dados e privacidade → "Mais em breve".

Sem teste novo necessário (é reposicionamento de DOM, não mudança de comportamento) — só confirmar visualmente depois (`bun run dev`, Configurações, ordem dos cards) e rodar a suíte existente de `SettingsPage.test.tsx` pra garantir que nada que dependia de ordem/estrutura quebrou.

---

## Task 5: Modal de categoria no primeiro acesso + card "Editar Informações do Estabelecimento"

**Files:**
- Create: `src/components/dashboard/EstablishmentOnboardingModal.tsx`, `src/components/dashboard/EstablishmentOnboardingModal.test.tsx`
- Modify: `src/layouts/DashboardLayout.tsx`
- Modify: `src/domain/models.ts`
- Modify: `src/pages/dashboard/SettingsPage.tsx`
- Modify: `src/i18n/locales/{en,pt-BR,es,fr,zh,hi}.json`

**Contexto/causa raiz:** o card "Categoria do estabelecimento" em Configurações (`SettingsPage.tsx:297-388`, gated por `canEditCategory = role OWNER||MANAGER`) devia ter sido um modal de primeiro acesso pro DONO, não um painel permanente — isso nunca foi corrigido quando a feature de categoria foi implementada. O campo `establishment.category` já é opcional (`EstablishmentCategory?` no Prisma) — dá pra usar `category == null` como o próprio sinal de "ainda não completou o primeiro acesso", sem precisar de coluna nova. `AuthContext` já busca o estabelecimento completo (`GET /estabelecimentos`, mesmo endpoint que `SettingsPage` usa) no login/refresh — só falta o campo `category` estar tipado em `Establishment` (`src/domain/models.ts`) pra `DashboardLayout` conseguir ler `user.establishment.category` sem um fetch extra.

- [ ] **Step 1: Tipar `category` em `Establishment`**

Em `src/domain/models.ts`, importar `EstablishmentCategory` de `@/lib/categorySeeds` e adicionar ao interface:

```ts
import type { EstablishmentCategory } from "@/lib/categorySeeds"
// ...
export interface Establishment {
  id: number | string;
  tradeName: string;
  status: EstablishmentStatus;
  plan?: EstablishmentPlan;
  category?: EstablishmentCategory | null;
  extraDevices?: number;
  reportCount?: number;
  reportCountResetAt?: string;
  printCountToday?: number;
}
```

- [ ] **Step 2: Extrair `EstablishmentOnboardingModal.tsx`**

Novo componente `Dialog` (usar os mesmos `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` já importados em `SettingsPage.tsx`) contendo **exatamente a lógica e o JSX que hoje estão em `SettingsPage.tsx`** pro seletor de categoria + tipos de produto sugeridos:
- Estado: `category`, `suggestedTypes`, `isSavingCategory`, `isAddingTypes` (linhas ~98-105 do arquivo atual, só a parte de categoria — não `planInfo`/delete-account/etc, que ficam em `SettingsPage`).
- Handlers: `handleCategoryChange`, `handleSaveCategory`, `handleSuggestedTypeChange`, `handleAddSuggestedTypes` (linhas ~145-190 do arquivo atual).
- JSX: o conteúdo do card de categoria (linhas ~297-388 do arquivo atual), adaptado pra caber dentro de um `<DialogContent>` em vez de um `<div className="p-6 border rounded-lg ...">`.

Props:

```ts
type EstablishmentOnboardingModalProps = {
  open: boolean;
  establishmentId: number | string | null;
  onSaved: () => void; // chamado depois de handleSaveCategory ter sucesso
};
```

Mesmas chaves de i18n já existentes (`settings:category.*`) — não precisa de chave nova pra esse componente.

Reusar as mesmas regras de hoje: `handleSaveCategory` chama `api.patch('/establishments/{id}', { category })`; `handleAddSuggestedTypes` só roda se `isOwner` (dentro do modal, como só o DONO vê o modal — Step 3 — pode simplificar essa checagem, mas manter o comportamento de não permitir tipo vazio).

O modal **não tem botão de fechar/cancelar** — sai da tela só depois de `handleSaveCategory` ter sucesso (chama `onSaved()`, que no `DashboardLayout` vai disparar `refreshUserProfile()` e isso atualiza `user.establishment.category`, fazendo a condição de abrir o modal — Step 3 — ficar falsa). Isso implementa "só aparece no primeiro acesso": ele reaparece em qualquer navegação subsequente enquanto `category` continuar `null`, e some assim que o dono salvar uma categoria.

- [ ] **Step 3: Montar o modal em `DashboardLayout.tsx`**

Adicionar `import { EstablishmentOnboardingModal } from "@/components/dashboard/EstablishmentOnboardingModal"`. Já existe (ou é preciso adicionar, conforme Task 3 Step 1) `const { logout, user, refreshUserProfile } = useAuth()` — confirmar que `refreshUserProfile` está exposto por `useAuth()` (já existe em `AuthContext.tsx`, só puxar no destructuring).

No JSX do layout (dentro do wrapper principal, fora da `<Suspense>`/`<Outlet>` das rotas — só precisa montar uma vez por sessão de dashboard):

```tsx
{user?.role === 'OWNER' && user.establishment?.category == null && (
  <EstablishmentOnboardingModal
    open
    establishmentId={user.establishmentId ?? user.establishment?.id ?? null}
    onSaved={() => { void refreshUserProfile() }}
  />
)}
```

- [ ] **Step 4: Substituir o card de categoria em `SettingsPage.tsx` por "Editar Informações do Estabelecimento"**

Remover o bloco `{canEditCategory && (...)}` (linhas ~297-388) inteiro, junto com o estado/handlers que só serviam pra ele (`category`, `suggestedTypes`, `isLoadingCategory`, `isSavingCategory`, `isAddingTypes`, `canEditCategory`, `handleCategoryChange`, `handleSaveCategory`, `handleSuggestedTypeChange`, `handleAddSuggestedTypes`, e os imports que ficarem sem uso: `Tags` de `lucide-react`, `CATEGORY_SEEDS`/`ESTABLISHMENT_CATEGORIES`/`EstablishmentCategory` de `@/lib/categorySeeds` se não sobrar nenhum outro uso no arquivo).

No lugar, um novo card **visível só pra `isOwner`** (mesmo gate que "Dados e privacidade" já usa hoje), com formulário de:

| Campo | Body key (`PUT /estabelecimentos`) | Tipo de input |
|---|---|---|
| Nome do estabelecimento | `tradeName` | text |
| Telefone | `phone` | text |
| CEP | `zipCode` | text |
| Rua/Logradouro | `addressStreet` | text |
| Número | `addressNumber` | text |
| Complemento | `addressComplement` | text (opcional, placeholder tipo "Apto, sala, etc.") |
| Bairro | `addressNeighborhood` | text |
| Cidade | `addressCity` | text |
| Estado (UF) | `addressState` | text, `maxLength={2}` |
| CNPJ | `cnpj` | text |

Estado local do form inicializado a partir do `GET /estabelecimentos` que `SettingsPage` já faz (estender `EstablishmentResponse`/`readEstablishmentResponse`, hoje em `SettingsPage.tsx:40-83`, pra incluir esses 9 campos + o `tradeName` que já vem no payload mas hoje não é lido nesse type local). Botão "Salvar" chama `api.put('/estabelecimentos', { tradeName, phone, zipCode, addressStreet, addressNumber, addressComplement, addressNeighborhood, addressCity, addressState, cnpj })` só com os campos que o usuário efetivamente editou (ou manda todos sempre — mais simples; a API já trata `undefined` vs valor vazio conforme o plano da API). Toast de sucesso/erro seguindo o mesmo padrão dos outros handlers do arquivo (`toast.success`/`toast.error`).

- [ ] **Step 5: Chaves de i18n novas**

Namespace `settings`, em `en.json`/`pt-BR.json` (mesmo bloco onde hoje está `"category"`, pode substituir por este bloco novo já que `category.*` continua em uso — agora pelo `EstablishmentOnboardingModal` — não remover essas chaves, só adicionar as novas ao lado):

`pt-BR.json`, dentro de `"settings"`:
```json
"establishmentInfo": {
  "title": "Editar Informações do Estabelecimento",
  "description": "Mantenha os dados do seu estabelecimento atualizados.",
  "tradeName": "Nome do estabelecimento",
  "phone": "Telefone",
  "zipCode": "CEP",
  "addressStreet": "Rua/Logradouro",
  "addressNumber": "Número",
  "addressComplement": "Complemento",
  "addressNeighborhood": "Bairro",
  "addressCity": "Cidade",
  "addressState": "Estado (UF)",
  "cnpj": "CNPJ",
  "save": "Salvar informações",
  "saving": "Salvando...",
  "saved": "Informações do estabelecimento atualizadas.",
  "saveError": "Não foi possível salvar as informações. Tente novamente."
}
```

`en.json`, mesmo bloco (tradução real, não copiar português):
```json
"establishmentInfo": {
  "title": "Edit Establishment Information",
  "description": "Keep your establishment's details up to date.",
  "tradeName": "Establishment name",
  "phone": "Phone",
  "zipCode": "ZIP code",
  "addressStreet": "Street",
  "addressNumber": "Number",
  "addressComplement": "Complement",
  "addressNeighborhood": "Neighborhood",
  "addressCity": "City",
  "addressState": "State",
  "cnpj": "Tax ID (CNPJ)",
  "save": "Save information",
  "saving": "Saving...",
  "saved": "Establishment information updated.",
  "saveError": "Could not save the information. Try again."
}
```

Adicionar o mesmo bloco (14 chaves), traduzido de verdade, em `es.json`, `fr.json`, `zh.json`, `hi.json` — seguir o tom das strings vizinhas de cada arquivo. Depois de escrever o código, rodar `bun test src/i18n` e adicionar cada `t("settings.establishmentInfo.xxx")` literal novo em `requiredUiInventory` (`ui-inventory.test.ts`) com o arquivo:linha exato.

- [ ] **Step 6: Testes**

`EstablishmentOnboardingModal.test.tsx`: abre quando `open=true`; seleção de categoria atualiza os tipos sugeridos; salvar chama `PATCH /establishments/:id` e depois `onSaved`.

Estender `SettingsPage.test.tsx`: card "Editar Informações do Estabelecimento" só aparece pra `isOwner`; preenche e salva o form chama `PUT /estabelecimentos` com os campos certos; card de categoria antigo não existe mais nesse arquivo.

Estender `DashboardLayout.test.tsx` (ou criar caso novo): com `user.role === 'OWNER'` e `establishment.category === null`, o modal de onboarding está aberto; com `category` preenchida, não está; com `role !== 'OWNER'`, nunca abre independente de `category`.

Run: `bun test src/components src/layouts src/pages/dashboard --parallel`
Expected: todos passando.

---

## Final steps (depois das 5 tasks)

- [ ] Rodar a suíte inteira: `bun test --parallel` — 0 fail.
- [ ] `bun test src/i18n` — guardas de i18n passando (todas as chaves novas em todos os 6 locales + inventário atualizado).
- [ ] `bunx tsc --noEmit` — sem erro.
- [ ] `bun run build` — build limpo.
- [ ] QA visual manual (`bun run dev`, API local rodando): confirmar os 5 comportamentos do Goal — upgrade abre seleção de plano, landing com preços atuais + CTA de cadastro, FUNCIONARIO sem "Relatórios" no menu, ordem "Plano e uso" logo após "Impressão", modal de categoria só no primeiro acesso + card novo de informações do estabelecimento salvando de verdade contra a API local (que precisa ter rodado o plano da API antes, pros campos novos existirem).
- [ ] Revisão final de branch (`/code-review high` ou equivalente) cobrindo o diff das 5 tasks juntas antes de considerar a branch pronta pra novo QA visual do usuário.
