# Design System — Front (Fase 4) — spec em andamento

> Brainstorm iniciado 2026-08-06. Companion visual usado (`.superpowers/brainstorm/` na raiz `C:/RN`). Branch: `feat/design-system-front`. Status: **lista de pedidos aprovada, tela "Atendimento" (Pedidos+Vendas+Produtos) decidida em nível conceitual**, resto do escopo (Badge, EmptyState, tabs do `DashboardLayout`, botões fora do preview, `EmployeesPage`) ainda em aberto.

## Contexto

Auditoria prévia (`docs/design-system-audit.md`, 2026-08-04) achou que o front já usa bem a base shadcn — faltavam só `Badge` e `EmptyState` como primitivas. Direção "tema papel" cogitada inicialmente foi **descartada** em favor de pesquisa de mercado (Toast=laranja/vermelho, Square=preto/branco, Clover=verde — nenhum concorrente usa monocromático+cor de marca do jeito que a Tozzo pode, é diferencial real).

## Paleta de marca — decidido

Cores do logo: **preto `#000000`, branco `#FFFFFF`, cinza `#454545`**. Cores de status são semânticas, à parte da paleta de marca (não usar tons de marca pra status).

**Light mode:**
- Fundo geral / container de tabela: `#FFFFFF`
- Fundo das linhas/cards: creme `#FAF6F0` (fundo puro branco/cinza "machucava os olhos" — creme é o ajuste)
- Borda: `rgba(69,69,69,.18)`
- Texto primário: `#000000` / secundário: `#454545`
- Botão primário: fundo `#000000`, texto `#FFFFFF`

**Dark mode:**
- Fundo geral: `#161616` (cinza bem escuro — **não** preto puro `#000`, testado e rejeitado por ficar pesado)
- Fundo das linhas/cards: `#454545` sólido (cinza da marca)
- Borda: `#5c5c5c`
- Texto primário: `#FFFFFF` / secundário: `rgba(255,255,255,.7)` (o cinza `#454545` teria contraste ruim como texto sobre fundo preto, por isso não reaproveitado pra texto secundário no dark)
- Botão primário: fundo `#FFFFFF`, texto `#000000` (inverte do light)

Controles de ação (select de status, botões de ícone) usam **branco puro fixo** (`#FFFFFF` bg, `#000000` texto) nos dois temas — não seguem a variável de tema, viram um "chip" de ação consistente. (Bug corrigido no processo: usar `var(--bp-text)` neles fazia o texto sumir no dark, já que ficava branco sobre fundo branco.)

## Cores de status — mapa novo (semântica por urgência, não por "fase burocrática")

Baseado no enum real (`OrdersPage.tsx`, `Select` de status): `ABERTO` / `EM_PREPARO` / `ENTREGANDO` / `FECHADO`.

| Status | Cor | Significado |
|---|---|---|
| `ABERTO` | vermelho `#dc2626` | aguardando a cozinha começar — urgente, precisa de atenção |
| `EM_PREPARO` | âmbar `#d97706` | em preparo |
| `ENTREGANDO` | azul `#2563eb` | mesa comendo o que pediu, conta ainda aberta, sem pedido novo pendente |
| `FECHADO` | cinza `#6b7280` | pago/fechado |

Racional: pesquisa de mercado mostrou que KDS de cozinha usa cor por urgência/tempo de espera — vermelho pra "precisa agir" bate com essa prática, em vez de vermelho = erro/perigo genérico.

**Mudança de comportamento (não só visual, flagar antes de implementar):** o seletor de status deve aparecer **mesmo em pedidos `FECHADO`** — hoje `OrdersPage.tsx` esconde o seletor quando `status === 'FECHADO'` (`order.status !== 'FECHADO' && (...)`). Decisão do usuário é permitir reabrir pedido fechado via UI. Confirmar esse comportamento no backend/regra de negócio antes de implementar (hoje não há endpoint/regra pensada pra "reabrir").

## Lista/tabela de pedidos — aprovado

Reformulação de `OrdersPage.tsx` (tabela `Pedidos Recentes`), mantendo as colunas reais já existentes:

`#` | `Cliente/Mesa` | `Criado por` | `Status` | `Data` | `Total` | `Ações`

- **Cliente/Mesa**: nome em negrito + linha secundária embaixo com itens do pedido por extenso (ex: `1x Porção de Fritas, 2x Coca-Cola, 1x X-Bacon`), texto truncado com `text-overflow:ellipsis` se muito longo. Não é feature nova de dado — só precisa que a lista já tenha os itens carregados (hoje só carrega ao abrir o modal de edição, verificar custo de trazer isso na listagem).
- **Status**: em vez de badge estático, é um `<select>` funcional (já existe hoje) com borda de 2px na cor do status — a cor comunica o status sem precisar de legenda separada (legenda foi tentada e removida a pedido do usuário).
- **Ações**: 3 botões de ícone, nessa ordem: Imprimir (novo — ver Fase 6), Editar, Excluir. Ícones da lib já usada no projeto (`lucide-react`), **não emoji** (mockup usou emoji só por limitação do HTML solto do companion) — `Printer`, `Pencil` (já importado em `OrdersPage.tsx` hoje), `Trash2` (idem).
- **Linha**: barra de cor de 4px na borda esquerda da primeira célula (mesma cor do status), fundo distinto do container (creme no light / `#454545` no dark — bug real corrigido no processo: CSS inválido deixava a linha com o mesmo fundo da página, dificultando leitura pra usuário com mais idade, relato explícito do usuário), borda delimitando toda a linha.
- **Hover**: `transform: scale(1.012)` + `box-shadow` de elevação. Confirmado que `transform` em `<tr>` é só efeito de pintura (não afeta o layout/alinhamento das colunas), seguro de usar em tabela de verdade.
- **Header da tabela**: alinhamento leve (esquerda por padrão, `#` centralizado, `Total`/`Ações` à direita) — tentativa de centralizar tudo foi revertida a pedido do usuário ("tava melhor antes").

Mockup final aprovado vive em `C:/RN/.superpowers/brainstorm/1735-1786014459/content/brand-palette.html` (arquivo de trabalho do companion, não é código de produção — serve de referência visual pro dev que for implementar).

## Tela "Atendimento" — nova página inicial do dashboard (decidido em nível conceitual)

**Motivação**: hoje `Pedidos`, `Vendas`, `Produtos` e `Funcionários` são módulos separados no menu. `Funcionários` continua separado (não tem motivo pra unificar). Mas `Pedidos`/`Vendas`/`Produtos` cruzam no fluxo de trabalho real — ex: criar um produto novo na hora de uma venda rápida, sem ele existir ainda no catálogo. Unificar os 3 numa tela só com abas resolve isso.

**Nome escolhido**: "Atendimento" (termo do dia a dia de quem trabalha em restaurante — cobre pedido, venda e busca de produto num fluxo só). Vira a **nova página inicial do dashboard**, substituindo `OrdersPage` como landing.

**3 abas internas**, aba padrão = Pedidos:

1. **Pedidos** — a tabela redesenhada já aprovada (ver seção acima): `#`/Cliente-Mesa+itens/Criado por/Status(select colorido)/Data/Total/Ações. Filtro default nos não-fechados (mantém comportamento de hoje).
2. **Vendas** — reaproveita o mesmo componente de tabela (`Table`/`TableRow` com a mesma variante visual), mas **sem** seletor de status — venda é registro final/histórico, não muda de estado. Colunas: `#`/Cliente-Mesa+itens/Criado por/Data/Total/Ações (só Imprimir + ver detalhe — sem editar/excluir). O botão "Info" que `SalesPage.tsx` tem hoje (linha ~429, coluna dedicada) **some** — fica redundante já que os itens aparecem direto na linha, como na aba Pedidos.
3. **Produtos** — **não é** a `ProductsPage` completa (essa continua existindo separada no menu, pra gestão completa: editar, tipos/categorias, etc — decidido explicitamente que as duas convivem). Aqui é uma visão leve: busca por nome no topo + lista compacta (Nome/Tipo/Preço) com botão de adicionar rápido à venda/pedido em andamento, mais um botão "Produto novo" que abre um form mínimo (Nome/Preço/Tipo, reaproveitando o mesmo `Select` de tipo que `ProductsPage` já usa) — sem os campos/fluxo completo da página de gestão. Resolve diretamente o caso de uso citado pelo usuário: precisar de um produto que não existe no catálogo no meio de uma venda rápida. Avaliar se reaproveita o `ProductSelectionModal.tsx` existente (já faz busca+seleção de produto pra pedido) em vez de construir do zero.

**Botão de ação principal** (topo da tela, mesmo botão preto/branco da paleta) troca de label/ação conforme a aba ativa: "+ Novo Pedido" / "+ Nova Venda" / "+ Novo Produto".

**Não decidido ainda**: rota/URL da tela nova (hoje `/` ou equivalente deve ir pra `OrdersPage` — precisa apontar pra "Atendimento"), o que acontece com a rota antiga de `OrdersPage`/`SalesPage` isoladas (viram redirect pra `/atendimento?tab=pedidos` ou continuam existindo como rotas diretas também?), e o layout de wireframe real da tela (isso foi decidido em nível conceitual/texto, não passou pelo companion visual ainda).

## Logo — trocado por SVG (feito nesta sessão)

O `logo.png` original (1024×1024) tinha 2 defeitos confirmados por análise de pixel: círculo cortado (canvas menor que o desenho — raio real ~520-526 nas diagonais, mas cortado a ~511-512 nos eixos cardeais, então topo/base/laterais ficavam achatados) e pixels de franja mal recortados. Fonte original (Canva) não tem vetor de verdade da marca — testado via export de PDF gratuito: o círculo/arcos/TOZZO inteiro é raster (308×295, pior que o PNG de produção), só o texto ".uk" e uns retoques eram vetor de verdade lá.

Usuário conseguiu (fora desta sessão) consertar o círculo e gerar um SVG limpo por conta própria: `LOGO-TOZZO-UK.svg`. Aplicado no front nesta sessão:

- `src/assets/images/logo.svg` (substitui `logo.png`, removido) — usado em `Navbar.tsx`, `LoginPage.tsx`, `DashboardLayout.tsx` (só trocou a extensão do import, `.png`→`.svg`).
- `public/logo.svg` (substitui `public/logo.png`, removido) — favicon em `index.html` (`<link rel="icon" type="image/svg+xml" href="/logo.svg" />`).

**Decisão de cor**: o SVG novo ficou só preto+branco (perdeu o anel cinza `#454545` que o PNG original tinha — confirmado por amostragem de pixel do arquivo antigo, era literalmente `rgb(69,69,69)` = o mesmo cinza da paleta de marca desta sessão). Perguntado ao usuário se queria devolver o cinza no anel — resposta: **não, deixa preto+branco mesmo**. Logo oficial agora é bicolor, não tricolor.

**Pendente**: aplicar o mesmo SVG no app mobile (`TozzoBurger`) — usuário pediu explicitamente "depois", não faz parte desta sessão.

## Implementação — restrição importante

O mockup do companion (HTML solto, cores hardcoded inline) é só material de referência visual pra aprovação, **não é o padrão de código a seguir**. Na implementação real:

- **Tokens de cor viram variáveis de tema** (`src/index.css`, no padrão `--background`/`--primary` que já existe hoje) — nada de hex hardcoded espalhado em componente de página. Paleta de marca (`#000`/`#fff`/`#454545`) e cores de status (`#dc2626`/`#d97706`/`#2563eb`/`#6b7280`) entram como tokens novos, não `style={{ color: '#dc2626' }}` inline.
- **Componentes reutilizáveis em `components/ui/`**, não estilo duplicado por página (é exatamente o problema que a auditoria original achou — 4 badges implementados na mão). Pelo menos:
  - `StatusSelect` (ou estender o `Select` existente) — encapsula a borda colorida por status, usa o token de cor certo a partir do enum, não string de status batida na mão em cada página.
  - `IconButton` — os botões de ação (Printer/Pencil/Trash2, ícones `lucide-react`) viram um componente único com variant, não 3 `<button>` copiados por linha.
  - `Badge` (já previsto na auditoria original) — reaproveitar o mesmo mapa de cor por status do `StatusSelect`, uma fonte de verdade só.
  - A linha da tabela (barra de cor + hover) vira classe/variante reutilizável do `Table`/`TableRow` de `components/ui/table.tsx`, aplicável em `SalesPage` também (mesmo padrão, não reinventar por página).
- Mapa "status → cor" deve viver em **um lugar só** (ex: `lib/status.ts` ou similar), consumido por `StatusSelect`, `Badge` e a barra de cor da linha — não 3 implementações divergentes do mesmo mapa (é literalmente o Achado #1 da auditoria original se repetindo).

## Em aberto — não brainstormado ainda

- Aplicar o mesmo padrão de paleta/status nas outras páginas de listagem (`SalesPage`, `ProductsPage`, `EmployeesPage`) — só `OrdersPage` foi desenhado até agora.
- `Badge` e `EmptyState` (achados da auditoria original) — ainda não desenhados com a paleta nova.
- Tabs de navegação do dashboard (`DashboardLayout`) — só um preview simples de abas apareceu no mockup, não foi validado como padrão final.
- Botões (`Button` do `components/ui`) — só primário/secundário simples apareceram no mockup, variantes (destructive, ghost, outline) não cobertas.
- Responsividade/mobile do dashboard web — fora do escopo até agora.

## Fase 5 (mobile) e Fase 6 (impressão) — não iniciadas nesta sessão

Ver `plano.md` na raiz — Fase 5 (design system mobile) ainda precisa de brainstorm dedicado (áudito já existe: `TozzoBurger/docs/design-system-audit.md`). Fase 6 (impressão de pedido/venda no site) também não brainstormada — a coluna "Ações" acima já reserva o botão 🖨️ mas o fluxo de impressão em si (formato, PDF vs print nativo do navegador, layout do recibo) ainda não foi desenhado.
