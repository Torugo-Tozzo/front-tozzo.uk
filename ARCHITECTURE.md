# Arquitetura

Front web do Tozzo, um SaaS de gestão para restaurantes e serviços. API: `../api-tozzo.uk`. Mobile: `../TozzoBurger`. Os três são repositórios Git independentes.

## Aplicativo e branches

- **`dev`:** SolidJS na raiz, SPA estática, somente `/v1` da API Go. Cloudflare Workers serve os assets (`tozzo-web`, `dev.tozzo.uk`); push publica pelo Workers Builds. Não há deploy SSH do front dev.
- **`main`:** produção legada preservada. Migrar produção requer plano separado; nunca fazer merge da `dev` para a `main`.

O código React foi retirado da árvore da S8. O [plano da migração](docs/superpowers/plans/2026-10-10-migracao-solid.md) registra implementação e pendências; PNGs, massa canônica e adaptador legado de testes continuam como referência de regressão, sem aplicação React executável.

## Mapa

| Caminho | Responsabilidade |
|---|---|
| `src/App.tsx` | rotas e páginas lazy |
| `src/api/` | cliente openapi-fetch e operações do `/v1` |
| `src/api/schema.d.ts` | tipos gerados, nunca editados à mão |
| `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx` | sessão e guardas |
| `src/layouts/` | shell público e dashboard |
| `src/components/ui/` | primitivas Kobalte e variantes visuais |
| `src/pages/dashboard/` | operação, cadastros, serviços, agenda e relatórios |
| `src/components/reports/` | gráficos e exportação de relatórios |
| `src/i18n/` | recursos, binding Solid e formatação |
| `src/realtime.ts` | SSE compartilhado e invalidação |
| `e2e/` | fluxos Playwright e fixtures `/v1` |
| `e2e/visual/` | cenários, massa, mocks e referências visuais |
| `scripts/` | i18n, isolamento de chunks, tamanho inicial e visual Linux |
| `wrangler.jsonc`, `public/_headers` | assets, fallback SPA, cache, segurança e CSP |

## Dados, sessão e interface

- Vite, `vite-plugin-solid`, TypeScript estrito, alias `@/`, Tailwind 3.4. Tokens e layout preservam a referência visual aprovada.
- `@solidjs/router` e `lazyPage()`: um chunk que dá 404 após deploy recarrega a página uma vez.
- TanStack Solid Query e openapi-fetch; tipos gerados por `bun run api:types` do `/v1/openapi.yaml`.
- `QueryLayout` carrega um único cache compartilhado nas rotas de autenticação e dados; landing e páginas legais não baixam TanStack Query. Editor de pedidos e seletor de tamanho da página carregam no primeiro uso, mantendo as primitivas e o tratamento de chunk obsoleto.
- Access token só em memória. Refresh por cookie em `POST /v1/auth/refresh`, com `credentials: 'include'`; um refresh single-flight após `401 INVALID_TOKEN`.
- `src/realtime.ts` obtém ticket, abre EventSource, reconecta com backoff e ticket novo e invalida queries. Componentes não abrem conexões próprias.
- Kobalte com classes e variantes preservadas; i18next com seis idiomas, cada idioma em chunk próprio. Erros traduzidos pelo `code` em `error-keys.ts`.
- Dinheiro em centavos no contrato; conversões centralizadas em `src/lib/money.ts`.
- ECharts modular isolado no chunk de relatórios; gate de imports transitivos no build. FullCalendar vanilla e locales no chunk da agenda.

## Workers

Workers serve somente `dist/`, sem SSR, com `not_found_handling: single-page-application`. Configuração de build na raiz; variáveis públicas entram no bundle. HTML revalidado, assets com hash e cache imutável. CSP e headers em [SECURITY.md](SECURITY.md).

A S8 foi publicada na `dev` pelo commit `301f251`, com diretório de build vazio (raiz) no painel e CI/Worker/HTTP conferidos. Mudanças posteriores continuam exigindo publicação autorizada e conferência pelo SHA.

## Metas de desempenho

| Métrica | Meta |
|---|---|
| JS inicial de `/` e `/login` | ≤ 80 KB gzip |
| Shell do dashboard + `orders` | ≤ 120 KB gzip |
| Lighthouse mobile em `/login` e `/dashboard/orders` | Performance ≥ 90 |
| Lista de 1.000 vendas | 60 fps (virtualizada) |

São metas de aceite, não resultados presumidos. A S7 registrou pendências na landing e no dashboard; o corte estrutural não as encerra. Veja as medidas e limites no registro do plano.
