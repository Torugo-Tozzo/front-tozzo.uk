# Desempenho inicial — landing e pedidos

**Objetivo:** melhorar o desempenho mobile e reduzir o JS inicial sem alterar visual, textos, fluxos, API ou baselines. Base: S8 publicada, `301f251`. Branch de trabalho: `perf/initial-loading`, na worktree existente `.worktrees/s8`; checkout original preservado.

**Aceite recebido:** em 2026-10-18 o usuário testou e aprovou os gráficos. Encerra o aceite visual manual registrado como pendente nas S6/S7; não equivale a smoke de exportação/Stripe.

**Escopo aprovado pelo usuário:** prosseguir com melhorias de desempenho. Esta é uma otimização delimitada dos fluxos existentes. Sem commit/push/deploy nesta etapa e sem mudar qualidade/bytes das fotos originais, tokens ou geometria da interface. Dependências de produção preservadas.

## Referência e diagnóstico

- JS da landing com pt-BR: 82,3 KB gzip; dashboard/pedidos com idioma: 145,5 KB. Metas: 80 KB e 120 KB, respectivamente.
- `App.tsx` importa TanStack Query e cria o client para todas as rotas; AuthProvider e páginas públicas não precisam dele. Verificar separação somente para rotas que consultam/mutam dados, preservando um client compartilhado no módulo.
- Pedidos importa o editor completo mesmo fechado; verificar carregamento sob demanda com boundary própria, sem suspender a lista e sem perder rascunhos ou conflito/idempotência.
- Fotos da landing somam ~3,7 MiB. Hero 636 KB; lazy nativo ainda antecipa fotos próximas. Medir competição de rede e atribuição de layout shift antes de ajustar carregamento e reservar dimensões.
- Lighthouse de referência/resultado no mesmo ambiente Linux, Chromium, build de produção gzip, pt-BR e massa canônica local. Nenhum dado ou credencial real usado. Ferramenta temporária Lighthouse 13.5.0, fora das dependências do projeto.

## Tarefas

- [x] Registrar referência Lighthouse e inspecionar rede, LCP e CLS; confirmar o grafo de JS.
- [x] Criar regressão Playwright para os chunks que não devem ser requisitados inicialmente e para abertura/uso tardio do editor; observar falha antes da correção.
- [x] Separar somente o código comprovadamente desnecessário na entrada; preservar contexto de queries, erros e navegação.
- [x] Criar regressões para rede de imagens e estabilidade do layout; ajustar carregamento sem alterar os originais.
- [x] Repetir medidas equivalentes; executar unitários, i18n, build, E2E e visual das rotas afetadas; revisão independente.
- [x] Atualizar registro da migração e acompanhamento mobile com ausência de impacto; relatar ganhos e metas ainda não atendidas.

## Decisões e limites

- Não trocar primitivas Kobalte por controles de outro visual para reduzir KB.
- Não mascarar dados, reduzir a massa de teste, desativar recursos ou alterar baseline para obter uma pontuação melhor.
- Resultados locais não substituem medição autenticada com CDN/API real. Não declarar meta atingida por uma única execução se houver oscilação relevante.

## Implementação e revisão

- `QueryLayout` lazy mantém um client compartilhado entre rotas de dados/autenticação. Landing e páginas legais mantêm AuthProvider sem baixar Query. Editor de pedidos carrega no primeiro uso, em Suspense próprio, mantendo a lista e a instância após a primeira abertura.
- Paginação usa um botão com as mesmas classes até o primeiro uso do Select Kobalte; filtro de status foi isolado para não importar Select em telas que não o exibem. Mesma posição superior, seleção por teclado, foco, limites e refetch. Cancelamento por Escape, Tab e clique fora durante download coberto no Playwright. Erros de chunk usam a política existente de recarregar uma vez.
- Fotos abaixo da dobra usam IntersectionObserver, sem a margem antecipada do lazy nativo. Hero tem derivados WebP 960/1440, qualidade 0,95, com JPEG original de fallback. Originais, tokens, cores, dimensões e baselines preservados. Gerador opcional e origem registrados em `public/images/landing/SOURCES.md`.
- Suspense engloba conteúdo e rodapé nos shells público e dashboard, evitando pintar o rodapé antes da página lazy. A geometria após carregar permanece igual.
- Regressões de chunks/editor/rede/rodapé e WebP observadas falhando antes das correções. Revisão independente identificou dois P2 no seletor adiado (posição e foco tardio), reproduzidos em quatro casos e corrigidos; reavaliação estática sem bloqueios. Nenhuma dependência de produção adicionada.

## Medições intermediárias

Lighthouse 13.5.0 em Chromium/Linux, mobile padrão, gzip, pt-BR, build local e massa canônica controlada, sem testes concorrentes. Referência: landing 66/LCP 9,9 s/CLS 0,176; login 96/LCP 2,4 s; pedidos 85/LCP 3,6 s/CLS 0,096.

Após separar chunks, imagens e shell público, três execuções idênticas: landing 93/LCP 3,2 s/CLS 0; login 96/LCP 2,4 s/CLS 0; pedidos 89/LCP 3,2 s/CLS 0,096. JS gzip: landing 82,3 → 71,0 KB; pedidos 145,5 → 110,7 KB, incluindo `QueryLayout` e pt-BR em ambas as contagens. O CLS residual de pedidos apontou o rodapé; correção subsequente aguarda medição final abaixo.

Artefatos locais ignorados em `test-results/performance/`. Baselines visuais nunca regenerados.

## Validação final

- Após o ajuste do dashboard: **513/513** unitários em 77 arquivos, seis idiomas/16 namespaces, TypeScript/build e gate ECharts aprovados. Execução unitária limitada a dois workers; uma tentativa concorrente com Chromium teve timeout em teste de pedidos e foi repetida integralmente sem concorrência, sem alterar timeout/assertivas. Os dois timeouts da tentativa inicial com paralelismo padrão também não contam como aprovação.
- **11/11** novos E2E de desempenho aprovados, incluindo os quatro casos identificados na revisão e o rodapé do dashboard. Suíte completa repetida após corrigir o mock responsivo: **99/99 aprovados**, sem pulados (6,5 min).
- Comparação adicional do hero com fotos reais (os visuais canônicos substituem fotos): WebP versus JPEG na própria tela, 390×844 e 1440×900, temas claro/escuro, mesma tipografia/layout, limiar YIQ 0,2 e tolerância máxima 0,002. **0 pixels acima do limiar nos quatro casos** (não significa identidade byte a byte). PNGs e resultados em `test-results/performance/hero-review/`.
- Após corrigir rodapé do dashboard, três medições de pedidos: **91/91/91**, LCP **3,239/3,255/3,237 s** (mediana **3,239 s**), CLS **0,0057** nas três (antes 0,0957). Landing **93** repetido em quatro execuções, login **96**. Repetições finais feitas após encerrar todos os testes de navegador, sem carga concorrente. JS e resultados locais satisfazem as metas da landing e pedidos; orçamento de JS do login continua aberto.
- Meta de JS do login permanece aberta: **106,8 KB gzip**, incluindo `QueryLayout` e pt-BR. Não adiar os próprios controles de autenticação apenas para melhorar a contagem. As metas da landing (71,0 ≤ 80 KB) e pedidos (110,7 ≤ 120 KB) foram atingidas localmente; medição na CDN/API reais permanece separada.
- Acompanhamento mobile atualizado com ausência de impacto em API, autenticação, sync ou código do app.
- Primeira rodada completa de navegador: 98 aprovados/1 falha na verificação `naturalWidth` do hero mockado. Diagnóstico: resposta PNG 1×1 decodificável, mas a densidade do `srcset` 960w faz a largura natural arredondar para zero. Mock local de WebP passou a usar 4×4 com exatamente RGB(160,160,160), igual ao pixel original; demais imagens/massa/baselines preservados. Os três testes de fotos passaram após a correção, mantendo `naturalWidth > 0` e adicionando `decode()` ao novo caso de WebP. Rodada completa repetida abaixo; a tentativa com falha não conta como aprovação.
- Visual completo Linux: **24/24** cenários UI no Vite dev (1,2 min) e **554 aprovados + 4 pulados** no preview de produção (4,9 min). Total **578 aprovados, zero falhas**, nos três tamanhos e dois temas. Quatro exclusões históricas `mobile-menu` em desktop/tablet permanecem puladas, não aprovadas. PNGs e tolerância 0,002 preservados.
- Reavaliação independente dos ajustes no dashboard e no mock responsivo sem novos achados materiais. `git diff --check` com `cr-at-eol` aprovado; nenhuma alteração em JPEGs originais, snapshots, `package.json` ou lockfile.

**Estado:** implementação local validada, sem commit/push/deploy da otimização. Publicar exige pedido próprio do usuário. Não fecha o orçamento de JS do login, benchmark de 1.000 vendas/60 fps, smoke autenticado real, Stripe real nem medição com CDN/API reais.

**Publicação autorizada (2026-10-18):** usuário solicitou commit e push para `dev` após receber os resultados acima. Conferir CI, Worker pelo SHA enviado e smoke público após o push. A autorização não inclui a `main` nem as alterações preservadas no checkout original.

**Revalidação pré-commit:** referência remota ainda em `301f251`, sem commits novos para conciliar. A rodada com dois workers teve uma falha intermitente no teste preexistente de limpar vencimento em `EstimatesPage` (arquivos do teste/tela não alterados). Os sete casos do arquivo passaram isolados e a suíte completa passou novamente com um worker: **513/513**, sem mudar assertivas/timeouts. As verificações completas anteriores de E2E/visual continuam válidas; desde então, houve apenas documentação e comentários.
