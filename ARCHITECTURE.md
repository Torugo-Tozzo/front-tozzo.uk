# Arquitetura

Front web do Tozzo, um SaaS de gestão para restaurantes e serviços. API: `../api-tozzo.uk`. Mobile: `../TozzoBurger`. Os três são repositórios Git independentes.

O repo está **no meio de uma migração** de React para **SolidJS**, com o mesmo visual:
- plano: [`docs/superpowers/plans/2026-10-10-migracao-solid.md`](docs/superpowers/plans/2026-10-10-migracao-solid.md);
- plano da API: `../api-tozzo.uk/docs/superpowers/plans/2026-10-10-migracao-go.md`.

## Dois apps, lado a lado até o corte (fase S8)

| | React (raiz) | Solid (`web/`) |
|---|---|---|
| Estado | **em produção e congelado**: só correção, e só se o usuário pedir | **alvo da migração**: shell, primitivas, cliente da API e tempo real prontos (S1); páginas por fase |
| API | Bun (rotas antigas, `legacyWire`) + GoTrue | **só o `/v1` da API Go**, com auth própria |
| Hospedagem | nginx na VM (`dev.tozzo.uk`, `tozzo.uk`) | **Cloudflare Pages** (`tozzo-web`, `app-dev.tozzo.uk`; `dev.tozzo.uk` no corte) |
| Testes | `bun test` + Testing Library + happy-dom; Playwright | Vitest + `@solidjs/testing-library` + happy-dom; Playwright |

Os dois nunca se misturam no mesmo app. O `web/` tem `package.json` próprio.

## Branches

- `main`: React em produção. Recebe só correções.
- `dev`: React da homologação e o `web/` em construção. Push na `dev` publica o React na VM pelo Actions; o Pages publica o `web/` (branch de produção do Pages = `dev`).

## React (raiz) — mapa

| Caminho | O que tem |
|---|---|
| `src/App.tsx` | rotas e páginas lazy |
| `src/components/ProtectedRoute.tsx`, `src/contexts/AuthContext.tsx` | sessão e acesso |
| `src/layouts/DashboardLayout.tsx` | navegação, badge e shell |
| `src/pages/dashboard/`, `src/components/dashboard/` | páginas, pedidos e vendas |
| `src/components/ui/` | primitivas (Radix + CVA), base do visual que o Solid copia |
| `src/services/api.ts` | Axios, sessão GoTrue e conversão da fronteira HTTP |
| `src/lib/legacyWire.ts` | conversão português/inglês; não duplicar nos componentes |
| `src/domain/models.ts`, `src/domain/dtos.ts` | contratos tipados |
| `src/hooks/useRealtimeEvents.ts` | uma EventSource compartilhada por aba |
| `src/i18n/` | recursos, labels e formatação (6 idiomas) |
| `src/components/receipt/` | impressão no navegador |
| `e2e/` | Playwright: fluxos, e na fase S0 o baseline visual (`e2e/visual/`) |

## Solid (`web/`) — arquitetura-alvo

Detalhes e bibliotecas no plano (seções "Mapa de bibliotecas" e "S1").

- **Base:**
  - Vite e `vite-plugin-solid`, TypeScript estrito, alias `@/`;
  - SPA estática, sem SSR;
  - Tailwind 3.4 com **o mesmo** `tailwind.config.js` e `index.css` do React.
- **Rotas:** `@solidjs/router` com `lazy()`. Um chunk que dá 404 depois de deploy recarrega a página uma vez.
- **Dados:**
  - `@tanstack/solid-query` mais `openapi-fetch`;
  - tipos gerados do `/v1/openapi.yaml` em `web/src/api/schema.d.ts` (`bun run api:types`, nunca editar à mão);
  - o middleware põe o access token e faz **um** refresh single-flight no `401 INVALID_TOKEN`.
- **Sessão:** access token só em memória; refresh por cookie (`POST /v1/auth/refresh`, `credentials: 'include'`).
- **Tempo real:** só `web/src/realtime.ts`. Ele pede um ticket, abre o `EventSource`, reconecta com backoff e um ticket novo, e o evento vira `invalidateQueries`.
- **UI:** primitivas em `web/src/components/ui/` com as mesmas classes e variantes CVA do React, sobre o `@kobalte/core`. Os seletores de estado do Radix viram os do Kobalte, com o mesmo efeito visual.
- **i18n:** o mesmo i18next e as mesmas chaves, com um binding Solid (`web/src/i18n/solid.ts`). Cada idioma é um chunk carregado quando fica ativo; o app renderiza depois disso. O `code` dos erros do `/v1` vira mensagem pelo `error-keys.ts`.
- **Gráficos:** ECharts modular, só no chunk de relatórios. Tabelas com `@tanstack/solid-table` e virtualização acima de 200 linhas.
- **Pages:** `web/public/_headers` com cache imutável de assets e headers de segurança e CSP (ver [SECURITY.md](SECURITY.md)).

## Metas de desempenho (Solid)

| Métrica | Meta |
|---|---|
| JS inicial de `/` e `/login` | ≤ 80 KB gzip |
| Shell do dashboard + `orders` | ≤ 120 KB gzip |
| Lighthouse mobile em `/login` e `/dashboard/orders` | Performance ≥ 90 |
| Lista de 1.000 vendas | 60 fps (virtualizada) |
