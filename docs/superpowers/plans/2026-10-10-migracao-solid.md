# Plano: front em SolidJS no Cloudflare Pages (mesmo visual)

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
| Hospedagem | **Cloudflare Pages**, projeto `tozzo-web` com raiz `web/`. A VM deixa de servir o front no corte. |
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
- deploy de preview no Pages;
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

1. O projeto Pages passa a responder em `dev.tozzo.uk`.
2. O workflow `deploy.yml` (VM) para de publicar o front da `dev`. Na `main`, **nada muda**: a produção continua no React com o Bun.
3. Num commit só na `dev`:
   - apagar o React da raiz (`src/`, `index.html`, `vite.config.ts`, `Dockerfile`, `nginx.conf` e os configs da raiz);
   - mover `web/*` para a raiz;
   - atualizar o README, o `AGENTS.md`, o `ARCHITECTURE.md` e o `CONVENTIONS.md` (tirar o React).

## Cloudflare Pages

O usuário cria o projeto no painel, porque precisa de acesso à conta:
- **projeto** `tozzo-web`, ligado ao GitHub `Torugo-Tozzo/front-tozzo.uk`;
- **branch de produção do Pages**: `dev`. A `dev` é o ambiente da nova leva de clientes; a `main` (React na VM) não entra no Pages;
- **raiz** `web`, build `bun install --frozen-lockfile && bun run build`, saída `dist`;
- **variáveis**: `BUN_VERSION` (a do `bun.lock`) e `VITE_API_URL=https://dev-api.tozzo.uk`;
- **domínio**: `app-dev.tozzo.uk` durante a construção; `dev.tozzo.uk` no corte;
- adicionar `https://app-dev.tozzo.uk` em `CORS_ORIGINS` da API Go.

`web/public/_headers`:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/*
  Cache-Control: no-cache
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: https://<R2_PUBLIC_HOST>; connect-src 'self' https://dev-api.tozzo.uk https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; font-src 'self'; base-uri 'self'; form-action 'self'
```

- **Fallback de SPA:** sem `404.html` no `dist`, o Pages já serve o `index.html` em qualquer rota. Conferir no preview com uma URL profunda (`/dashboard/orders`).
- **Atualização sem quebrar abas abertas:** os assets têm hash e o `index.html` não é cacheado. Quando um chunk lazy der 404 (deploy novo com aba antiga), o router recarrega a página uma vez. Implementar com um handler em `lazy()` e uma flag em `sessionStorage` para não entrar em loop.
- **Previews** (`*.tozzo-web.pages.dev`):
  - o cookie de refresh não é enviado (outro site), então quem usa o preview loga a cada abertura;
  - para o preview conseguir chamar a API, a origem precisa estar no CORS. Opcional: aceitar o padrão `https://*.tozzo-web.pages.dev` na API, como regex. **Decidir com o usuário.**

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
- **Pendências do usuário:**
  - criar o projeto `tozzo-web` no Pages (seção "Cloudflare Pages");
  - incluir `https://app-dev.tozzo.uk` em `CORS_ORIGINS` da API: hoje o preflight não devolve `Access-Control-Allow-Origin`.

  Sem isso não há deploy de preview nem smoke pelo navegador.
