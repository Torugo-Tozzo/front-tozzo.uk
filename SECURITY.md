# Segurança

## Autorização e sessão

- **A segurança fica na API.** Esconder botão ou menu não autoriza nada. Toda rota protegida do front tem guarda (`ProtectedRoute` e `BusinessModuleRoute`), e a API valida de novo.
- **Solid:**
  - access token **só em memória** (nunca em `localStorage` ou `sessionStorage`);
  - refresh por cookie `HttpOnly` em `POST /v1/auth/refresh` com `credentials: 'include'`;
  - um único refresh por vez (single-flight); se falhar, vai para o login.
- **React (legado):** a sessão é do GoTrue (`src/services/api.ts`). Não mude o armazenamento sem pedido.
- Nada de token, senha ou dado pessoal em `console.log`, mensagem de erro, URL ou analytics. O ticket do SSE vai na URL por desenho, mas é de uso único e curto.

## Segredos e credenciais

- `.env` e `.env.*` não são versionados (só o `.env.example`). Não substitua um `.env` real por exemplo.
- Variáveis `VITE_*` vão para o bundle e **são públicas**: nunca ponha segredo nelas.
- **Credenciais de E2E** (`E2E_EMAIL`, `E2E_PASSWORD`) ficam em `.env.e2e.local`, ignorado pelo Git, e são de uma conta exclusiva de teste. Estado de sessão do Playwright (`.playwright/`, `.playwright-cli/`, `storageState`) também não é versionado.
- Na automação de navegador, nunca digite credenciais reais do usuário, nem aceite diálogos de pagamento ou de permissão no lugar dele.

## Homologação e dados

- Os testes padrão em `https://dev.tozzo.uk` **só leem**. Teste que cria ou altera dados usa estabelecimento exclusivo de teste e limpa o que criou.
- Nunca use dados reais de clientes em fixture, screenshot ou baseline visual: só a massa canônica fictícia.

## Headers e CSP (Solid no Cloudflare Workers)

`web/public/_headers` (texto completo no plano, seção "Cloudflare Workers"):
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` e HSTS;
- **CSP** restrita: `default-src 'self'`, scripts só do próprio site e do Google Identity, `connect-src` só para a API (`https://dev-api.tozzo.uk`), o Google e o `PUT` pré-assinado do R2 (`https://*.r2.cloudflarestorage.com`), imagens do host público do R2 (`https://media-dev.tozzo.uk`);
- nada de `eval` ou de script inline. Liberar uma origem nova na CSP exige motivo e o "ok" do usuário.

Previews (`*-tozzo-web.<conta>.workers.dev`) só chamam a API se a origem estiver no CORS dela, e essa decisão é do usuário.

## Entradas e saída

- Sem `innerHTML` nem `dangerouslySetInnerHTML` com conteúdo vindo da API ou do usuário. No Solid, nada de `innerHTML` com dado dinâmico.
- Links externos com `rel="noopener noreferrer"`.
- A impressão de recibo (`src/components/receipt/`) formata por texto, sem injetar HTML.

## Dependências

- **Licença:** só MIT, BSD, ISC, Apache-2.0 ou MPL-2.0. Nada comercial, pago ou "Pro" (por exemplo AG Grid Enterprise, Highcharts ou versões Pro de componentes). Conferir com `gh api repos/<dono>/<repo> --jq .license.spdx_id`.
- Versões exatas no lockfile. Não altere o lockfile sem necessidade.

## Publicação

Push na `dev` publica (React na VM; `web/` no Worker `tozzo-web`): só com pedido do usuário. Nunca force push nem merge de `dev` para `main`.
