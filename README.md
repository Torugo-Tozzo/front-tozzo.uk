# front-tozzo.uk

Frontend da plataforma [Tozzo.uk](https://tozzo.uk) — sistema de gestão para restaurantes e bares.

Construído com React, TypeScript e Vite. Consome a API REST do [api-tozzo.uk](https://github.com/Torugo-Tozzo/api-tozzo.uk) (repositório privado).

O plano da expansão para alimentação, loja e serviços fica no repositório privado da API, em `proximas-etapas/002-plataforma-multinicho/README.md`. A cada entrega web, registre o impacto ou a ausência de impacto no [acompanhamento mobile](../TozzoBurger/docs/pendencias-alinhamento-api-web.md).
As práticas compartilhadas de implementação, revisão, testes e deploy ficam no [guia de desenvolvimento](../api-tozzo.uk/skills/tozzo-development/SKILL.md).

## Funcionalidades

- Gestão de pedidos em tempo real (SSE/polling)
- Controle de produtos e cardápio digital
- Gestão de funcionários
- Histórico de vendas
- Gráficos e dashboards (horários de pico, total de vendas)
- Autenticação JWT com controle de rotas
- Integração com Stripe para assinaturas
- Suporte a tema claro/escuro

## Stack

- **React 18** + **TypeScript**
- **Vite** — bundler
- **React Router v7** — roteamento com lazy loading
- **Axios** — cliente HTTP
- **Tailwind CSS** + **shadcn/ui** — estilização e componentes
- **Recharts** — gráficos
- **Docker** + **Nginx** — deploy em produção
- **Bun** — gerenciador de pacotes

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+ ou [Bun](https://bun.sh/)
- API do back-end rodando (ver variáveis de ambiente)

## Como rodar localmente

**1. Clone o repositório**

```bash
git clone https://github.com/Torugo-Tozzo/front-tozzo.uk.git
cd front-tozzo.uk
```

**2. Instale as dependências**

```bash
bun install
# ou
npm install
```

**3. Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_API_URL=/api
```

**4. Inicie o servidor de desenvolvimento**

```bash
bun run dev
# ou
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`.
No desenvolvimento, o Vite encaminha `/api/*` para a API local na porta `3001`.

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `bun run dev` | Servidor de desenvolvimento |
| `bun run build` | Build de produção (gera `dist/`) |
| `bun run preview` | Visualiza o build localmente |
| `bun run lint` | Linting com ESLint |
| `bun run test` | Testes de lógica e componentes (Bun/Happy DOM) |
| `bun run test:e2e` | Testes em Chromium no front local |
| `bun run browse` | Navegação interativa pelo Playwright CLI |

## Testes de navegador

Cada nova feature deve incluir testes automatizados para seus fluxos principais. Quando o fluxo aparece no navegador, adicione ou atualize um teste em `e2e/` além dos testes de lógica/componentes pertinentes.

Instale o Chromium usado pelo Playwright uma vez:

```bash
bun run browser:install
```

O teste de navegador inicia o Vite em `localhost:5173` quando necessário. Para executar o mesmo fluxo público em homologação, informe a URL do front:

```bash
bun run test:e2e
E2E_BASE_URL=https://dev.tozzo.uk bun run test:e2e
```

O teste autenticado faz login e visita os módulos disponíveis para a conta, conferindo as respostas das listagens e o estado das tabelas. Defina `E2E_EMAIL` e `E2E_PASSWORD` para executá-lo; sem ambas, ele é ignorado. Use uma conta exclusiva de testes. Para homologação, guarde as variáveis em `.env.e2e.local` (ignorado pelo Git) e execute:

```bash
bun --env-file=.env.e2e.local run test:e2e
```

Para explorar o localhost, inicie antes `bun run dev --host localhost --strictPort`. Use então o Playwright CLI. Ele mantém a sessão entre comandos e pode gerar snapshots, screenshots e rastros sem registrar esses arquivos no Git:

```bash
bun run browse open http://localhost:5173 --headed
bun run browse snapshot
bun run browse screenshot
bun run browse close

bun run browse open https://dev.tozzo.uk --headed
```

Os testes padrão de homologação não alteram dados. Testes autenticados que criem ou editem registros devem usar uma conta e um estabelecimento exclusivos para testes; não salve senhas nem estado de sessão no repositório.

## Deploy com Docker

```bash
docker build --build-arg VITE_API_URL=https://sua-api.com -t front-tozzo .
docker run -p 80:80 front-tozzo
```

O Dockerfile realiza o build em um estágio e serve os arquivos estáticos via Nginx no estágio de produção.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `VITE_API_URL` | URL base da API (`/api` no desenvolvimento; URL pública no build de produção) | `/api` no desenvolvimento |

> Variáveis do Vite prefixadas com `VITE_` são embutidas no bundle durante o build. Não coloque segredos aqui.

## Estrutura do projeto

```
src/
├── components/       # Componentes reutilizáveis
│   └── ui/           # Componentes base (shadcn/ui)
├── contexts/         # Context API (autenticação)
├── layouts/          # Layouts de página
├── pages/            # Páginas da aplicação
│   └── dashboard/    # Páginas do painel administrativo
├── services/         # Cliente HTTP (Axios)
└── lib/              # Utilitários
```
