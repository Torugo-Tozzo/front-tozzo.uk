# Testes

## Critérios mínimos

1. Feature ou mudança de comportamento tem testes dos fluxos principais e erros relevantes; correção tem regressão que falhava antes.
2. Fluxos visíveis no navegador têm spec Playwright em `e2e/`.
3. Visual preserva as referências aprovadas nos três tamanhos e dois temas, com limite de diferença 0,002; nunca atualizar baseline sem o ok do usuário.
4. `i18n:check` e build devem passar. Build inclui TypeScript e gate de isolamento ECharts.
5. Informe exatamente o que não rodou e por quê. Teste pulado não conta como aprovado.

## Comandos na raiz

```bash
bun install --frozen-lockfile
bun run test
bun run i18n:check
bun run build
bun run browser:install
bun run test:e2e
bun run test:visual:linux
```

Desde a S8, há um único `package.json`, lockfile e Playwright, todos na raiz. Não rode `cd web` nem instale o projeto React. Use Bun 1.4.2. Não há script de lint: não apresente ESLint como gate.

## Unitários e componentes

Vitest, `@solidjs/testing-library` e happy-dom, configurados em `vite.config.ts`. A suíte inclui `src/**/*.test.{ts,tsx}`, `scripts/**/*.test.mjs` e `e2e/visual/data/**/*.test.ts`; os testes dos serializadores preservam a consistência entre a massa histórica e `/v1`.

```bash
bun run test src/lib/money.test.ts
bun run test:watch
```

Teste comportamento visível e payload serializado, não detalhes internos. O preload React de `bunfig.toml` foi removido. No Windows, há histórico de falha ao carregar `@solid-refresh`; o ambiente de referência é Docker Linux, sem trocar dependências para contornar o host.

Para rodar unitários/build no mesmo ambiente Linux do visual:

```bash
docker run --rm --ipc=host --init \
  -v "$PWD":/work -v tozzo-solid-node-modules:/work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -lc 'npm install -g --silent bun@1.4.2 && bun install --frozen-lockfile && bun run test && bun run i18n:check && bun run build'
```

No Windows, execute esse comando no WSL, a partir do caminho Linux do checkout.

## Playwright E2E

- Specs `e2e/*.e2e.ts`, fixtures `e2e/*.fixture.ts`, projeto `chromium`, configuração `playwright.config.ts`.
- `bun run test:e2e` inicia Vite em `localhost:5177`; mock `/v1` responde no host fictício `api.visual.test`. Não precisa de credenciais nem altera dados reais.
- Um arquivo: `bun run test:e2e e2e/public-billing.e2e.ts`; filtro: `-g "nome"`; CI usa `--workers=2`.
- Trace e screenshot são guardados nas falhas em `test-results/e2e/`. Abra `bunx playwright show-trace <trace.zip>` ou leia `error-context.md`.
- `PLAYWRIGHT_BROWSERS_PATH=0` guarda Chromium no pacote. A imagem Docker já possui o navegador: nela, use `node node_modules/@playwright/test/cli.js test`, sem essa variável, ou defina `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`.
- `E2E_BASE_URL` desliga o Vite local, mas os specs portados continuam usando mocks. **Passar a URL de homologação não transforma esses testes em smoke da API real.** Smoke autenticado precisa de verificação separada e conta exclusiva.
- Credenciais reais ficam somente em `.env.e2e.local`, ignorado pelo Git. Homologação usa leitura por padrão; mutações exigem conta/estabelecimento exclusivos de teste e limpeza do que foi criado.
- Prefira `getByRole`/`getByLabel`; sem `waitForTimeout`. Espere estados, respostas ou elementos reais. O que a exploração descobrir vira spec.

## Visual

`playwright.visual.config.ts` executa somente Solid e mantém `updateSnapshots: 'none'`.

- Massa canônica em `e2e/visual/data/canonical.ts`, serializadores em `legacy.ts` e `v1.ts`; cenários históricos em `e2e/visual/scenarios.ts`.
- `routes.visual.ts` executa os cenários de `ported.ts` com mock `/v1`.
- `adjusted.visual.ts` compara regiões para diferenças previamente aceitas; `support/solid-adjustments.ts` documenta adaptações de ações e mocks.
- `solid-only.visual.ts` compara referências próprias de telas/estados sem equivalente React. Os projetos `solid-*` usam esses PNGs.
- Referências React em `e2e/visual/__screenshots__/react/{linux,win32}/`; referências Solid em `e2e/visual/__screenshots__/solid/linux/`. Nenhum PNG muda na S8.
- PNGs React usam Git LFS (`git lfs install` e `git lfs pull`); confira que não são ponteiros antes de testar. PNGs Solid estão fora do LFS por decisão registrada no plano.
- Não existe mais `test:visual:baseline`: o app React pode ser consultado pelo histórico Git, sem reintroduzi-lo neste projeto.

```bash
bun run test:visual:linux
VISUAL_WORKERS=2 bash scripts/visual-linux.sh -g estimate-add-product
VISUAL_DEBUG=1 bun run test:visual -g login
```

O script usa a imagem `mcr.microsoft.com/playwright:v1.63.0-noble`, instala uma vez na raiz e monta dependências Linux em um único volume. No Windows, pode usar Docker pelo WSL. Os scripts `.sh` têm LF.

Para conferir o build publicado localmente, também é possível separar o showcase (exclusivo de desenvolvimento) das páginas reais. Na imagem Docker, rode os 24 casos UI com o servidor padrão, faça o build com o host fictício da massa, inicie o preview em outro terminal e confira as demais páginas:

```bash
VISUAL_WORKERS=4 node node_modules/@playwright/test/cli.js test -c playwright.visual.config.ts --grep ' ui($|-)'
VITE_API_URL=http://api.visual.test bun run build
bun run preview --host localhost --port 5178 --strictPort
# Em outro terminal, com o preview acima ativo:
VISUAL_BASE_URL=http://localhost:5178 VISUAL_WORKERS=4 node node_modules/@playwright/test/cli.js test -c playwright.visual.config.ts --grep-invert ' ui($|-)'
```

Os dois grupos usam a mesma configuração e referências. A S8 usou essa divisão no filesystem Linux para evitar recompilar páginas no Vite dev a cada cenário. Se uma rodada for interrompida, registre como parcial; somente os grupos concluídos contam no resultado.

O render varia por sistema: o aceite visual usa Linux na imagem oficial. `bun run test:visual` no host usa as fontes do host. As capturas têm tamanhos `1440×900`, `768×1024`, `390×844`, temas claro/escuro, locale `pt-BR`, fuso `America/Sao_Paulo`, relógio fixo, fontes prontas e animações desativadas. Imagens externas viram pixel neutro; gráficos recebem máscara. `data-solid-only` e comparações por regiões seguem somente as exceções já aprovadas no plano.

## Acessibilidade, desempenho e automação

- axe-core/Playwright nas rotas principais: zero violações serious/critical.
- `bun run analyze` gera `dist/stats.html`; `bun run size` mede JS inicial. Metas em [ARCHITECTURE.md](ARCHITECTURE.md#metas-de-desempenho), resultados/pendências no plano da migração. Mudança de pasta não comprova melhoria de Lighthouse.
- `bun run browse open http://localhost:5175 --headed`, `bun run browse snapshot`, `bun run browse screenshot`, `bun run browse close`: exploração com Playwright CLI. Artefatos em pastas ignoradas; exploração não substitui testes.
- CI instala com lockfile congelado e roda unitários, i18n, build e E2E na raiz. O visual Linux é uma verificação separada; não declarar que rodou no CI sem evidência.
