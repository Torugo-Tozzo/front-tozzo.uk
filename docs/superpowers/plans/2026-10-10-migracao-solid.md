# Plano: front em SolidJS no Cloudflare Pages (mesmo visual)

Data: 2026-10-10. Branch: `dev`. Regras de código: [`CLAUDE.md`](../../../CLAUDE.md).
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
  - portar `error-keys.ts` para os `code` do `/v1` (ver `CLAUDE.md` da API), mantendo as mesmas mensagens;
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
   - atualizar o README e o `CLAUDE.md`.

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
