# Testes

Como testar o front e o mínimo antes de dizer que terminou.

## Critérios mínimos

1. **Feature nova ou mudança de comportamento** vem com teste automatizado dos fluxos principais e dos erros relevantes. Bug corrigido vem com teste que falhava antes.
2. **Fluxo visível no navegador** ganha (ou atualiza) um teste **Playwright** em `e2e/`, além dos testes de lógica e de componente.
3. **No `web/`, página migrada** só conta como pronta com o teste **visual** batendo com o baseline do React, nos 3 tamanhos e 2 temas.
4. **i18n:** `i18n:check` sem chave faltando.
5. **Build** sem erro.
6. Diga exatamente o que não rodou e por quê. Teste pulado (por falta de credencial ou de navegador) não conta como aprovado.

## Validação antes de terminar

```bash
# React (raiz)
bun run test                      # bun test --parallel
bun run i18n:check
bun run build
bun run test:e2e                  # Playwright (inicia o Vite em localhost:5173)

# Solid (web/)
cd web
bun run test                      # Vitest
bun run test:visual               # Playwright: comparação com o baseline do React
bun run test:e2e                  # fluxos contra a massa toV1()
bun run i18n:check
bun run build
```

Rode pelo menos os testes do que mudou, o visual das rotas afetadas, o `i18n:check` e o `build`.

Existe um script `lint`, mas o `package.json` não declara ESLint. Confirme a configuração antes de usá-lo como gate.

## Playwright

### Instalação

```bash
bun run browser:install           # Chromium em node_modules (PLAYWRIGHT_BROWSERS_PATH=0)
```

### E2E

- Specs em `e2e/*.e2e.ts` (fixtures em `e2e/*.fixture.ts`), projeto `chromium`. Configuração em `playwright.config.ts`: `trace` e `screenshot` ficam guardados quando o teste falha.
- **Local:** `bun run test:e2e` sobe o Vite sozinho. Para rodar um só: `bun run test:e2e e2e/services-catalog.e2e.ts`. Para rodar por nome: `-g "nome"`.
- **Homologação:**
  - `E2E_BASE_URL=https://dev.tozzo.uk bun run test:e2e`;
  - testes autenticados pedem `E2E_EMAIL` e `E2E_PASSWORD` (`bun --env-file=.env.e2e.local run test:e2e`). Sem as duas, eles são pulados;
  - **por padrão, só leitura.** Fluxo que cria ou altera dados exige conta e estabelecimento exclusivos de teste, sem credencial versionada.
- **Mocks de rede** com `page.route` para estados difíceis (erro, vazio, carregando) e para a massa canônica. Relógio fixo com `page.clock.setFixedTime`.
- **Seletores:** prefira papel e nome acessível (`getByRole`, `getByLabel`) ao CSS. Sem `waitForTimeout`; espere por estado (`expect(...).toBeVisible()`, `waitForResponse`).
- Falhou? Abra o trace com `bunx playwright show-trace test-results/<pasta>/trace.zip`, ou leia o `error-context.md` do teste.

### Visual

- Baseline do React em `e2e/visual/__screenshots__/react/<sistema>/` (fase S0), gerado com `bun run test:visual:baseline`. Os tamanhos são `1440×900`, `768×1024` e `390×844`, nos temas claro e escuro.
- **Onde fica:**
  - cenários (rota + estado + ação) em `e2e/visual/scenarios.ts`; o nome do cenário é o nome do arquivo;
  - spec em `e2e/visual/routes.visual.ts`, com config própria em `playwright.visual.config.ts`;
  - `/__ui` (só em dev, `src/pages/dev/UiShowcasePage.tsx`) mostra todas as variantes das primitivas `ui/`; os cenários `ui*` fotografam a página, o select aberto, o diálogo e o dropdown;
  - `bun run test:visual` na raiz confere o React contra o próprio baseline, e precisa dar zero pixel de diferença;
  - os PNG ficam no **Git LFS** (`.gitattributes`): rode `git lfs install` uma vez, senão o checkout traz só os ponteiros.
- O que torna o baseline determinístico:
  - massa canônica (`e2e/visual/data/canonical.ts`, com os serializadores `toLegacyApi()` e `toV1()`; o `serializers.test.ts` confere que os dois descrevem os mesmos dados);
  - relógio fixo (`2026-10-01 15:00`, `America/Sao_Paulo`) e locale `pt-BR`;
  - hosts falsos para API e GoTrue (`*.visual.test`), imagens externas trocadas por um pixel fixo e SSE parado sem tráfego;
  - `document.fonts.ready`;
  - animações desligadas por CSS;
  - gráficos mascarados;
  - selects abertos fotografados só no viewport (no screenshot de página inteira o header fixo varia 1 px).
- **O render depende do sistema** (fontes e antialiasing), então há um baseline por sistema (`{platform}` do Playwright):
  - `win32/`: gravado no Windows;
  - `linux/`: gravado na imagem Docker oficial do Playwright (`mcr.microsoft.com/playwright:v1.63.0-noble`) com `bun run test:visual:linux`, que serve para o CI. Precisa de Docker (no Windows, o do WSL). Para filtro com `$`, chame `bash scripts/visual-linux.sh -g '...'` direto: o `bun run` escapa o `$`.
  O Solid é comparado com o baseline do sistema em que roda.
- Depuração: `VISUAL_DEBUG=1 bun run test:visual -g <cenário>` imprime o console e as requisições da página.
- Tolerância: `maxDiffPixelRatio: 0.002` para o Solid (`VISUAL_TARGET=solid`); zero para o React. Diferença maior que isso corrige-se no Solid.
- **Nunca atualize o baseline sem o "ok" do usuário**, registrado no plano.

### Acessibilidade

`@axe-core/playwright` nas rotas principais, sem violações `serious` ou `critical`.

### Automação de navegador (exploração e diagnóstico)

- **Playwright CLI**, que mantém a sessão entre comandos e não versiona artefatos (`.playwright-cli/`):

  ```bash
  bun run dev --host localhost --strictPort      # se for o localhost
  bun run browse open http://localhost:5173 --headed
  bun run browse snapshot                        # árvore de acessibilidade da página
  bun run browse screenshot
  bun run browse close
  ```

- **Claude in Chrome** (no Claude Code) serve para inspecionar o navegador real do usuário: console, rede e GIF de um fluxo. Use uma aba nova, nunca dispare `alert`/`confirm` e não preencha credenciais.
- Exploração não substitui teste: o que se descobrir vira spec em `e2e/`.

## Unitários e de componente

- **React:** `bun test` com Testing Library e happy-dom (preloads em `bunfig.toml`). Rodar um arquivo: `bun test src/components/dashboard/PedidosTab.test.tsx`.
- **Solid:** Vitest com `@solidjs/testing-library`. Ao portar um componente, porte **todos** os testes dele, com o mesmo comportamento esperado.
- Teste comportamento visível (texto, papel, chamada de rede serializada), não detalhe interno.

## Desempenho (Solid)

Ao fim de cada fase:
- tamanhos de chunk pelo `rollup-plugin-visualizer`;
- Lighthouse mobile;
- registro no plano.

Metas em [ARCHITECTURE.md](ARCHITECTURE.md#metas-de-desempenho-solid).
