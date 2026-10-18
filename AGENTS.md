# front-tozzo.uk — instruções para agentes

Front web do Tozzo em **SolidJS na raiz**, com o visual preservado. Fala só com o `/v1` da API Go e roda no Cloudflare Workers (só assets). A produção legada continua na branch `main`; não misture as branches. API: `../api-tozzo.uk`. Mobile: `../TozzoBurger`.

## Leia conforme a tarefa

| Documento | Quando |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | para se situar: Solid, mapa, dados, sessão, tempo real, Workers, metas de desempenho |
| [CONVENTIONS.md](CONVENTIONS.md) | **antes de escrever código**: a regra do visual, i18n, UI, regras do Solid |
| [TESTING.md](TESTING.md) | antes de dizer que terminou: critérios, comandos, **Playwright** (E2E, visual, acessibilidade, automação) |
| [SECURITY.md](SECURITY.md) | ao mexer em sessão, tokens, credenciais de E2E, CSP/headers, HTML dinâmico ou dependências |
| [Plano do Solid](docs/superpowers/plans/2026-10-10-migracao-solid.md) | ao consultar decisões e pendências da migração (fases S0 a S8, mapa de bibliotecas, registro) |
| [skills/tozzo-development](../api-tozzo.uk/skills/tozzo-development/SKILL.md) | guia compartilhado entre os três repos |

O contrato da API está em `https://dev-api.tozzo.uk/v1/docs` (Scalar). O planejamento privado fica em `../api-tozzo.uk/proximas-etapas/`: não copie documentos privados para cá.

## Regras que valem sempre

- **O visual não muda; só o framework.** Mudar token ou cor, ou atualizar o baseline visual, exige o "ok" do usuário.
- **Produção (`main`) congelada:** só correção, e só se o usuário pedir. O código desta branch é Solid.
- **Push na `dev` publica.** Sem commit, push ou deploy sem pedido. Use `git add <arquivos>`, nunca `-A`. Nunca faça merge de `dev` para `main`.
- **Preserve o que não é seu:** confira `git status --short` antes de editar.
- **Texto visível só por i18next**, com as mesmas chaves nos 6 idiomas.
- **Segurança é da API:** esconder menu não autoriza nada. Token só em memória no Solid.
- **Teste** para toda feature e correção; fluxo visível no navegador ganha spec Playwright. Teste pulado não é teste aprovado.
- **Biblioteca nova** só se o stack ou o mapa do plano não resolver, perguntando antes. Só licença MIT, BSD, ISC, Apache-2.0 ou MPL-2.0.
- Mudança no web exige atualizar o acompanhamento mobile (ver a skill compartilhada).

## Comandos essenciais

```bash
bun install --frozen-lockfile
bun run test && bun run i18n:check && bun run build
bun run test:e2e                  # Playwright, mock /v1
bun run test:visual:linux         # visual Linux (Docker), baselines preservados
```

Detalhes no [TESTING.md](TESTING.md).
