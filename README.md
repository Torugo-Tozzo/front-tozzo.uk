# front-tozzo.uk

Front web do Tozzo. Na branch `dev`, usa **SolidJS**, consome somente o `/v1` da API Go e é servido como assets estáticos pelo **Cloudflare Workers** (`tozzo-web`, `dev.tozzo.uk`).

O aplicativo está na raiz desde a S8; não existe instalação separada em `web/`. O React da produção permanece na `main`. Não faça merge da `dev` para a `main`: produção exige um plano próprio.

## Stack

SolidJS, TypeScript estrito, Vite, Tailwind CSS 3.4, Kobalte, TanStack Solid Query, openapi-fetch, i18next (seis idiomas), ECharts sob demanda e FullCalendar. Access token em memória e refresh por cookie; tempo real por SSE compartilhado.

## Desenvolvimento

Use Bun **1.4.2**, a versão das verificações Linux e do CI.

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Vite em `http://localhost:5175`. `VITE_API_URL` é a origem da API, por exemplo `https://dev-api.tozzo.uk`, sem `/v1`: o cliente acrescenta o prefixo. Não há proxy legado `/api` nem configuração GoTrue. Variáveis `VITE_*` são públicas e entram no build.

## Verificações

```bash
bun run test
bun run i18n:check
bun run build
bun run browser:install
bun run test:e2e
bun run test:visual:linux
```

Vitest cobre componentes, lógica, scripts e consistência da massa canônica. Playwright cobre fluxos com mock `/v1`, acessibilidade e regressão visual. O visual Linux usa Docker com a imagem oficial Playwright; conserva as referências aprovadas em `e2e/visual/__screenshots__/`, sem regenerá-las. Veja [TESTING.md](TESTING.md).

Outros comandos: `bun run preview`, `bun run test:watch`, `bun run api:types`, `bun run analyze`, `bun run size` e `bun run browse`. O build verifica também que ECharts permanece fora dos imports estáticos da entrada, login e pedidos.

## Publicação no Cloudflare

Push na `dev` aciona Workers Builds. Commit, push e deploy exigem pedido do usuário.

- Worker: `tozzo-web`; branch: `dev`; diretório de build: **raiz do repositório** (antes `web/`).
- Build: `bun install --frozen-lockfile && bun run build`.
- Deploy: `npx wrangler deploy`; preview: `npx wrangler versions upload`.
- Variáveis de build: `BUN_VERSION=1.4.2`, `VITE_API_URL=https://dev-api.tozzo.uk`.
- `wrangler.jsonc`: assets em `./dist`, fallback SPA; headers/CSP em `public/_headers`.

**Antes de publicar o corte**, coordenar a troca do diretório de build no painel com o push. Depois, conferir o SHA publicado, `/`, `/login`, uma rota profunda, assets e headers. A S8 não exige intervenção na VM; a limpeza da API é outra fase.

## Documentação

[Arquitetura](ARCHITECTURE.md), [convenções](CONVENTIONS.md), [segurança](SECURITY.md), [testes](TESTING.md) e [instruções para agentes](AGENTS.md).

[Plano e registro da migração](docs/superpowers/plans/2026-10-10-migracao-solid.md) e [execução S8](docs/superpowers/plans/2026-10-18-solid-s8.md).

API: `../api-tozzo.uk`; mobile: `../TozzoBurger`; [guia compartilhado](../api-tozzo.uk/skills/tozzo-development/SKILL.md). Mudanças web registram impacto ou ausência de impacto no [acompanhamento mobile](../TozzoBurger/docs/pendencias-alinhamento-api-web.md). Planejamento privado permanece no repositório da API.
