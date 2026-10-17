# Plano: front em SolidJS no Cloudflare Workers (mesmo visual)

Data: 2026-10-10. Branch: `dev`. Regras de código: [`CONVENTIONS.md`](../../../CONVENTIONS.md) (índice em [`AGENTS.md`](../../../AGENTS.md)).
Plano da API (contrato `/v1` em Go): `api-tozzo.uk/docs/superpowers/plans/2026-10-10-migracao-go.md` e `api-tozzo.uk/docs/superpowers/plans/migracao-go/`.

## Regra principal

**Só o framework muda. O visual e o padrão de UI ficam iguais.** Isso inclui cores, tokens, espaçamentos, tipografia, componentes, ícones, textos, layout responsivo, tema claro e escuro, estados vazios, toasts e diálogos.

Única exceção: **gráficos e tabelas podem ter diferenças pequenas** que venham da troca de biblioteca, como animação, posição exata do tooltip ou detalhes de ordenação. Mesmo assim, as cores, as fontes, o container (card), os títulos e as legendas continuam iguais.

Para garantir isso há uma verificação objetiva: **testes de regressão visual** (seção S0). Uma página só está migrada quando o screenshot em Solid bate com o do React.

## Decisões

| Tema | Decisão |
|---|---|
| Onde | Pasta nova **`web/`** neste repo, com `package.json` próprio. O React continua na raiz, intocado, até o corte (S8). React e Solid não se misturam no mesmo app. |
| API | O Solid fala **só com o `/v1` da API Go**. O React continua falando com o Bun. |
| Hospedagem | **Cloudflare Workers** (só assets estáticos), projeto `tozzo-web` com raiz `web/`. A VM deixa de servir o front no corte. Era Pages; trocado pelo usuário em 2026-10-14, porque a Cloudflare marcou o Pages como legado. |
| SSR | Não. SPA estática. |
| Tailwind | **Manter a versão 3.4 e o mesmo `tailwind.config.js` e `index.css`.** Não migrar para Tailwind 4 nesta etapa, para o visual não mudar. |

## Mapa de bibliotecas (React → Solid)

| Uso | Hoje (React) | Solid |
|---|---|---|
| Framework | react 18 | `solid-js` |
| Rotas | react-router 7 (lazy) | `@solidjs/router` com `lazy()` |
| Dados remotos | axios + estado manual | `@tanstack/solid-query` + `openapi-fetch` (tipos gerados com `openapi-typescript` a partir do `/v1/openapi.yaml`) |
| Tabelas | `components/ui/table.tsx` | o **mesmo** componente portado + `@tanstack/solid-table` só para a lógica (ordenação, paginação, seleção); `@tanstack/solid-virtual` em listas com mais de 200 linhas |
| Gráficos | recharts | `echarts` (import modular de `echarts/core`, só os gráficos usados) |
| Primitivas acessíveis | `@radix-ui/*` (dialog, dropdown, select, tabs, label, slot) | `@kobalte/core` (ver "Atributos de estado") |
| Variantes de classe | class-variance-authority, clsx, tailwind-merge | as **mesmas** (não dependem de framework) |
| Ícones | lucide-react | `lucide-solid` (mesmos nomes) |
| Toasts | sonner | `solid-sonner` (mesma posição `top-right`, `richColors`, `closeButton`) |
| Arrastar e soltar (cozinha) | @dnd-kit | `@thisbeyond/solid-dnd`, mantendo a alternativa por teclado e as instruções traduzidas |
| i18n | i18next + react-i18next | **i18next** (o mesmo) + um binding Solid pequeno (ver S1) |
| SSE | @microsoft/fetch-event-source | `EventSource` nativo (o `/v1` usa ticket na URL, sem header) |
| Testes | bun test + Testing Library + happy-dom; Playwright | Vitest + `@solidjs/testing-library` + happy-dom; Playwright |

## Atributos de estado (Radix → Kobalte)

Os componentes de `ui/` usam classes Tailwind ligadas aos atributos do Radix, por exemplo `data-[state=open]:animate-in` e `data-[state=checked]`. O Kobalte usa outros atributos, por exemplo `data-expanded`, `data-closed`, `data-selected` e `data-highlighted`.

- Ao portar cada componente, **trocar o seletor e manter o efeito visual**. Por exemplo: `data-[state=open]:animate-in` vira `data-[expanded]:animate-in`, e `data-[state=closed]:animate-out` vira `data-[closed]:animate-out`.
- Conferir cada atributo na documentação do Kobalte da versão instalada.
- As keyframes `accordion-*` do `tailwind.config.js` usam `--radix-accordion-content-height`. O equivalente do Kobalte é `--kb-accordion-content-height` (conferir). Ajustar no `tailwind.config.js` **do `web/`**, sem mudar a aparência.

## Fases

Cada fase termina com:
- testes unitários e visuais passando;
- `bun run build` sem erro;
- deploy de preview no Worker;
- registro no fim deste arquivo.

### S0 — Base de regressão visual (no React, antes de tudo)

1. **Massa de dados canônica**: `e2e/visual/data/canonical.ts`, com um estabelecimento, usuários de cada papel, 30 produtos, pedidos em todos os estados, 200 vendas, serviços e ordens em todos os estados, e agenda. Datas fixas.
2. **Dois serializadores** a partir dela:
   - `toLegacyApi()`: formato do Bun atual, com rotas e campos em português onde o `legacyWire` exige;
   - `toV1()`: formato do `/v1`.

   Um teste confere que os dois representam os mesmos dados (contagens, totais, nomes).
3. **Mocks de rede com `page.route`** para todas as chamadas, auth incluída (o React usa GoTrue: simular o `token` e o `user`). Relógio fixo (`page.clock.setFixedTime`), fontes carregadas (`document.fonts.ready`) e animações desligadas: CSS injetado com `*{animation:none!important;transition:none!important}`.
4. **Screenshots de cada rota e de cada estado relevante**:
   - lista cheia, vazia, carregando e com erro;
   - diálogos abertos: produto, pedido, confirmação, seleção de produto;
   - menus abertos;
   - abas.

   Em **3 tamanhos** (`1440×900`, `768×1024`, `390×844`) e **2 temas** (claro e escuro).
5. Gravar em `e2e/visual/__screenshots__/react/`. Script `bun run test:visual:baseline`.

**Rotas cobertas:**
- públicas: `/`, `/login`, `/forgot-password`, `/reset-password`, `/privacidade`, `/termos`;
- pagamento: `/plan`, `/payment/success`;
- dashboard: `/dashboard`, `orders`, `sales`, `products`, `services`, `estimates`, `estimates/:id`, `service-orders`, `service-orders/:id`, `kitchen`, `deliveries`, `employees`, `devices`, `schedule`, `charts`, `settings`;
- 404.

Conferir em `src/App.tsx` a lista completa na hora de fazer.

**Pronto quando:** o baseline roda duas vezes seguidas sem diferença nenhuma (determinístico).

### S1 — Esqueleto do `web/`

- Vite + `vite-plugin-solid`, TypeScript estrito, alias `@/` igual ao do React.
- **Copiar exatamente**: `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `public/` (logo, favicon), fontes e o `lib/utils.ts` (`cn`).
- Tema claro e escuro: porta do `theme-provider` com a **mesma chave** `vite-ui-theme` no `localStorage` e a mesma lógica de `system`.
- i18n:
  - copiar `src/i18n/{config,locale,format,labels,resources}.ts` e os `locales/*.json` **sem mudar chaves**;
  - binding Solid em `web/src/i18n/solid.ts`: um signal com o idioma atual; `t()` lê o signal para ser reativo; `I18nProvider`;
  - portar `error-keys.ts` para os `code` do `/v1` (ver `httpx/codes.go` e o `CONVENTIONS.md` da API), mantendo as mesmas mensagens;
  - portar o `ui-inventory.test.ts` e o `i18n:check`.
- **Primitivas `ui/`**: portar **todas**, com as mesmas classes e variantes CVA:
  - `alert`, `button`, `card`, `dialog`, `dropdown-menu`, `icon-button`, `input`, `label`, `select`, `skeleton`, `status-select`, `table`, `tabs`;
  - mais `Badge` e `EmptyState`, se já existirem no React na época (ver `docs/design-system-audit.md`).
  - Uma página interna `/__ui` (só em dev) mostra todas as variantes; ela também tem screenshot no React, numa página equivalente criada na S0.
- **Cliente da API**:
  - `bun run api:types` gera `src/api/schema.d.ts` a partir de `https://dev-api.tozzo.uk/v1/openapi.yaml` (commitado);
  - `openapi-fetch` com middleware que coloca o access token e, no `401` `INVALID_TOKEN`, faz **um** refresh (single-flight) via `POST /v1/auth/refresh` com `credentials: 'include'` e repete a requisição.
- TanStack Query com `staleTime` 30 s, `retry` só em erro de rede e 5xx, e cancelamento ao sair da página.
- **Tempo real** (`src/realtime.ts`):
  1. `POST /v1/events/ticket`, depois `new EventSource(url + '?ticket=…')`;
  2. no erro, fecha e reconecta com backoff de 1, 2, 5, 10 e 30 s, sempre com ticket novo;
  3. evento → `queryClient.invalidateQueries`:
     - `order.changed` → `orders`, `kitchen`, `delivery`;
     - `sale.changed` → `sales`, `reports`;
     - `service.changed` → `services`;
     - `service-order.changed` → `service-orders`, `sales`;
  4. pausa com a aba oculta por mais de 5 minutos e retoma ao voltar.
- **Layouts**: `MainLayout`, `DashboardLayout` (sidebar, menu mobile, navegação por módulos de `businessPreferences`), `ProtectedRoute` e `BusinessModuleRoute`, com o mesmo comportamento e visual.
- **Pronto quando:** `/__ui` e o shell do dashboard (sem conteúdo) batem com o baseline.

### S2 — Autenticação (API fase 2)

- Páginas:
  - `/login`;
  - `/register` (hoje o cadastro fica dentro do `LoginPage`: manter o mesmo visual e fluxo);
  - `/verify-email` (nova);
  - `/forgot-password`, `/reset-password`;
  - `/confirm-email` (nova).
- As páginas novas seguem o padrão visual de `ForgotPasswordPage`.
- Google: botão do Google Identity Services, que devolve o `idToken` → `POST /v1/auth/google` com `client: "web"`. Script `https://accounts.google.com/gsi/client` carregado só nessas páginas.
- Sessão:
  - access token só em memória;
  - ao abrir o app, chama `POST /v1/auth/refresh` (cookie) para recuperar a sessão;
  - logout chama `/v1/auth/logout`.
- Portar os testes de `LoginPage.test.tsx`, `ForgotPasswordPage.test.tsx`, `ResetPasswordPage.test.tsx` e `AuthContext.test.tsx`, adaptando para o `/v1`.

### S3 — Cadastro (API fase 3)

`settings` (`SettingsPage`, `BusinessPreferencesPanel`, `EstablishmentOnboardingModal`), `employees`, `products` (`ProductsPage`, `ProductSelectionModal`), `devices` e `PaywallBanner`. Upload de imagem com URL pré-assinada (`POST /v1/uploads` → `PUT` direto no R2 → `PATCH` do recurso).

### S4 — Operação (API fase 4)

`orders` (`PedidosTab`), `sales` (`VendasTab`, `FiltersBar`, `Pagination`), `kitchen` (arrastar e soltar), `deliveries` e recibo (`components/receipt`, impressão pelo navegador igual à de hoje).
- Listas grandes (vendas) com cursor do `/v1`; a paginação **visual** continua a mesma.
- O resumo do filtro (fechamento) vem de `summary`.

### S5 — Serviços e agenda (API fase 5)

`services`, `estimates`, `estimates/:id` (`ServiceQuoteEditor`), `service-orders`, `service-orders/:id`, `schedule` (`SchedulePage`, `ShiftGroupDialog`, `BusinessHoursPanel`, `calendarEvents.ts`). Portar os e2e de `e2e/service-*.e2e.ts` e `schedule-shifts.e2e.ts`.

### S6 — Relatórios (API fase 6)

`charts` (`ChartsPage`) com ECharts:
- **tema ECharts montado a partir dos tokens CSS** (lê `--foreground`, `--muted-foreground`, `--border` e `--card` com `getComputedStyle`) e refeito quando o tema muda;
- **a mesma paleta** de cores das séries que o `ChartsPage` usa hoje (copiar os hex);
- a mesma fonte; o tooltip no estilo do card (borda, raio, sombra);
- import dinâmico do ECharts só nesta página;
- exportação: `POST /v1/reports/exports`, depois polling de `GET …/{id}` a cada 2 s, até 2 minutos, e o download pela `downloadUrl`;
- teste visual com **máscara** na área do gráfico (`mask` do Playwright), mais um screenshot só do gráfico revisado à mão pelo usuário e registrado aqui.

### S7 — Plano, pagamento e páginas públicas (API fase 7)

`/plan` (`PlanSelectionPage`, `PricingCards`), `/payment/success`, `/` (`LandingPage`, `Navbar`, `Footer`), `/privacidade`, `/termos` e 404.

### S8 — Corte

Junto com a fase 10 da API.

1. ✅ (2026-10-15) O Worker `tozzo-web` passa a responder em `dev.tozzo.uk`.
2. ✅ (2026-10-15, `b8da753`) O workflow `deploy.yml` (VM) para de publicar o front da `dev`. Na `main`, **nada muda**: a produção continua no React com o Bun.
3. **Pendente, depois da S7** (o React da raiz é a referência das S4 a S7): num commit só na `dev`:
   - apagar o React da raiz (`src/`, `index.html`, `vite.config.ts`, `Dockerfile`, `nginx.conf` e os configs da raiz);
   - mover `web/*` para a raiz;
   - atualizar o README, o `AGENTS.md`, o `ARCHITECTURE.md` e o `CONVENTIONS.md` (tirar o React).

## Cloudflare Workers

O usuário cria o Worker no painel (Workers & Pages → Create → importar repositório), porque precisa de acesso à conta:
- **projeto** `tozzo-web`, ligado ao GitHub `Torugo-Tozzo/front-tozzo.uk`;
- **caminho** `web`; build `bun install --frozen-lockfile && bun run build`; deploy `npx wrangler deploy`; preview `npx wrangler versions upload`;
- **variáveis de build** (não de runtime): `BUN_VERSION` (a usada localmente) e `VITE_API_URL=https://dev-api.tozzo.uk`;
- **branch de produção**: `dev`, em Settings → Builds → Branch control (o painel não pergunta na criação). A `dev` é o ambiente da nova leva de clientes; a `main` (React na VM) não entra no Worker;
- **domínio**: `app-dev.tozzo.uk` durante a construção; `dev.tozzo.uk` no corte;
- adicionar `https://app-dev.tozzo.uk` em `CORS_ORIGINS` da API Go.

`web/wrangler.jsonc` só tem assets, sem script: `assets.directory = ./dist` e `not_found_handling = single-page-application`. Requisição a asset estático não conta como invocação de Worker.

`web/public/_headers`:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: https://media-dev.tozzo.uk; connect-src 'self' https://dev-api.tozzo.uk https://accounts.google.com/gsi/ https://*.r2.cloudflarestorage.com; frame-src https://accounts.google.com/gsi/; font-src 'self'; base-uri 'self'; form-action 'self'
```

- **Fallback de SPA:** `not_found_handling = single-page-application` serve o `index.html` em qualquer rota. Conferir no preview com uma URL profunda (`/dashboard/orders`).
- **Cache do HTML:** sem `Cache-Control` no `/*`. O Workers já serve o HTML com `public, max-age=0, must-revalidate` e ETag; um `no-cache` no `/*` se juntaria ao do `/assets/*` e anularia o `immutable`. Conferir com `curl -I` depois do primeiro deploy.
- **Atualização sem quebrar abas abertas:** os assets têm hash e o `index.html` não é cacheado. Quando um chunk lazy der 404 (deploy novo com aba antiga), o router recarrega a página uma vez. Implementar com um handler em `lazy()` e uma flag em `sessionStorage` para não entrar em loop.
- **Previews** (URLs `*-tozzo-web.<conta>.workers.dev`):
  - o cookie de refresh não é enviado (outro site), então quem usa o preview loga a cada abertura;
  - para o preview conseguir chamar a API, a origem precisa estar no CORS. Opcional: aceitar o padrão das URLs de preview na API, como regex. **Decidir com o usuário.**

## Metas de desempenho

| Métrica | Meta |
|---|---|
| JS inicial das rotas públicas (`/`, `/login`) | ≤ 80 KB gzip |
| Chunk do dashboard (shell + `orders`) | ≤ 120 KB gzip |
| ECharts | só no chunk de `charts` |
| Lighthouse (mobile, perfil médio) em `/login` e `/dashboard/orders` | Performance ≥ 90 |
| Lista de vendas com 1.000 linhas | rolagem a 60 fps (virtualização) |

Medir no fim de cada fase e registrar. `rollup-plugin-visualizer` no build de análise.

## Testes

- **Unitários** (Vitest): portar **todos** os testes do React de cada componente portado, com o mesmo comportamento esperado.
- **Visuais** (Playwright): para cada rota da S0, nos 3 tamanhos e 2 temas, comparar com `__screenshots__/react/` usando `maxDiffPixelRatio: 0.002`. Gráficos mascarados.
  - Diferença maior: corrigir o Solid. **Não** atualizar o baseline sem o "ok" do usuário, registrado aqui.
- **E2E**: portar os fluxos de `e2e/` para rodar contra o Solid com a massa `toV1()`. Rodar também contra a API Go da dev no fim de cada fase (smoke).
- **Acessibilidade**: `@axe-core/playwright` nas rotas principais, sem violações `serious` ou `critical`.

## Registro de execução

_(preencher ao fim de cada fase: data, o que foi feito, como foi verificado, medidas de desempenho e desvios aprovados)_

### S0 — 2026-10-13

**Feito:**
- **Massa canônica:** `e2e/visual/data/canonical.ts`, com:
  - estabelecimento FOOD + SERVICES e 6 usuários (todos os papéis);
  - 30 produtos e 5 tipos;
  - 8 pedidos (aberto, em entrega, fechado; itens em todos os estados);
  - 200 vendas (PRNG com semente; 30 nas últimas 24 h, que é o filtro padrão);
  - 6 serviços e 6 ordens (uma por estado);
  - 3 dispositivos, agenda (eventos, turnos, funcionamento).
- **Serializadores:** `toLegacyApi()` (Bun: chaves em português, `Decimal` como string, `X-Total-Count`) e `toV1()` (cents, cursor `{items, nextCursor}`, `summary`). `serializers.test.ts` confere contagens, totais e nomes (11 testes).
- **Mocks** (`e2e/visual/support/`):
  - `page.route` para API e GoTrue em hosts falsos;
  - sessão GoTrue semeada no `localStorage`;
  - SSE parado sem tráfego;
  - imagens externas trocadas por um pixel fixo;
  - estados de erro, carregando e vazio por endpoint.
- **Cenários:** 92 cenários (o menu mobile só no celular) = **548 screenshots** por sistema:
  - todas as rotas do `App.tsx`;
  - listas cheia, vazia, carregando e com erro;
  - diálogos de pedido, venda, produto, tipo, funcionário, turno, horário especial, funcionamento, filtro, entregador, info da cozinha, onboarding, exclusão e seleção de produto;
  - selects abertos;
  - abas;
  - menu mobile;
  - shells de COOK, DRIVER e EMPLOYEE;
  - plano pendente;
  - `/__ui`.
- **Scripts:** `bun run test:visual:baseline`, `bun run test:visual` e `bun run test:visual:linux`.

**Verificado:**
- duas rodadas completas seguidas sem nenhum pixel de diferença (524/524);
- selects abertos repetidos 9 vezes sem diferença;
- `bun run test` (319), `i18n:check` e `build` passando.

**Desvios e achados:**
- **Sem cenário de paywall.** O `getErrorCode()` do React devolve o `error.code` do Axios (`ERR_BAD_REQUEST`) antes do `code` do corpo, então o `PaywallBanner` nunca aparece: um 403 `PLAN_UPGRADE_REQUIRED` vira toast de erro. O React está congelado. **Decidido pelo usuário em 2026-10-14: o Solid mostra o banner** (`isPlanUpgradeRequired()` em `web/src/api/errors.ts`; a tela entra com a página que o usa). Como o React não mostra, esse estado não tem baseline: o cenário do banner no Solid vai precisar do "ok" do usuário para gravar a referência.
- **`/__ui` no React** (ok do usuário em 2026-10-13): `src/pages/dev/UiShowcasePage.tsx`, rota só com `import.meta.env.DEV` (fora do `dist/`). Mais 4 cenários (`ui`, `ui-select-open`, `ui-dialog`, `ui-dropdown-open`) = 24 screenshots por sistema. No dropdown, o check e o radio ficam por cima do texto: é o visual atual do React, e o baseline registra como está.
- **Um baseline por sistema** (ok do usuário em 2026-10-13): `react/win32/` e `react/linux/`, pelo `{platform}` do Playwright. O do Linux sai da imagem oficial do Playwright (`bun run test:visual:linux`), para o CI.
- **PNG no Git LFS** (ok do usuário em 2026-10-13): `.gitattributes` cobre `e2e/visual/__screenshots__/**/*.png`. A VM da dev faz `git pull` no deploy; sem `git-lfs` lá, ficam só os ponteiros, o que não afeta o build.
- **O `/v1` muda o que a tela mostra:**
  - sem total nem página, que hoje alimentam "Página N de M", "Total de registros" e os contadores da sidebar;
  - sem `REQUESTED` nos itens de pedido;
  - sem filtros de cliente, vendedor e valor em `GET /v1/orders`.

  Resolver antes da S4 (API) para o visual não mudar. **Em 2026-10-13 (API `5f6d153`):**
  - toda lista paginada do `/v1` passou a trazer `total`;
  - `GET /v1/orders` ganhou `customerName`, `sellerId`, `minTotalCents` e `maxTotalCents`;
  - o `REQUESTED` continua aparecendo como `IN_PREPARATION` no contrato.
- **O Bun ignora filtros que o React envia** (cliente, criado por e valor em `/pedidos`). A massa reproduz isso.

### S1 — 2026-10-14

**Feito** (`web/`, com `package.json` e `bun.lock` próprios):
- **Base:**
  - Vite 8 e `vite-plugin-solid`, TypeScript estrito, alias `@/`;
  - cópias do `tailwind.config.js` (só o `content` e `--radix-accordion-content-height` → `--kb-accordion-content-height`), `postcss.config.js`, `src/index.css`, `index.html`, logo e `lib/utils.ts`;
  - as versões que mudam pixel ficaram iguais às do React: `lucide-solid` 0.344.0, `tailwind-merge` 2.6.1 e Tailwind 3.4.19.
- **Tema:** `theme-provider` com a mesma chave `vite-ui-theme` e a mesma lógica de `system`; `ModeToggle`.
- **i18n:**
  - `config`, `locale`, `format`, `labels` e os 6 `locales/*.json` sem mudar chaves;
  - binding em `src/i18n/solid.ts` (`useTranslation()` lê um signal com o idioma; `I18nProvider` atualiza o `lang` do documento);
  - `error-keys.ts` com os `code` do `/v1` e as mesmas mensagens;
  - `ui-inventory.test.ts` e `i18n:check` portados (`web/scripts/check-i18n.mjs`).
- **Primitivas `ui/`:** todas as 13, com as mesmas classes e variantes CVA, sobre o `@kobalte/core` 0.13. `/__ui` só em dev (fora do `dist/`). `Badge` e `EmptyState` não existem no React, então não entraram.
- **Cliente da API:**
  - `bun run api:types` gera `src/api/schema.d.ts` (igual ao `api/openapi.yaml` local);
  - `openapi-fetch` com middleware: põe o token em memória e, no `401 INVALID_TOKEN`, faz um refresh single-flight (`credentials: 'include'`) e repete a requisição uma vez, com o corpo;
  - `unwrap()` e `ApiError` pelo `code`.
- **TanStack Query:** `staleTime` 30 s, retry só em erro de rede e 5xx; o `queryFn` passa o `signal` adiante.
- **Tempo real:** `src/realtime.ts`, como no plano (ticket, backoff 1/2/5/10/30 s com ticket novo, mapa de eventos → `invalidateQueries`, pausa após 5 min oculta). Depois de reconectar ou retomar, invalida todas as chaves, porque eventos podem ter sido perdidos.
- **Sessão (base da S2):** `AuthProvider` que abre a sessão pelo cookie (`POST /v1/auth/refresh`) e faz o logout em `POST /v1/auth/logout`; sessão expirada vai para `/login`.
- **Layouts e guardas:**
  - `MainLayout`, `DashboardLayout` (sidebar, colapso salvo, menu mobile, contadores pelo `total` do `/v1` com refetch a cada 60 s e por evento), `ProtectedRoute` e `BusinessModuleRoute`;
  - `Navbar`, `Footer`, `LoadingOverlay` e `ConfirmProvider`;
  - as rotas do dashboard existem com as guardas e renderizam só o shell até a fase de cada página.
- **Chunk após deploy:** `lazyPage()` recarrega a página uma vez quando um import falha, com flag em `sessionStorage`.
- **Pages:** `web/public/_headers` do plano.
- **Testes do `web/`:**
  - Vitest: 98 testes em 21 arquivos, com os testes portados de `ui/`, i18n, `businessPreferences`, guardas e `DashboardLayout`, mais os novos de cliente, sessão, realtime, tema e `lazyPage`;
  - E2E (`bun run test:e2e`, 6 specs contra a massa `toV1()`): redirecionamento sem sessão, contadores, navegação, colapso após reload, logout com confirmação, COOK só na cozinha e evento SSE atualizando contadores;
  - visual (`bun run test:visual:linux`): os cenários `ui*` com `toHaveScreenshot` contra o baseline do React, e o shell (`shell.visual.ts`) comparado fora do `<main>` (navbar, sidebar, drawer e footer) nos cenários `orders`, `cook-shell`, `driver-shell`, `employee-shell` e `mobile-menu`.

**Verificado:**
- Vitest 98/98, `i18n:check` e `build` passando;
- visual na imagem oficial do Playwright: 50/50 (24 do `/__ui` + 26 do shell), com tolerância `0.002`. Os 4 skipped são o `mobile-menu` fora do celular, como no React. Um teste negativo (comparar com o baseline do tema oposto) falhou como devia;
- E2E 6/6;
- React: `bun run test` (319), `i18n:check` e `build` passando;
- smoke na API da dev: `/v1/health` 200; `POST /v1/auth/refresh` sem cookie dá 401 `problem+json` com `code`; contrato publicado igual ao `api/openapi.yaml` local.

**Desempenho** (`bun run analyze` → `dist/stats.html`):
- chunk inicial: 74,2 KB gzip, mais o idioma ativo (12,5 a 15,8 KB gzip);
- `DashboardLayout`: 6,6 KB gzip; CSS: 6,1 KB gzip;
- maiores no inicial: `solid-js`, `@tanstack/query-core`, `i18next`, `solid-sonner`, `@solidjs/router` e `@kobalte/core`;
- **acima da meta** de 80 KB para `/` e `/login` (~87 a 90 KB com o idioma). Na S2, quando essas páginas existirem, carregar o `Toaster` e o diálogo do `ConfirmProvider` sob demanda e medir de novo;
- Lighthouse não rodou: `/login` e `/dashboard/orders` ainda não têm página.

**Desvios e achados:**
- **Locales sob demanda:** cada idioma virou um chunk (backend mínimo do i18next com `import.meta.glob`). O app renderiza depois que o idioma ativo carrega, com o spinner do `index.html`. Chaves e textos iguais; os testes carregam os 6.
- **Kobalte × Radix:**
  - o `Select` recebe `options` e `itemComponent` (com `<SelectItem item>`) em vez de `<SelectItem>` filhos;
  - triggers usam `as={Button}` no lugar de `asChild`;
  - o trigger do `Select` tem papel `button` (no Radix, `combobox`), o que vale para cenários e specs que buscam `combobox`;
  - posição do popover igual à do Radix: `placement="bottom-start"`, `gutter={4}` e `sameWidth={false}`;
  - `DropdownMenuLabel` e `SelectLabel` viraram `div` simples, como no Radix.
- **Playwright do `web/` é o da raiz** até a S8: os cenários e a massa ficam em `../e2e/visual`, e duas cópias de `@playwright/test` não convivem. O config visual do `web/` usa `updateSnapshots: 'none'` e nunca grava no baseline.
- **`bunfig.toml` da raiz:** `pathIgnorePatterns = ["web/**"]`, para o `bun test` do React não pegar os testes Vitest. Muda só a ferramenta, não o app React.
- **Mock `toV1()`:** as páginas passaram a trazer `total`, como o contrato desde a API `5f6d153`.
- **Ficam para depois:**
  - o modal de onboarding do estabelecimento (OWNER sem perfis) entra na S3, com as preferências;
  - `/login` ainda não existe: sessão expirada cai numa rota vazia até a S2.
- **CSP sem o host do R2:** `img-src 'self' data:`. O host público do R2 entra com as imagens de produto (S3), com o "ok" do usuário.
- **Publicação (fechada em 2026-10-14):**
  - Worker `tozzo-web` criado no lugar do Pages (seção "Cloudflare Workers"): caminho `web`, branch de produção `dev`, builds de preview ligados, variáveis de build `BUN_VERSION` e `VITE_API_URL`; `workers.dev` e `app-dev.tozzo.uk` ativos;
  - conferido com `curl`: `/` e `/dashboard/orders` dão 200 `text/html` com CSP, `X-Frame-Options` e HTML `max-age=0, must-revalidate`; `/assets/*.js` com `max-age=31536000, immutable`;
  - CORS: o preflight de `https://app-dev.tozzo.uk` em `dev-api.tozzo.uk` devolve `Access-Control-Allow-Origin` e `Allow-Credentials: true`, e `https://dev.tozzo.uk` segue liberada. Na VM, o compose do serviço `api` passou a ler `GO_CORS_ORIGINS` do `.env` (registro na fase 1 da API);
  - URLs de preview (`*-tozzo-web.victorhugo-tozzo.workers.dev`) seguem fora do CORS: decisão do usuário.

### S2 — 2026-10-14

**Feito:**
- **Páginas:** `/login`, `/register` (a mesma página na aba de cadastro), `/forgot-password` e `/reset-password`, com as classes e os textos do React; e as novas `/verify-email` e `/confirm-email`, no padrão do `ForgotPasswordPage`.
- **Chamadas:** pelo `src/api/auth.ts` (`openapi-fetch`, `createMutation`). Login, Google e `verify-email` vão com `credentials: 'include'`, para gravar o `tozzo_rt`.
- **Sessão:**
  - `establishSession()` e `clearSession()` no `AuthProvider`;
  - o logout vai com o bearer (na S1 era um `fetch` sem token, que o `/v1` recusava) e só conclui com 204 ou 401; em 5xx ou erro de rede, mostra um toast e mantém a sessão;
  - o reset de senha encerra a sessão local, porque a API revoga todas;
  - o middleware trata `401 SESSION_REVOKED` como `INVALID_TOKEN`: um refresh e, se falhar, vai para `/login`;
  - um refresh de boot que falha tarde não derruba um login já feito (contador de geração em `session.ts`).
- **Google:**
  - o GSI carrega sob demanda só nessas páginas, e o `idToken` vai para `POST /v1/auth/google` com `client: "web"`;
  - o Client ID vem de `VITE_GOOGLE_CLIENT_ID`, com o ID público como padrão; vazio esconde o botão;
  - na aba Cadastro, a chave de registro é validada antes do envio, e o POST não se repete;
  - o botão desenhado pelo GSI foi aceito pelo usuário.
- **Desempenho:** `Toaster` e diálogo do `ConfirmProvider` sob demanda, com `lazyPage()`.
- **i18n:** 7 chaves novas nos 6 idiomas, `<Trans>` mínimo, e em `error-keys`:
  - contextos novos `emailVerification` e `emailChange`;
  - `GOOGLE_TOKEN_INVALID` no login;
  - `PASSWORD_UNCHANGED` → `samePassword` no reset.
- **Testes:** os de `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` e `AuthContext` portados para o `/v1`, mais os das páginas novas, do cliente, do GSI (sempre mockado) e do `<Trans>`.
- **API:** `PASSWORD_UNCHANGED (422)` no reset e na troca de senha (API `7f1437d`), para a mensagem "a nova senha deve ser diferente da atual" continuar existindo.

**Verificado:**
- Vitest 156/156, `i18n:check` e `build` passando;
- E2E 14/14, com 8 de auth contra o mock `/v1` (`signInAs` no `mock-v1.ts`);
- visual na imagem oficial do Playwright, duas rodadas seguidas: 98 passaram e 4 pulados;
  - `login`, `login-register`, `forgot-password` e `reset-password` contra o baseline do React, com tolerância 0.002;
  - os 4 cenários só do Solid contra a referência gravada, com os PNGs idênticos nas duas rodadas;
- React: `bun run test` 319/319;
- revisão do diff: 4 achados médios (sessão após reset, chave no Google, logout com falha, chunks sem `lazyPage`) e 3 menores, todos corrigidos.

**Desempenho:**
- inicial com o pt-BR: 71,8 KB gzip (de 84,6 KB na S1, mesma medida), dentro da meta;
- tudo o que `/login` baixa: ~99 KB;
- medição com `bun run size`; Lighthouse não rodou.

**Desvios e decisões:**
- **2FA/TOTP removido do app novo** (decisão do usuário em 2026-10-14): o formulário de código não foi portado, e a configuração de 2FA não entra na S3.
- **Referência própria do Solid** (ok do usuário em 2026-10-14): `/verify-email` e `/confirm-email` não existem no React. A referência foi gravada a partir do Solid em `e2e/visual/__screenshots__/solid/linux/`, nos 3 tamanhos e 2 temas; só os projetos `solid-*` a leem. Esses PNGs ficam **fora do LFS** (exceção no `.gitattributes`, ok do usuário em 2026-10-14): a sessão na nuvem não consegue enviar para o LFS do GitHub, e são ~4 KB cada.
- **Senha mínima de 8:** a API exige (`pwhash.MinLen = 8`); o texto do hint e o do `weakPassword` foram ajustados.
- **Google na aba Cadastro sem o aceite dos termos:** cria a conta sem o aceite, com paridade com o React.
- **`register` sempre 202:** sai o alerta "email já tem conta" (a API não revela contas existentes).
- **`GOOGLE_CLIENT_IDS` da API:** vem do mesmo `GOOGLE_CLIENT_ID` do GoTrue, que aceita um ID só. Um ID para o Android vai exigir uma variável separada no serviço `api`.
- **Google Cloud:** origens autorizadas `app-dev.tozzo.uk`, `dev.tozzo.uk`, `tozzo.uk`, `www.tozzo.uk` e `localhost:5173`.
- **Ambiente de testes:** o `setup.ts` força `animation-name: none`, porque o happy-dom devolve vazio e o Kobalte mantinha a aba fechada no DOM.
- **Sandbox na nuvem:** o download do Chromium está bloqueado (`cdn.playwright.dev`), então E2E e visual rodaram na imagem Docker com o CA do proxy.
- **Não rodou:** smoke contra a API da dev e o GSI real (rede bloqueada); acompanhamento mobile (TozzoBurger fora desta sessão).

### S3 — 2026-10-14

**Feito:**
- **Páginas:** `/dashboard/settings` (`SettingsPage` e `BusinessPreferencesPanel`), `/dashboard/employees`, `/dashboard/products` (produtos, tipos e diálogos) e `/dashboard/devices`, com as classes, as variantes e as chaves do React, nas guardas de sempre (`BusinessModuleRoute`).
- **Componentes:** `EstablishmentOnboardingModal` (OWNER sem perfis, ou legado sem categoria; chunk próprio), `PaywallBanner`, `Pagination`, `EmployeeFilterDialog` (para a agenda, S5) e `ProductSelectionModal` (S4 e S5), com dinheiro em centavos e catálogo paginado no servidor (20 por página).
- **Dados:** `src/api/{catalog,users,devices,establishment,uploads}.ts` com `openapi-fetch`; `createQuery`/`createMutation`; páginas por cursor com "Página N de M" pelo `total` (`lib/cursor-pages.ts`); dinheiro por `lib/money.ts` (`formatCents`, entrada de preço em centavos); erros pelo `code` (`useErrorMessage()`).
- **Invalidação:** produtos → `products` e o uso do plano (`establishment`); tipos → `product-types` (e `products` ao editar ou excluir, porque excluir um tipo exclui os produtos); funcionários → `users`; dispositivos → lista e uso do plano; preferências e estabelecimento → `establishment` e `refreshUserProfile()` (menu e navbar). Os contadores da sidebar não dependem dessas listas.
- **Upload de imagem do produto** (no diálogo de edição): `POST /v1/uploads` → `PUT` direto no R2 com os headers devolvidos (menos `Content-Length` e `Host`, que o navegador põe) → `PATCH /v1/products/{id}` com `imageKey`. Tipo e tamanho conferidos antes; `503 NOT_READY` (sem bucket) vira "O envio de imagens ainda não está disponível." e o diálogo segue usável.
- **CSP** (ok do usuário, 2026-10-14): `img-src https://media-dev.tozzo.uk` e `connect-src https://*.r2.cloudflarestorage.com` (curinga: o Account ID do R2 não foi passado). O E2E roda no Vite, sem `_headers`: a CSP só se confere no preview do Worker.
- **i18n:** 9 chaves novas nos 6 idiomas (upload, `paymentNotInformed`, placeholder do complemento), e o contexto `uploadImage` em `error-keys`.
- **Primitivas (paridade com o Radix):**
  - `DialogContent`: foca o primeiro campo e seleciona o texto ao abrir, como o `FocusScope` do Radix; o X tem o nome traduzido (o Kobalte punha "Dismiss");
  - `SelectContent`: o portal é marcado como camada de topo; dentro de um diálogo modal o Kobalte escondia as opções do leitor de tela (`aria-hidden`).
- **Paywall:** cenário `employees-paywall` (MANAGER, `403 PLAN_UPGRADE_REQUIRED`) com referência gravada do Solid em `__screenshots__/solid/linux/` (ok do usuário em 2026-10-14), fora do LFS.

**Verificado:**
- Vitest 259/259 (44 arquivos, depois da revisão), `i18n:check` e `build` passando; React `bun run test` 319/319;
- E2E 23/23 (9 novos em `registration.e2e.ts`: produto criar/editar/excluir, upload com PUT mockado, upload sem bucket, tipo, funcionário criar/editar/excluir, paywall, dispositivo, preferências + dados do estabelecimento, onboarding);
- visual na imagem do Playwright: duas rodadas antes da revisão e uma depois, todas com 248 passando e 4 pulados (o `mobile-menu` fora do celular); os PNGs do paywall saíram idênticos; 19 cenários do React em `ported.ts`; `settings`, `settings-free-plan`, `settings-delete-account`, `onboarding` e `devices-error` em `adjusted.visual.ts` (por regiões, limite 0,002); `employees-paywall` nos `solid-*`.

**Correções da revisão (2026-10-14):**
- **[alta] upload que termina depois de trocar de produto:** o `onSuccess` só atualiza o formulário se ele ainda for do produto enviado; antes, o "Salvar" do produto B podia mandar `PATCH` no produto A. Teste Vitest com o upload pendente e a troca de produto.
- **Onboarding:** depois de salvar, o botão fica em "Salvando..." até o perfil chegar (`onSaved` devolve a promessa do `refreshUserProfile()`). Se o `/v1/me` falhar, o botão só refaz o refresh, sem repetir o `PUT` e o `PATCH`; um `409 PREFERENCES_CONFLICT` conta como já salvo e só refaz o refresh. Dois testes novos.
- **Funcionários:** testes de permissão por linha. O MANAGER não edita nem exclui MANAGER e OWNER; EMPLOYEE e COOK não têm a coluna de ações.
- O comentário do E2E de upload não diz mais que a CSP é exercitada.

**Desempenho:** inicial 60,3 KB gzip (`bun run size`); `ProductsPage` 5,7 KB, `SettingsPage` 4,9 KB, `EmployeesPage` 3,8 KB, onboarding 2,0 KB, `DevicesPage` 1,5 KB gzip. Lighthouse não rodou.

**Desvios e achados:**
- **2FA fora** (decisão do usuário): a `SettingsPage` não tem o card "Segurança". Por isso os cenários `settings*` comparam por regiões: acima da seção "Dados e privacidade" igual, e dali para baixo a página do React subida a altura do card.
- **Ordem dos tipos** (aceita pelo usuário em 2026-10-14): o `/v1` ordena por descrição (alfabética); o Bun, por id. Mudam a ordem das linhas da aba Tipos e o "#". No cenário `products-types`, o mock responde na ordem do Bun só para comparar os pixels com o baseline; a tela mostra a ordem da API.
- **Tipos sem paginação no `/v1`:** a lista vem inteira (são poucos) e a página "N de M" e o total são calculados no front.
- **Upload só na edição:** precisa do id do produto. O campo leva `data-solid-only` e fica fora da comparação de `products-edit`; ainda não tem referência visual própria.
- **Comparações ajustadas aceitas pelo usuário (2026-10-14):** `settings*` sem o card de 2FA (por regiões), `onboarding` só o diálogo, `devices-error` sem a área do toast, o campo de upload com `data-solid-only` e os ajustes de `support/solid-adjustments.ts`.
- **`devices-error`:** o baseline do React foi gravado no servidor de dev, onde o StrictMode roda o efeito duas vezes (dois toasts empilhados). O Solid mostra um; a área do toast fica fora da comparação.
- **Suspense:** ler `query.data` pendente suspende a página inteira no Solid Query (overlay "Carregando…"). As páginas leem por `loadedData()` e avisam erro por `onQueryError()` (um toast por falha; um efeito que lia o toaster entrava em laço).
- **Kobalte:** o `Select` da `Pagination` usa o wrapper com `contents` e o `ml-2` no trigger (o do Radix encolhe como item flex no celular).
- **Achado no React (congelado, não corrigido):** `tErrors("products.selectItems")` cai no namespace `products` (`nsSeparator: "."`) e mostra a chave crua; no Solid, `{ nsSeparator: false }`.
- **Mock `toV1()`:** `/v1/users` passou a trazer `total`, e os limites do plano FREE (3/60/5/30) como a API.
- **`EmployeeFilterDialog`** é da agenda (S5): portado com o teste, ainda sem tela.
- **Não rodou:** smoke contra a API da dev (rede bloqueada); upload real no R2 (o CORS do bucket e a CSP só se confirmam no preview); acompanhamento mobile.

### Entrada do Solid e corte antecipado da homologação — 2026-10-15

Decisão do usuário: usar o Solid ainda incompleto em `dev.tozzo.uk` e desligar apenas o front React da VM dev. A API Bun e o GoTrue permanecem para os clientes legados; a produção não muda.

- Corrigida a entrada `/`, que não tinha rota e mostrava uma tela vazia: agora abre `/login`, cuja guarda de sessão encaminha usuários autenticados ao dashboard.
- Dois testes Playwright cobrem a entrada sem sessão e com sessão restaurada; ambos falharam antes da correção e passaram depois. A suíte de autenticação passou 10/10.
- O job SSH `deploy` do front passa a executar apenas na `main`. O Solid continua sendo publicado pelo Workers Builds do `tozzo-web` a cada push da `dev`.
- Corte confirmado: o usuário vinculou `dev.tozzo.uk` ao Worker; o build Cloudflare de `b8da753` passou. No navegador real, `/` abriu `/login` e `/verify-email` exibiu a página Solid (sem consumir token). O container `dev-app-frontend-1` foi parado e ficou `exited`; API Go, Bun, banco, GoTrue e PowerSync permaneceram ativos. `FRONTEND_URL` da API Go já aponta para `https://dev.tozzo.uk`, sem necessidade de alteração. A criação real de conta e o login Google autenticado ainda precisam de smoke.
- Não equivale à conclusão da S8: as telas das fases S4 em diante continuam pendentes.
- Validação da correção: 259/259 testes Vitest no Docker Linux, 10/10 E2E de autenticação, 6/6 visuais de login (três tamanhos, dois temas), i18n e build aprovados. No Windows, o Vitest falhou ao carregar o módulo virtual `file:///@solid-refresh`; os testes passaram no ambiente Linux padrão sem alteração de dependências. Revisão independente do diff sem achados.

### Dev só com o Go — 2026-10-15

Revê a nota acima de que a API Bun e o GoTrue permaneciam: a pedido do usuário, saíram da VM dev o GoTrue, o Bun (`backend`) e o container do React (`frontend`); a dev roda só `api` (Go), `db` e `powersync`. Registro completo na API (plano da migração Go, 2026-10-15).

- **Causa do login que falhava na homologação:** o navegador seguia com o `index.html` do React em cache heurístico (o nginx dele não mandava `Cache-Control`), e o React usa o GoTrue. Resolve com Ctrl+Shift+R ou "Clear site data" no `dev.tozzo.uk`. O Worker manda `max-age=0, must-revalidate`, então não se repete.
- **Smoke:** o usuário entrou pelo Solid na dev. O `app-dev.tozzo.uk` foi aposentado.
- **S8:** passos 1 e 2 feitos; o 3 (apagar o React da raiz e mover o `web/`) fica para depois da S7.
- **Mobile:** o app RN apontado para a dev parou, porque dependia do Bun e do GoTrue.

### S4 — 2026-10-15 e 2026-10-16

**Feito:**
- **Partes A e B (commit `d04fc4e`):** `PedidosTab`, `VendasTab`, `FiltersBar` e o recibo impresso pelo navegador, no `/v1`. Têm páginas por cursor com a mesma paginação visual, o total do período pelo `summary`, dinheiro em centavos, criação idempotente com id do cliente e `expectedUpdatedAt` na edição do pedido (no conflito, os itens são recarregados).
- **Parte C:** `/dashboard/kitchen` e `/dashboard/deliveries`, com `src/api/{kitchen,delivery}.ts` e arrastar e soltar por `@thisbeyond/solid-dnd` 0.7.5 (MIT, do mapa de bibliotecas), em `lib/board-dnd.ts`:
  - **Detecção de alvo:** a mesma do dnd-kit, `closestCenter` filtrado na cozinha e `pointerWithin` para soltar um entregador num pedido aguardando.
  - **Esc e `pointercancel`** cancelam o arrasto com o ponteiro, o que o sensor do solid-dnd não faz.
  - **A posição das áreas de soltar é recalculada no `scroll`** durante o arrasto (o solid-dnd só mede no início e no fim).
  - **Alternativa por teclado:** Espaço pega, as setas escolhem a coluna, Espaço solta e Esc cancela. Há região live e as instruções vêm traduzidas. Os textos `common.dnd.*` nos 6 idiomas têm o ok do usuário (2026-10-16).
  - **Escritas:** todas mandam `expectedUpdatedAt`. `KITCHEN_CONFLICT` e `DELIVERY_CONFLICT` avisam e recarregam. As entregas usam `ASSIGN`, `UNASSIGN`, `START` (com `confirmReady`) e `WAIT`.
- **Tempo real:** `order.changed` invalida `orders`, `kitchen` e `delivery`, e o poll de 15 s do React fica como reserva. As colunas percorrem a lista fixa de etapas, então um refetch não remonta os cards nem tira o foco de um card pego pelo teclado.

**Verificado (2026-10-16):**
- Vitest 352/352 (50 arquivos) no Docker Linux; `i18n:check` e `build` passando.
- E2E 49/49; `kitchen-delivery.e2e.ts` 11 casos, também com `--repeat-each=3` (33/33).
- Visual na imagem do Playwright: 362 passando e 4 pulados (o `mobile-menu` fora do celular). Depois das correções, os 48 dos cenários `kitchen*`, `deliveries*`, `cook-shell` e `driver-shell`. Nenhum baseline mudou.

**Correções da revisão (2026-10-16):**
- Colunas remontando a cada refetch (o foco do card pego pelo teclado se perdia). Ganhou teste Vitest.
- Scroll durante o arrasto do entregador podia atribuir a um pedido errado.
- `waitForTimeout` saiu do E2E. As provas de "nada enviado" agora fazem um movimento real depois e conferem que só ele foi enviado; a espera de ativação de 250 ms espera o card levantado.

**Desvios e achados:**
- Sem autoscroll durante o arrasto (o dnd-kit tinha). O E2E de entregadores usa viewport de 1440×1800.
- Paridade com o React, não alterado: qualquer erro do `MOVE` da cozinha mostra "a comanda mudou", e o erro ao finalizar uma entrega aparece no alerta da página, atrás do diálogo.
- No Windows: o Vitest não carrega `@solid-refresh` (roda no Docker), e o shim `node_modules/.bin/playwright` está quebrado (o E2E rodou pelo `cli.js` do `@playwright/test`).
- **Não rodou:** smoke contra a API da dev e Lighthouse.

### S5 — 2026-10-17 (implementação local verificada)

**Feito:**
- `/dashboard/services`: catálogo com busca, cursor e total; criar, editar e excluir restritos ao OWNER; preço e descrição opcionais; `SERVICE_IN_USE` mostra as referências reais sem perder os dados do formulário.
- `/dashboard/estimates`, `/dashboard/estimates/:id`, `/dashboard/service-orders` e `/dashboard/service-orders/:id`: criação, detalhes, orçamento de produtos/serviços/avulsos, aceite, início, adicionais e aceite dos adicionais, conclusão em venda, cancelamento, reabertura e exclusão. Valores em centavos, preços históricos e `acceptedQuote` preservados; edição envia `expectedUpdatedAt`.
- Consultas e mutações em `src/api/{services,service-orders,calendar}.ts`, usando os tipos gerados, openapi-fetch e TanStack Query. Prefixos `services` e `service-orders` continuam compatíveis com o tempo real central. Ações invalidam listas, detalhe e vendas; respostas antigas de GET são canceladas antes e depois da mutação para não sobrescrever uma revisão recém-salva.
- Agenda, turnos, recorrência semanal, virada de dia, exceções por funcionário, filtro de funcionário, horários especiais e funcionamento portados. FullCalendar **6.1.21**, os mesmos plugins do React, agora pelo núcleo imperativo (sem wrapper React). Licença MIT conferida na origem; instância preservada nos refetches e destruída ao sair.
- Foco dos campos personalizados preservado com `Index`. Setas decorativas do calendário saem da árvore de acessibilidade, mantendo o nome dos botões e o mesmo visual.
- Rotas lazy com as guardas existentes. Nenhum token, cor, CSS global ou baseline alterado. O histórico passa pelo i18next nos seis idiomas e mantém os rótulos exatos do React (`CREATE`, `QUOTE` etc.).

**Verificado:**
- Solid: **435/435 testes Vitest**, 62 arquivos; `i18n:check`, build TypeScript/Vite e `git diff --check` aprovados.
- React: **321/321 testes**, incluindo os dois novos testes do serializer compartilhado (prazo e enum de ações do Go). Nenhum código React alterado.
- Chromium: **59/59 E2E** na rodada final, com os 10 novos casos da S5 (catálogo, ciclo completo de orçamento/execução, conflitos, agenda e acessibilidade das setas).
- Visual Linux na imagem oficial: **150/150** casos S5 aprovados (25 estados × 3 tamanhos × 2 temas), contra o baseline React, tolerância 0,002. Ajuste de 8 px na paginação ficou restrito ao seletor do orçamento; nenhuma referência gravada ou atualizada.
- axe-core 4.14.0 nas seis rotas principais da S5: **zero violações serious/critical**, em build de produção local com a massa canônica. A auditoria encontrou o `role="img"` sem nome das setas do FullCalendar; teste Playwright falhou antes e passou depois da correção.
- API dev: `/v1/health` 200. OpenAPI publicado regenerado em arquivo temporário, idêntico ao `web/src/api/schema.d.ts` existente.
- Revisão independente: corrigidos perda de foco na agenda e conflito entre GET/SSE e mutação de ordens; revisão das correções sem achados concretos restantes. Regressões incluem navegação entre ids durante mutação, resposta antiga antes/durante salvar e recarga com objeto idêntico no cache.

**Desempenho:**
- `bun run analyze` e `bun run size`: entrada e imports estáticos **61,7 KB gzip**; mais pt-BR **13,6 KB**, aproximadamente **75,4 KB** no total inicial (meta 80 KB).
- Chunks próprios: catálogo 3,36 kB, lista de ordens 3,49 kB, detalhe/editor 7,31 kB e agenda/FullCalendar **85,61 kB gzip**, somente na rota da agenda.
- Dashboard + pedidos: **68,7 KB gzip adicionais** à entrada e ao idioma; **144,0 KB** somando todos os imports compartilhados e pt-BR.
- Lighthouse mobile 13.5.0 em build de produção local, assets gzip e massa canônica: login **97**, dashboard/pedidos **89** em duas medições. **A meta de 90 no dashboard ainda não foi atingida**; a medição local não substitui homologação na CDN/API reais. Relatórios e auditoria axe em `web/test-results/performance/` (artefatos locais, ignorados pelo Git).

**Limites e decisões:**
- O contrato da agenda não expõe versão otimista; não foram inventados `updatedAt` ou `expectedUpdatedAt`. A criação de ordem também não aceita idempotency key; envio duplicado é bloqueado localmente e a conclusão é idempotente no servidor.
- `toV1()` agora aplica `dueBefore` e serializa ações do histórico com os enums reais em maiúsculas; o serializer legado e o baseline permanecem intactos.
- Acompanhamento mobile atualizado apenas na documentação: nenhum contrato ou sync mudou por causa da migração do framework; M05/M12 continuam pendentes no app.
- **Smoke autenticado na API dev não aprovado:** a conta de `.env.e2e.local` respondeu 401 `INVALID_CREDENTIALS`. Nenhum dado comercial foi alterado. A validação funcional acima usa HTTP controlado com a massa canônica.
- **Sem commit, push ou deploy**, conforme instruções. A publicação/preview, o smoke autenticado e a meta Lighthouse do dashboard continuam pendentes; este registro não declara o fechamento da fase em homologação.


### S6 — 2026-10-17 (implementação local verificada)

**Feito:**
- `/dashboard/charts` lazy, sob a guarda `REPORTS`, com filtros de período/tipo, ranking e totais completos, lista detalhada por cursor/`total`, quatro visualizações e a aba de vendas por hora com navegação diária e detalhes de até cinco vendas no tooltip.
- Cliente tipado `src/api/reports.ts` sobre `openapi-fetch`, TanStack Query e os contratos Go já existentes. Valores ficam em centavos no domínio; `amountFromCents` converte apenas as unidades plotadas, para receita e quantidade manterem a escala do React. O ranking traz os dez produtos e agrega `others`; os totais vêm da API, nunca só dos itens visíveis.
- ECharts **6.1.0**, Apache-2.0, com imports modulares de barras, linhas, pizza, grid, legenda, tooltip e SVG. Tema lê `--foreground`, `--muted-foreground`, `--border`, `--card` e a fonte computada; observer acompanha troca de tema. Resize, descarte e resolução tardia do import cobertos por testes. Mesmos hex das séries do React; tooltips `richText`, sem HTML dinâmico da API.
- Export Excel/PDF: `POST /v1/reports/exports` (`xlsx`/`pdf`, locale, filtros e offset), GET a cada 2 s, sem sobreposição, com prazo absoluto de **120 s**, inclusive POST/GET travados. Bloqueio de duplo envio; cancelamento ao sair; respostas tardias não baixam arquivo. Download direto pelo endereço HTTP(S) da API, sem usar o cliente autenticado; erro, cota, bucket indisponível e URL ausente/inválida recebem mensagens traduzidas.
- Duas chaves novas nos seis idiomas: `charts.others` e `charts.report.unavailable`. Inventário de traduções aponta os tooltips para o novo construtor de opções. React, tokens, CSS global e baselines permanecem intactos.
- Acompanhamento mobile atualizado com `sem impacto mobile` adicional: a troca de framework não alterou contratos, banco ou sync. A integração do app com o Go continua separada; nenhum código mobile alterado.

**Revisão e regressões:**
- Revisão independente encontrou dois P2: escala de receita 100 vezes maior na linha e reapresentação de cache antigo depois de refetch falhado. Ambos corrigidos com testes que falharam antes e passaram depois. Gráfico/totais/tabela/horas deixam de apresentar os dados em cache como atuais após erro.
- A inspeção das imagens encontrou rótulos da pizza sobrepostos à legenda. O centro vertical reserva espaço para a legenda; Playwright reproduziu a sobreposição e passou após a correção.
- A análise do build encontrou o helper compartilhado do Rolldown dentro do chunk ECharts, puxado pelo toaster em outras páginas. Um grupo explícito para `echarts`/`zrender` faz o bundler emitir seu runtime separado. `scripts/check-report-chunks.mjs` falhou no build anterior e passa no corrigido; agora faz parte de `bun run build`. A verificação inspeciona os imports estáticos transitivos da entrada, login, toaster e dashboard/pedidos.

**Verificado:**
- Solid: **463/463 testes Vitest**, 68 arquivos; `i18n:check` e build TypeScript/Vite, incluindo o gate de chunks, aprovados. Nenhum teste pulado nessas rodadas.
- Chromium: suíte completa **68/68 E2E**; após o ajuste final da pizza e a asserção de ausência de credenciais no download, os **9/9 casos S6** passaram novamente.
- Visual Linux na imagem oficial do Playwright: **24/24** comparações S6, quatro estados × três tamanhos × dois temas, tolerância 0,002. Nenhum baseline gravado ou atualizado. As áreas de gráfico recebem máscara específica do Solid.
- `charts-error` segue o padrão de comparação por regiões das outras páginas de erro: exclui a área dos toasts, pois StrictMode no baseline React empilha mais notificações do que as duas consultas Solid. O restante da tela passa nos seis projetos. `charts-type-menu` usa o papel `button` do Kobalte e tipos em ordem de id no mock visual, pela mesma exceção de ordenação documentada em S3; a tela real respeita a ordem da API.
- axe-core/Playwright **4.14.0**, MPL-2.0, nas duas abas: **zero violações serious/critical**.
- Build de produção servido localmente com a massa canônica: login e pedidos não solicitam ECharts; as cinco visualizações funcionam nos dois temas, sem erro de página. Dez PNGs isolados em `web/test-results/reports-review/`, ignorados pelo Git, para revisão manual do usuário. As capturas escondem somente o header fixo para ele não cobrir o gráfico durante o scroll.

**Desempenho:**
- `bun run analyze`, `size` e inspeção do grafo emitido: entrada/imports estáticos **61,9 KB gzip**, com pt-BR **75,5 KB**, dentro da meta inicial de 80 KB. Chunks dos gráficos permanecem fora das rotas anteriores.
- Dashboard/pedidos com todos os imports compartilhados e pt-BR: **144,6 KB gzip**, aproximadamente 69,1 KB além da entrada/idioma; a meta global de 120 KB permanece pendente, como na S5. Biblioteca ECharts: aproximadamente **190,9 kB gzip** pelo relatório Vite, somente sob demanda em Relatórios; aviso de chunk maior que 500 kB bruto registrado, sem desabilitar o aviso.
- Lighthouse mobile **13.5.0**, build local com gzip e HTTP controlado: login **96**, dashboard/pedidos **89**. A meta de 90 no dashboard continua não atingida. Relatórios JSON em `web/test-results/performance/s6-lighthouse-*.json`; não substituem medição com CDN/API reais.

**Pendências de homologação:**
- Smoke autenticado somente de leitura tentou a conta dedicada de `.env.e2e.local`: **401 `INVALID_CREDENTIALS`**. Nenhuma leitura autenticada de relatório ou exportação real foi declarada aprovada; nenhum dado comercial alterado.
- Revisão manual das imagens dos gráficos pelo usuário ainda pendente; esses PNGs não são baselines aprovados.
- Commit e push na `dev` autorizados pelo usuário em 2026-10-17, após a implementação local. O push aciona Workers Builds; a publicação deve ser conferida pelo SHA enviado. A autorização de publicação não equivale ao fechamento do smoke autenticado, do aceite manual dos gráficos ou das metas de desempenho.
