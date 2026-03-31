# front-tozzo.uk

Frontend da plataforma [Tozzo.uk](https://tozzo.uk) — sistema de gestão para restaurantes e bares.

Construído com React, TypeScript e Vite. Consome a API REST do [api-tozzo.uk](https://github.com/Torugo-Tozzo/api-tozzo.uk) (repositório privado).

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
VITE_API_URL=http://localhost:3001
```

**4. Inicie o servidor de desenvolvimento**

```bash
bun run dev
# ou
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `bun run dev` | Servidor de desenvolvimento |
| `bun run build` | Build de produção (gera `dist/`) |
| `bun run preview` | Visualiza o build localmente |
| `bun run lint` | Linting com ESLint |

## Deploy com Docker

```bash
docker build --build-arg VITE_API_URL=https://sua-api.com -t front-tozzo .
docker run -p 80:80 front-tozzo
```

O Dockerfile realiza o build em um estágio e serve os arquivos estáticos via Nginx no estágio de produção.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `VITE_API_URL` | URL base da API | `http://localhost:3001` |

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

