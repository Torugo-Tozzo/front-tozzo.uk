# Task 11 (front) — Review

## Spec compliance

✅ **1. Domain model** — `Order` usa `isOpen` e `OrderItem` tem `OrderItemStatus` obrigatório; o `OrderStatus` antigo não é mais exportado. Referência: `src/domain/models.ts:3,38-58`.

✅ **2. Status library** — o mapa/opções/normalização/cor do status de pedido foi removido; ficaram as três opções de status por item e os labels correspondentes. Referências: `src/lib/status.ts:1-10`, `src/i18n/labels.ts:7-11,65-68`.

✅ **3. PedidosTab** — removeu filtro e coluna/status de pedido, usa o GET sem `status`, mantém o fechamento canônico com `{ isOpen: false }`, propaga id/status dos itens e faz PATCH por item seguido de refetch. Referências: `src/components/dashboard/PedidosTab.tsx:30-76,117-163,229-300,313-340`.

✅ **4. ProductSelectionModal** — removeu `initialStatus`/`onChangeStatus`, adicionou id/status opcionais e `onChangeItemStatus`; o seletor só aparece com callback, id/status válidos e fora de `readOnly`; o fechamento virou ação separada com confirmação. Referências: `src/components/ProductSelectionModal.tsx:33-63,118-148,241-256,423-505`.

✅ **5. VendasTab** — não depende mais de `getStatusColor`/status de pedido e continua passando o modal em modo de venda/visualização sem callback de status por item. Referências: `src/components/dashboard/VendasTab.tsx:323-332,384-432`.

✅ **6. i18n** — labels `requested`, `inPreparation`, `delivered`, `itemStatus` e erros de fechamento/PATCH foram atualizados nos seis locales; as chaves antigas de status de pedido ficaram sem uso. Referências: `src/i18n/labels.ts:7-11`, `src/i18n/locales/en.json:333,581-601` (mesma alteração em `es`, `fr`, `hi`, `pt-BR` e `zh`), `src/i18n/ui-inventory.test.ts:476-515`.

✅ **7. Testes** — há cobertura do PATCH com itemId/status e estados mistos, do modal/status-select, da serialização do wire e da venda sem controles de status. Referências: `src/components/dashboard/PedidosTab.test.tsx:67-125`, `src/components/dashboard/orders-sales-chrome.test.tsx:92-128`, `src/components/ui/status-select.test.tsx:17-44`, `src/services/api.test.ts:52-68`.

✅ **8. Verificação final** — o worker registra suíte, `tsc --noEmit`, build e i18n aprovados. Nesta revisão, `bun test` reproduziu `117 pass / 0 fail`, `bunx tsc --noEmit` terminou com exit 0 e `bun run i18n:check` aprovou 6 locales/14 namespaces. Referência do registro do build: `docs/superpowers/sdd/2026-08-27-fase-7-t11-front-worker.md:60-67`.

## Pontos de atenção específicos

1. ✅ **Fluxo de venda preservado.** O seletor exige `!readOnly && onChangeItemStatus`; `VendasTab` não passa esse callback, e o bloco de `onCancelSale`/modo somente leitura permanece ativo. A leitura é reforçada pelo teste de visualização de venda sem combobox/labels. Referências: `src/components/ProductSelectionModal.tsx:423-432,508-545`, `src/components/dashboard/VendasTab.tsx:323-332`, `src/components/dashboard/orders-sales-chrome.test.tsx:92-128`.

2. ✅ **Nenhum POST intermediário sobreviveu em código/testes.** A busca própria encontrou apenas o fechamento em `src/components/dashboard/PedidosTab.tsx:288-290` e seu teste de serialização em `src/services/api.test.ts:65`; não há body com `IN_PREPARATION`/`DELIVERING` nesse endpoint.

3. ✅ **`legacyWire` não converte status do PATCH de item.** A URL do endpoint resolve para `orderItem`, e esse contexto preserva o valor canônico; o fechamento continua usando `isOpen` e o mapeamento legado explícito permanece restrito à compatibilidade de ordem. Referências: `src/lib/legacyWire.ts:131-141,210-229`, `src/components/dashboard/PedidosTab.tsx:288-299`, `src/services/api.test.ts:65-66`, `src/lib/legacyWire.test.ts:113-121`.

4. ✅ **`StatusSelect` foi reaproveitado corretamente para item.** O componente agora é tipado com `OrderItemStatus` e lista exatamente as três opções novas; não é um seletor genérico de status de pedido antigo nem ficou órfão. Referências: `src/components/ui/status-select.tsx:8-35`, `src/components/ui/status-select.test.tsx:17-44`.

5. ✅ **Remoção da coluna é razoável.** Como a listagem depende do default `isOpen=true`, todos os registros exibidos têm a mesma abertura; `Recent orders` permanece como contexto da tabela e o status operacional fica no modal de edição. Não há variação útil que justificasse manter coluna, cor ou filtro. Referências: `src/components/dashboard/PedidosTab.tsx:117-123,325-340`, `src/pages/dashboard/OrdersPage.tsx:15-20`.

6. ✅ **Contador preserva o significado esperado.** `DashboardLayout` solicita `/pedidos` apenas com `limit=1`, removendo `status=NOT_CLOSED`; conforme o contrato, a ausência de `isOpen` usa o default `true`, e o total continua vindo de `x-total-count`. Referência: `src/layouts/DashboardLayout.tsx:166-175`.

## Achados

Nenhum achado.

## Veredito

Aprovado
