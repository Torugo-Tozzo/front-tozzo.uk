# Fase 7 — Task 11 front: relatório do worker

Data: 2026-08-28  
Branch: `feat/fase-7-sync-status-categoria`  
Escopo: migração do modelo de status de pedido para `isOpen` e status por item.

## O que foi feito

- `Order` agora usa `isOpen: boolean`; `OrderItem` agora usa o tipo
  `OrderItemStatus` com `REQUESTED`, `IN_PREPARATION` e `DELIVERED`.
- O fluxo de pedidos deixou de filtrar/enviar status de pedido. A listagem usa o
  default de pedidos abertos da API, não faz filtragem client-side de `CLOSED` e
  não possui mais coluna, cor ou seletor de status de pedido.
- O fechamento usa `POST /pedidos/:id/status` com `{ isOpen: false }`.
- A edição de pedido propaga `id` e `status` dos itens e atualiza um item por vez
  com `PATCH /pedidos/:id/items/:itemId` e `{ status }`, seguido de refetch.
- `ProductSelectionModal` recebeu status opcional/id opcional em `SelectedItem` e
  um `onChangeItemStatus` opcional. O seletor de item aparece somente no modal de
  edição de pedido quando esse callback é fornecido; criação de pedido e venda não
  exibem status.
- O antigo seletor de status geral foi substituído por um botão explícito de
  fechamento no modal de edição. A venda preservou seus controles de cancelar,
  visualizar e imprimir; a cor de status fixo foi removida da tabela de vendas.
- Labels, mensagens de erro e inventário de i18n foram atualizados nos seis
  locales suportados.
- O adaptador `legacyWire` ganhou contexto específico para o PATCH de item, para
  não converter `REQUESTED`/`IN_PREPARATION`/`DELIVERED` para códigos legados.
  Os mapeamentos legados restantes em `domain/dtos.ts`/`legacyWire.ts` foram
  mantidos apenas como compatibilidade da borda HTTP, não como modelo ou lógica
  de UI de pedido.
- O contador de pedidos do `DashboardLayout` deixou de enviar o filtro legado
  `status=NOT_CLOSED` e passou a depender do default de pedidos abertos.

## Decisões de UX

- A coluna de status foi removida da tabela de pedidos. Como a listagem já retorna
  somente pedidos abertos por default e o único estado de pedido restante é
  `isOpen`, uma coluna teria o mesmo valor para todas as linhas e não ajudaria na
  leitura. O status operacional relevante agora fica visível/editável por item
  dentro do modal de edição.
- O fechamento ficou em um botão separado `Fechar pedido`, com uma confirmação
  única e a mensagem existente que informa que o pedido vira uma venda. A
  confirmação ficou no modal compartilhado, enquanto o callback do `PedidosTab`
  apenas executa a operação HTTP; assim o fluxo não confirma duas vezes e erros da
  API chegam ao modal para feedback.
- A alteração de status do item é imediata, sem confirmação adicional, porque a
  API permite transição livre entre os três estados. O seletor fica desabilitado
  enquanto o PATCH/refetch está em andamento; o estado local só muda após o
  callback concluir com sucesso.
- O modal de venda (`VendasTab`) não recebe `onChangeItemStatus`, portanto não
  mostra seletor nem label de status por item.

## TDD e verificação

Os testes de status, modal, tabela, API e `PedidosTab` foram atualizados/criados
antes da implementação. A execução direcionada inicial falhou conforme esperado
por ainda encontrar os estados/coluna/seletor antigos; depois da implementação,
os testes passaram.

Comandos finais e resultados:

- `bun test` — **117 pass, 0 fail**, 461 expectativas, 28 arquivos.
- `bunx tsc --noEmit` — **passou**.
- `bun run build` — **passou** (`tsc && vite build`, 2373 módulos).
- `bun run i18n:check` — **passou**, 6 locales e 14 namespaces.
- `rtk git diff --check` e `rtk git diff --cached --check` — sem problemas de
  whitespace.

A suíte ainda imprime o log esperado do teste de autenticação com resposta 402 e
avisos preexistentes de `act(...)` em `printReceipt`; nenhum deles causou falha.
O build mantém apenas os avisos já conhecidos de dados desatualizados do
Browserslist e chunks maiores que 500 kB.

## Self-review

- Busca no código de produção confirmou que não restaram `statusFilter`,
  `initialStatus`, `onChangeStatus`, `getStatusColor` ou `changeOrderStatus`.
- A única chamada a `POST /pedidos/:id/status` restante é a de fechamento com
  `{ isOpen: false }`; não há POST intermediário com `IN_PREPARATION` ou
  `DELIVERING`.
- O teste de `PedidosTab` cobre um pedido com dois itens em estados diferentes e
  verifica que somente o item escolhido recebe o PATCH correto.
- O teste integrado de orders/sales verifica a remoção da coluna e que a
  visualização de venda não expõe combobox ou labels de status.
- Durante a revisão foram encontrados e corrigidos a confirmação duplicada do
  fechamento, o engolimento de erros dos callbacks no `PedidosTab` e a referência
  stale do inventário de i18n após mover a confirmação para o modal.
- Não houve push, mudança de branch ou alteração nos documentos preexistentes do
  diretório `docs/superpowers/sdd`. Esses documentos, assim como este relatório,
  não foram incluídos no commit de código/teste.

## Commit

- `b983e0e1fbd1e56214d7ce88103562824b8796c8` — `feat: migrate order status to item workflow`

