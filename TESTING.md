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

- Baseline do React em `e2e/visual/__screenshots__/react/` (fase S0), gerado com `bun run test:visual:baseline`. Os tamanhos são `1440×900`, `768×1024` e `390×844`, nos temas claro e escuro.
- O que torna o baseline determinístico:
  - massa canônica (`e2e/visual/data/canonical.ts`, com os serializadores `toLegacyApi()` e `toV1()`);
  - relógio fixo;
  - `document.fonts.ready`;
  - animações desligadas por CSS;
  - gráficos mascarados.
- Tolerância: `maxDiffPixelRatio: 0.002`. Diferença maior que isso corrige-se no Solid.
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
