# Auditoria — Design System (Front)

> Gerado por auditoria automatizada, 2026-08-04. Prep pra Fase 4 do `plano.md` (raiz do projeto). Read-only — nenhum código foi alterado.

## Resumo

Achado principal: **não é falta de kit, é falta de 2 primitivas** (`Badge` e `EmptyState`). A base shadcn-style em `src/components/ui/` (button, input, card, dialog, select, tabs, skeleton, table, label, dropdown-menu) já está **bem adotada** — todas as 6 páginas de dashboard e o modal principal importam dela corretamente. Não achei nenhum `<button>`/`<input>`/`<select>` nativo fora dos próprios arquivos de `ui/`.

O problema real são os casos que a base não cobre: cada página resolveu "badge de status" e "estado vazio" na mão, cada uma de um jeito.

Páginas auditadas (11): `ChartsPage`, `EmployeesPage`, `OrdersPage`, `ProductsPage`, `SalesPage`, `SettingsPage`, `LandingPage`, `LoginPage`, `NotFoundPage`, `PaymentSuccessPage`, `PlanSelectionPage`. Componentes fora de `ui/`: `Navbar`, `Footer`, `Pagination`, `ProductSelectionModal`, `LoadingOverlay`, `ProtectedRoute`, `theme-provider`, `mode-toggle`.

## O que já está consistente (baseline correto, não mexer)

- Import de `ui/` em todas as páginas de dashboard: `Card`/`CardContent`/`CardHeader`/`CardTitle`, `Button`, `Input`, `Label`, `Skeleton` — presentes em `EmployeesPage`, `ProductsPage`, `SalesPage`, `OrdersPage`, `ChartsPage`.
- `Table` (ui/) usado nas 5 páginas de listagem.
- `ProductSelectionModal.tsx` usa `Dialog`/`DialogContent`/`DialogHeader` corretamente — **não** é modal customizado (checado direto, sem `fixed inset-0` próprio).
- Container de página padronizado: `<div className="space-y-6">` no topo de `SettingsPage`, `OrdersPage`, `EmployeesPage`, `ChartsPage`, `SalesPage`, `ProductsPage` — 6/6 idêntico.
- Overlays reais (`fixed inset-0 z-50 bg-background/80 backdrop-blur-sm`) só existem em 2 lugares legítimos: `DashboardLayout.tsx` (sidebar mobile) e `LoadingOverlay.tsx` (loading global) — ambos coerentes entre si, não é duplicação problemática.

## Achado #1 — Badge de status: 4 implementações manuais diferentes

Mesma classe base `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`, repetida 4x com variações de cor cada vez:

- `ProductsPage.tsx:554` — badge de tipo de produto, cor dinâmica (`style` inline com a cor cadastrada do tipo)
- `ProductsPage.tsx:562` — badge secundário, `bg-secondary text-secondary-foreground`
- `OrdersPage.tsx:375-379` — badge de status do pedido, **lógica de cor por status inline** (`FECHADO` → verde, `ABERTO` → azul, mais casos) direto no JSX, com classes dark-mode manuais
- `EmployeesPage.tsx:363` — badge de cargo/role, `bg-primary/10 text-primary`

**Recomendação pra Fase 4**: criar `components/ui/badge.tsx` (padrão shadcn: `variant` via CVA — `default`/`secondary`/`success`/`warning`/`destructive`). A lógica "status → variant" de `OrdersPage` é a mais complexa e o melhor caso de teste pro componente novo.

## Achado #2 — Estado vazio: só 1 página trata explicitamente

Busquei "nenhum/nenhuma/sem resultados/não encontr" nas 6 páginas de dashboard — só **`ChartsPage`** tem mensagem de lista vazia (`ChartsPage.tsx:683` e `:913`, texto solto em `<div className="flex h-[400px] items-center justify-center text-muted-foreground">`, sem componente).

`OrdersPage`, `SalesPage`, `ProductsPage`, `EmployeesPage` **não apareceram** nessa busca — não confirmei se elas tratam lista vazia de outro jeito (ex.: só renderizam tabela vazia sem mensagem) ou se é uma lacuna de UX real. Vale checar direto com quem for implementar a Fase 4 antes de assumir que é só padronização visual — pode ser feature faltando, não só estilo.

**Recomendação pra Fase 4**: criar `components/ui/empty-state.tsx` e, ao aplicar, checar as 4 páginas que não apareceram na busca.

## Achado #3 — Cores hex hardcoded: falso alarme, não é violação

Encontrados hex diretos em `ChartsPage.tsx` (paleta de cores do `recharts`, ex. `#8884d8`) e `ProductsPage.tsx` (color picker de tipo de produto, cor escolhida pelo usuário/dono do estabelecimento). Nos dois casos é **dado dinâmico/de negócio**, não teto de tema — não faz sentido virar token Tailwind. Não é um item de ação.

## Não incluído nesta auditoria

- Não avaliei responsividade nem acessibilidade (fora do pedido original).
- Não abri `Navbar`/`Footer`/`Pagination` em detalhe — passaram pelo grep geral, nada saltou aos olhos, mas não tiveram uma leitura linha a linha completa.
- Não toquei em nenhum arquivo de código-fonte, só este documento.
