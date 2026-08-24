# Fase 6 — T0: inventário do dashboard web

Data: 2026-08-24  
Branch: `feat/fase-6-i18n-english-base`  
Baseline: `4e2bd58` (`HEAD = dev = origin/dev`)

## Estado e método

O front iniciou sem diff de código. O único untracked pré-existente é
`audit-context/` e todos os seus arquivos foram preservados. A leitura cobriu
`src/services`, `contexts`, `hooks`, `lib/status.ts`, layouts, componentes,
páginas dashboard, testes e chamadas REST/SSE. Não houve alteração de
comportamento.

## Inventário de domínio, wire e conteúdo

| Categoria | Estado observado | Destino/decisão do spec |
|---|---|---|
| Tipos internos | `Establishment`, `User`, `Product`, `ProductType` já aparecem em alguns arquivos, mas ainda carregam propriedades `nomeFantasia`, `nome`, `preco`, `tipoProdutoId`, `estabelecimento` e `vendedor`. | Uniformizar nomes internos ingleses em T5, sem traduzir conteúdo persistido. |
| Wire HTTP | Paths e chaves permanecem portugueses: `/usuarios`, `/estabelecimentos`, `/produtos`, `/tipos`, `/pedidos`, `/vendas`, `/graficos`; campos como `nome`, `preco`, `cliente`, `vendedor`, `excluida`, `status`. | Manter paths/chaves somente no adapter legado. |
| Auth | `AuthContext` lê token de `localStorage`, chama `/usuarios/me` e `/estabelecimentos`, assume `nome`, `nomeFantasia`, `role` e status `ATIVO/PENDENTE_PAGAMENTO`; aceita `decoded.name` como fallback. | DTO legado separado de `User`; normalizar roles/status e codes de erro. |
| Status | `src/lib/status.ts` e componentes usam `ABERTO`, `EM_PREPARO`, `ENTREGANDO`, `FECHADO`; o badge e os filtros exibem labels portuguesas. O badge de pedidos usa query `NAO_FECHADOS`. | Enum interno em inglês, labels via i18n; decidir discrepância `NAO_FECHADOS`/`NAO_FECHADO`. |
| Dados de negócio | `nomeFantasia`, nomes/ingredientes de produto, nome do cliente e descrição de tipo vêm do estabelecimento/usuário. | Não traduzir nem renomear o texto gravado; traduzir somente catálogo padrão por ID. |
| UI | Strings hardcoded em `LandingPage`, `LoginPage`, `PlanSelectionPage`, `Navbar`, `ProductSelectionModal`, `PedidosTab`, `VendasTab`, `DashboardLayout`, `ChartsPage`, `EmployeesPage`, `OrdersPage`, `ProductsPage`, `SalesPage`, `SettingsPage` e componentes UI. | Cobertura completa em T6; status, toasts, confirms, placeholders e labels acessíveis entram no inventário de chaves. |
| Comentários | Comentários de polling/SSE, loading e regras de tela têm português, especialmente em `useRealtimeEvents`, `currency`, `ProtectedRoute` e tabs. | Classificar como comentário operacional; migrar em T5/T6, sem mexer em T0. |
| Fixtures/testes | Testes de `ProtectedRoute`, status, filtros, `parseResponse`, API e SSE afirmam campos/status portugueses (`estabelecimento`, `ATIVO`, `FECHADO`, `pedidos`, `vendas`). | Preservar asserts do wire no adapter; adicionar casos legado/inglês sem aceitar mistura acidental. |

## Consumidores HTTP

- Auth: `POST /auth/login`, `POST /auth/register`, `POST /auth/sse-token`,
  `GET /usuarios/me`, `GET /estabelecimentos`.
- Dashboard: `GET/POST/PUT/DELETE /usuarios`, `GET/POST/PUT/DELETE /produtos`,
  `GET/POST/PUT/PATCH/DELETE /tipos`, `GET/POST/PUT/DELETE /pedidos`,
  `POST /pedidos/:id/status`, `GET/POST/DELETE /vendas`.
- Gráficos: `GET /graficos`, `/graficos/lista`,
  `/graficos/vendas-por-horario`, `POST /graficos/relatorio` e polling de
  status/download do relatório.
- Realtime: `getSseToken()` e uma `EventSource` compartilhada para `/events`;
  tipos de evento atuais são `pedidos` e `vendas`.
- Não há consumidor direto de `/sincronizacao/push` ou `/pull` no front; o
  consumidor é o mobile. O front, porém, compartilha os mesmos nomes/status do
  wire em listas, filtros e SSE.

## Campos e adapters atuais

`src/services/api.ts` só centraliza Axios, bearer token, logout em 401 e
`getErrorMessage(error, fallback)` lendo `response.data.message`. Não há
normalização de DTO, `error.code` ou serializer explícito. Há aliases pontuais
em `ProductsPage` (`editavel`/`isEditable`, `color`/`cor`) e em auth
(`name`/`nome`), mas não uma política única.

`src/services/parseResponse.ts` aceita arrays sob chaves como `vendas` e
`fechamento`. `src/services/vendas.ts` normaliza número/data e converte a
resposta de venda para um modelo de renderização que ainda usa
`criado_por`/`criado_por_nome`. O serviço de venda também envia query params
portugueses (`dataInicial`, `dataFinal`, `cliente`, `totalMin`, `totalMax` e
`timezoneOffsetMinutes`).

## Divergências/bloqueios para revisão

1. O front não tem camada DTO legado separada do domínio; várias páginas
   consomem objetos Prisma/wire diretamente.
2. Strings visíveis, mensagens de erro e labels de status estão hardcoded em
   português; não existe i18next, bundle, checker ou persistência de locale.
3. O fallback de erro compara somente `message`; o spec requer codes estáveis
   e tradução de codes conhecidos, sem comparação de texto português.
4. Não existe provider de direção/`html[lang]`/`html[dir]`; Tailwind e o design
   system ainda precisam de auditoria RTL.
5. Moeda e formatação ainda usam regras/labels brasileiras em componentes e
   utilitários; locale ativo ainda não participa de `Intl`.
6. A API pode retornar campos camelCase do Prisma no pull e o dashboard não
   possui adapter para distinguir esse formato do legado.
7. `NAO_FECHADOS` é enviado pelo layout, mas a API mantém a constante
   `NAO_FECHADO`; decisão deve ocorrer antes de T5/T6.
8. Nenhuma mudança da T0 deve tocar `audit-context/`.

## Baseline executado

| Comando | Resultado real |
|---|---|
| `bun test` | exit 0; **43 pass, 0 fail**, 82 expect calls, 11 arquivos |
| `bunx tsc --noEmit` | exit 0, sem saída |
| `bun run build` | exit 0; `tsc` + Vite 5.4.21, 2331 módulos transformados, build em 5.69 s |

O build emitiu somente o aviso de `caniuse-lite` desatualizado. O diretório
`dist/` não foi incluído no commit T0.

## Limitações

`rg` não está disponível e `rtk` não iniciou por HOME ausente; o inventário
usou `git ls-files`/`git grep` e leitura direta. Não foram executados sync,
browser QA, Android, deploy, push, merge ou PR.

