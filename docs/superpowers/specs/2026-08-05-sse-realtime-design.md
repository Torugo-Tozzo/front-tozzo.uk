# Realtime via SSE — design

Data: 2026-08-05. Fase 3 do `plano.md` (raiz do monorepo `C:/RN`) — troca do polling do dashboard por Server-Sent Events.

## Contexto

O front hoje tem 4 pontos de polling:
- `src/layouts/DashboardLayout.tsx:104` — badge de pedidos não fechados, `setInterval(fetchCount, 15000)`
- `src/pages/dashboard/ChartsPage.tsx:352` — poll de status de relatório assíncrono
- `src/pages/dashboard/OrdersPage.tsx:142` — `setInterval(poll, 8000)`
- `src/pages/dashboard/SalesPage.tsx:144` — `setInterval(poll, 8000)`

O poll do `ChartsPage` é um problema diferente (status de job assíncrono, de um usuário só, com fim natural em minutos) — **fica fora do escopo**, continua como está. O escopo aqui é os outros 3: badge, `OrdersPage`, `SalesPage`.

### Histórico — já existiu SSE aqui

SSE foi implementado e revertido no mesmo dia (2026-01-01, api commits `0d60861`→`79423b4`→`83ce1ae`, front `52a9a7f`→`ab77e11`→`4e62c25`). Motivo confirmado com o usuário: falta de tempo pra resolver os bugs pontuais da v1, não uma limitação técnica de fundo — optou pelo caminho mais simples (polling) pra não travar a entrega. Agora com mais tempo, retomando.

**O que a v1 tinha de frágil** (evitar repetir):
- Front usava `fetch()` + `ReadableStream` manual (parse de `data:` na mão, reconexão via `setTimeout` própria) em vez de `EventSource` nativo — porque `EventSource` não manda header `Authorization` customizado.
- Tentava fazer patch incremental de estado local a partir do payload do evento (`setCount(c => c+1)`) em vez de só re-buscar — superfície de bug (estado local podendo dessincronizar do servidor).
- Servidor: `Map` em memória por `estabelecimentoId` em `lib/sse.ts` — arquitetura correta pro tamanho atual (deploy é 1 container por ambiente, sem réplica — confirmado via SSH, `docker ps` no servidor).
- Nginx do servidor (`nginx-proxy`, `default.conf`) não tem bloco dedicado pro endpoint de stream — sem `proxy_buffering off`, evento pode ficar retido no buffer em vez de chegar em tempo real. Domínios (`api.tozzo.uk`/`dev-api.tozzo.uk`) resolvem pra IP da Cloudflare (proxy), TLS termina lá — outra camada que precisa de headers corretos + heartbeat pra não fechar conexão idle (~100s de timeout).

## Arquitetura

```
Front (dashboard)                          API
  |  POST /auth/sse-token (Bearer normal)   |
  |----------------------------------------->|
  |  <----------------- token curto (5min) --|
  |                                          |
  |  GET /events?token=xxx (EventSource)     |
  |----------------------------------------->|
  |  <==== stream aberto, heartbeat 25s =====|  lib/sse.ts
  |                                          |  Map<estabelecimentoId, Set<Response>>
  |  <-- data: {"tipo":"pedidos"} ---(mutação)
```

- **Event bus**: `Map` em memória, mesma base da v1. Redis/outbox no banco descartados por YAGNI — só fazem sentido se a API escalar pra múltiplas instâncias, o que não é o caso hoje.
- **Emissores**: `pedidos.controller.ts`, `vendas.controller.ts` (ações do dashboard) + `sincronizacao.controller.ts` (push do app mobile via `/sincronizacao`) — 1 evento por request/transação, nunca por item individual dentro de um batch.
- **Fora do escopo**: `ChartsPage` (job de relatório fica polling), múltiplas instâncias da API (Map em memória não escala pra isso — documentar a limitação, não resolver agora).

## Componentes

### API — `lib/sse.ts` (novo)

```ts
sseClients: Map<estabelecimentoId, Set<Response>>

sendEvent(estabelecimentoId: string, tipo: 'pedidos' | 'vendas'): void
  // escreve `data: {"tipo":"..."}\n\n` em cada Response do estabelecimento
  // try/catch por client — um write quebrado não derruba os outros

streamEvents(req: AuthRequest, res: Response): void  // handler de GET /events
  // headers: Content-Type: text/event-stream, Cache-Control: no-cache, X-Accel-Buffering: no
  // registra `res` no Set do estabelecimento
  // heartbeat `: keep-alive\n\n` a cada 25s
  // req.on('close') remove do Set
```

### API — auth do stream

`EventSource` nativo não manda header customizado — só cookie ou query string. Decisão: **token dedicado de curta duração via query string**, não o JWT principal de 30d (evita token de vida longa em log de acesso do nginx / histórico do browser).

- `POST /auth/sse-token` — protegido pelo `authenticate` padrão (Bearer, JWT normal). Emite JWT novo: `{ id, estabelecimentoId, purpose: 'sse' }`, expira em 5min.
- `GET /events?token=xxx` — middleware próprio (lê `req.query.token`, não header). Valida assinatura + expiração + `purpose === 'sse'` (segunda camada — token com purpose errado é rejeitado mesmo com assinatura válida, caso vaze em log). 401 antes de abrir o stream se inválido.

### API — pontos de emissão

| Controller | Métodos | Evento |
|---|---|---|
| `pedidos.controller.ts` | `criarPedido`, `alterarStatusPedido`, `atualizarPedido`, `excluirPedido` | `sendEvent(estabelecimentoId, 'pedidos')` |
| `vendas.controller.ts` | `criarVenda`, `cancelarVenda` | `sendEvent(estabelecimentoId, 'vendas')` |
| `sincronizacao.controller.ts` | `sincronizar`/`push` (não `obterAlteracoes`/`pull` — esse só lê, não muda nada) | `'pedidos'` se algum pedido mudou no batch, `'vendas'` se alguma venda mudou (dedup, não por item) |

Os comentários `// SSE removed: notification suppressed` já presentes nesses controllers (api repo) marcam exatamente onde entra a chamada nova.

### Front — `useRealtimeEvents` (novo hook)

```ts
useRealtimeEvents(tipos: ('pedidos'|'vendas')[], onEvent: (tipo) => void)
  // mint token via POST /auth/sse-token (axios normal, já autenticado)
  // new EventSource(`${base}/events?token=${token}`)
  // onmessage: parseia, chama onEvent se tipo bate com o que foi pedido
  // timer interno ~4min: fecha e abre com token fresco (proativo, antes dos 5min expirar)
  // erro transiente: deixa o EventSource nativo reconectar sozinho (token ainda válido)
```

- `DashboardLayout.tsx`: badge chama `fetchCount()` (já existe) no evento `'pedidos'`. `setInterval` de 15s vira fallback de 60s (rede de segurança, SSE é o caminho principal).
- `OrdersPage.tsx`/`SalesPage.tsx`: evento dispara refetch da view atual (respeita filtro/página ativos). `setInterval` de 8s vira fallback bem mais espaçado.

## Fluxo de dados

1. Dashboard carrega → `useRealtimeEvents` minta token → abre `EventSource`.
2. API registra a conexão em `Map[estabelecimentoId]`.
3. Mutação acontece (dashboard ou sync do mobile) → controller chama `sendEvent`.
4. API escreve o evento em todo `Response` conectado daquele estabelecimento.
5. Front recebe, refetch na rota que já usa — sem tentar reconstruir estado local a partir do payload.

## Tratamento de erro

| Cenário | Tratamento |
|---|---|
| `res.write` falha (client caiu) | `try/catch` isolado por client |
| Conexão cai (rede, aba em background) | `EventSource` nativo reconecta sozinho, token ainda válido dentro dos 5min |
| Token expira | Front troca proativamente a cada ~4min — na prática nunca expira em conexão ativa |
| Nginx/Cloudflare mata conexão idle (~100s) | Heartbeat a cada 25s |
| Múltiplas abas abertas | Cada uma registra seu próprio `Response` no `Set` — sem dedup necessário |
| `/events` com token inválido | 401 antes de abrir o stream |

## Infra — nginx (fora do código, precisa confirmação antes de aplicar)

`default.conf` no servidor (`/home/victor/nginx-proxy/`) hoje tem só `location /` genérico pra `dev-api.tozzo.uk` e `api.tozzo.uk`, sem tratamento especial pro stream. Precisa de um `location /events` dedicado nos dois `server` blocks com `proxy_buffering off` (e `proxy_read_timeout` alto, já que a conexão fica aberta por minutos). Mudança em infra compartilhada (dev e prod no mesmo `nginx-proxy`) — entra no plano de implementação, aplicada só com confirmação explícita na hora.

## Testes

**API** (`mock.module`, mesmo padrão dos 123 testes existentes):
- `lib/sse.ts`: mock de `Response`, confere formato do `data:`, client caído não derruba os outros, `close` remove do `Set`.
- `pedidos`/`vendas`/`sincronizacao` controller tests: mock de `lib/sse`, confere `sendEvent` chamado com `estabelecimentoId`/`tipo` certos — e que **não** dispara em caminho de erro.
- `tests/api-surface.known-endpoints.ts` precisa registrar `POST /auth/sse-token` e `GET /events` — o radar (`tests/api-surface.test.ts`) força isso sozinho.

**Front** (Vitest, mesmo padrão de `feat/test-setup-front`):
- `useRealtimeEvents`: mock global de `EventSource` (jsdom não tem nativo) — filtro por `tipo`, timer de refresh trocando conexão, erro transiente não derruba o hook.

**Fora de teste automatizado**: nginx+Cloudflare+SSE juntos não dá pra testar sem o ambiente real. Checklist manual pós-deploy: 2 abas em `dev.tozzo.uk`, fechar pedido numa e ver a outra atualizar sem F5; deixar aba parada 3-4min pra confirmar que heartbeat/refresh de token não derruba a conexão.
