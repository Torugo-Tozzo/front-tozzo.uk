# Fase 7 — LGPD Bloco 3: triagem de dependências do front

## Estado antes do patch

Comando executado em 2026-08-29:

```text
bun audit
```

O comando terminou com exit 1, como esperado quando há advisories, e reportou
60 vulnerabilidades: 27 high, 31 moderate e 2 low.

## Triagem das cadeias

| Pacote vulnerável | Cadeia reportada pelo audit | Classe | Razão |
| --- | --- | --- | --- |
| `@babel/core` (1 advisory) | `@vitejs/plugin-react > @babel/plugin-transform-react-jsx-source > @babel/core > @babel/helper-module-transforms` | Dev-tooling só | Babel é usado pelo plugin React durante o build Vite; não há import de Babel em `src/` e o pacote não é enviado ao bundle do navegador. |
| `axios` (29 advisories) | `(direct dependency)` | Runtime real | Importado e executado em `src/services/api.ts:1` para as chamadas HTTP da aplicação. |
| `esbuild` (1 advisory) | `vite > esbuild` | Dev-tooling só | `esbuild` é dependência interna do Vite para desenvolvimento/build; não há import em `src/` nem execução no navegador. |
| `follow-redirects` (1 advisory) | `axios > follow-redirects` | Dev-tooling só | É o adaptador Node transitivo do Axios; o front é um artefato estático e esse pacote não é importado em `src/` nem enviado ao bundle browser. |
| `form-data` (1 advisory) | `axios > form-data` | Dev-tooling só | É a dependência transitiva do adaptador Node do Axios; não é importada em `src/` nem enviada ao bundle browser. |
| `nanoid` (2 advisories) | `postcss > nanoid` | Dev-tooling só | É usado pelo PostCSS no processamento de CSS; não há import em `src/` e não executa no navegador após o build. |
| `picomatch` (4 advisories) | `tailwindcss > fast-glob > micromatch > picomatch` | Dev-tooling só | É usado pela descoberta de arquivos do Tailwind durante o build; não é importado em `src/` nem enviado ao bundle browser. |
| `postcss` (4 advisories) | `(direct dependency)`; `autoprefixer > postcss`; `tailwindcss > postcss-nested > postcss`; `vite > postcss` | Dev-tooling só | É processador de CSS executado no build; consta em `devDependencies`, não é importado em `src/` e não é enviado ao bundle browser. |
| `react-router` (13 advisories) | `(direct dependency)`; `react-router-dom > react-router` | Runtime real | A aplicação importa `react-router-dom` em `src/App.tsx:2` e em várias páginas/layouts; o roteamento é executado no navegador. |
| `rollup` (1 advisory) | `vite > rollup` | Dev-tooling só | Rollup é o empacotador usado pelo Vite durante o build; não há import em `src/` e não executa no navegador. |
| `vite` (3 advisories) | `(direct dependency)`; `@vitejs/plugin-react > vite` | Dev-tooling só | Vite é invocado pelos scripts `dev`, `build` e `preview` de `package.json`; o navegador recebe apenas o artefato estático gerado. |

Os advisories agrupados acima correspondem integralmente ao output do audit
inicial. A classificação usa o critério do plano: runtime real somente quando
o pacote chega ao bundle enviado ao navegador; ferramentas de build e
dependências Node transitivas ficam em dev-tooling só.

## Resultado após `bun audit fix`

Foram executadas duas rodadas do comando permitido, sempre sem
`--latest`. A primeira corrigiu 43 vulnerabilidades em 10 pacotes; como ela
deixou `react-router` em 7.18.0 e revelou o advisory `GHSA-qwww-vcr4-c8h2`,
a segunda rodada atualizou esse pacote para 7.18.2 e corrigiu mais uma
vulnerabilidade. O lockfile final contém, entre outras, estas versões:

- `@babel/core` 7.29.6
- `axios` 1.18.0, com `follow-redirects` 1.16.0 e `form-data` 4.0.6
- `nanoid` 3.3.18 e `postcss` 8.5.23
- `picomatch` 2.3.2/4.0.4 e `rollup` 4.59.0
- `react-router` 7.18.2 (permanece também `react-router` 7.10.1 por
  `react-router-dom` 7.10.1)
- `vite` permanece 5.4.21; o upgrade para 6.x foi bloqueado pela faixa
  `^5.1.4` declarada em `package.json`, assim como `esbuild` 0.21.5 pela
  faixa do Vite.

O reaudit final foi executado com:

```text
bun audit
```

Resultado: exit 1 com 17 vulnerabilidades — 8 high e 9 moderate — nas
cadeias `vite > esbuild`, `react-router-dom > react-router` (a cópia
7.10.1 transitiva) e `vite`. A redução foi de 60 para 17, totalizando 43
advisories iniciais corrigidos.

Não há advisory novo no resultado final em relação ao audit inicial; o
`GHSA-qwww-vcr4-c8h2` intermediário foi eliminado pela segunda execução
in-range. As vulnerabilidades restantes dependem de upgrade major do Vite
ou da atualização do `react-router-dom`, fora do escopo do `bun audit fix`
in-range desta task.
