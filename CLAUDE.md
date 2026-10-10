@AGENTS.md

# Migração para SolidJS (branch `dev`)

As regras do `AGENTS.md` acima valem para o **React na raiz**, que está congelado: só correção, e só se o usuário pedir. O front novo fica em **`web/`** (SolidJS + Vite, Cloudflare Pages) e fala só com o `/v1` da API Go.

- Plano: [`docs/superpowers/plans/2026-10-10-migracao-solid.md`](docs/superpowers/plans/2026-10-10-migracao-solid.md). Leia antes de qualquer tarefa no `web/`.
- Contrato da API: `https://dev-api.tozzo.uk/v1/docs` (Scalar). Os tipos são gerados em `web/src/api/schema.d.ts` com `bun run api:types`; nunca edite esse arquivo à mão.

## Regra principal

**O visual não muda; só o framework.** Isso vale para tokens, classes Tailwind, componentes, ícones, textos, responsividade e temas claro e escuro. Gráficos e tabelas podem ter diferenças pequenas que vêm da biblioteca, mas mantêm cores, fontes e containers.

- `web/tailwind.config.js` e `web/src/index.css` são cópias do React. Mudar token ou cor exige o "ok" do usuário.
- Primitivas em `web/src/components/ui/` com **as mesmas classes e variantes CVA** do React. Para os atributos de estado do Kobalte, troque o seletor e mantenha o efeito (ver o plano).
- Uma página só está migrada quando o **teste visual** bate com o baseline do React (`e2e/visual/__screenshots__/react/`). **Nunca atualize o baseline sem o "ok" do usuário.**

## Regras do `web/`

1. Código em inglês. Texto visível só por i18next, nas 6 línguas e com as **mesmas chaves** do React (`web/src/i18n/locales/*.json`).
2. Dados remotos só por TanStack Query + o cliente `openapi-fetch` (`web/src/api/`). Nada de `fetch` solto em componente.
3. Erros da API chegam como `problem+json` com `code`. A mensagem vem de `web/src/i18n/error-keys.ts` pelo `code`, nunca do `detail`.
4. Dinheiro chega em centavos (`…Cents`). Formate com os formatadores de `web/src/i18n/format.ts`; nunca divida por 100 no componente.
5. Tempo real só pelo módulo `web/src/realtime.ts` (uma conexão por aba, que invalida queries). Nenhum componente abre `EventSource`.
6. Sessão: access token só em memória e refresh via cookie (`/v1/auth/refresh`). Nada de token em `localStorage`.
7. Rotas pesadas com `lazy()`. O ECharts só no chunk de relatórios. Metas de tamanho no plano.
8. Biblioteca nova só se o mapa de bibliotecas do plano não resolver. Nesse caso, pergunte antes. **Licença:** só MIT, BSD, ISC, Apache-2.0 ou MPL-2.0. Nada comercial ou pago (ex.: versões "Pro" de componentes, AG Grid Enterprise, Highcharts). Confira com `gh api repos/<dono>/<repo> --jq .license.spdx_id`.

## Testes do `web/`

Exceção à regra do `AGENTS.md` ("não migre a suíte para Vitest"): **o `web/` usa Vitest** + `@solidjs/testing-library`. O React continua com `bun test`.

```bash
cd web
bun install --frozen-lockfile
bun run test           # vitest
bun run test:visual    # Playwright: comparação com o baseline do React
bun run test:e2e       # fluxos contra a massa toV1()
bun run i18n:check
bun run build
```

Antes de dizer que terminou, rode os testes do que mudou, o visual das rotas afetadas, o `i18n:check` e o `build`. Diga exatamente o que não pôde rodar.
