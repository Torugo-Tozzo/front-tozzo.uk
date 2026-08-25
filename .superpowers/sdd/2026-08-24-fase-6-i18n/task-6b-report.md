# Relatório T6-B — Integração React, locale ativo e Settings

## Status

Implementação concluída no branch feat/fase-6-i18n-english-base, partindo do
commit T6-A a493412. O commit desta subtarefa usa o subject:
feat/front:integrate-active-locale-settings.

audit-context/ foi preservado e não foi incluído no commit. A alteração
pré-existente em task-6a-report.md também foi preservada e não foi incluída.
Nenhum arquivo de dev ou main foi tocado. Não foram usados subagentes ou
reviewers.

## Implementação

- Adicionado I18nProvider no root (src/main.tsx) usando a configuração
  i18next e os recursos locais já existentes.
- A mudança de locale atualiza a UI imediatamente via provider, normaliza o
  locale para o conjunto fechado suportado e persiste tozzo.locale em
  localStorage.
- Adicionados metadados lang, data-locale e data-locale-direction no
  documento. O provider fica direction-ready sem alterar dir ou layout RTL;
  a aplicação efetiva de RTL permanece para T8.
- SettingsPage agora usa as chaves existentes de settings, renderiza nomes de
  locale de todos os sete bundles, oferece seletor nativo acessível e
  indicador role="status" com atualização aria-live.
- Adicionados helpers centralizados em src/i18n/format.ts para locale ativo:
  formatNumber, formatCurrencyBRL/formatCurrency/formatBRL, formatDate,
  formatDateTime, formatTime e formatPlural.
- Adicionados labels por IDs estáveis em src/i18n/labels.ts para status e
  categorias de catálogo. IDs desconhecidos e descrições customizadas são
  preservados; dados de negócio não são traduzidos.
- StatusSelect, pedidos, vendas, produtos e gráficos passaram a consumir os
  labels e helpers locale-aware, removendo formatos hardcoded em pt-BR.
- As chaves ausentes de settings.locales foram adicionadas de forma
  consistente aos sete bundles e validadas pelo checker recursivo.

## TDD — RED antes da implementação

Com os testes comportamentais/provider/helpers escritos e ainda sem os módulos
de produção, foi executado:

~~~text
bun test src\i18n\format.test.ts src\i18n\provider.test.tsx src\pages\dashboard\SettingsPage.test.tsx src\components\ui\status-select.test.tsx src\lib\status.test.ts src\i18n\locale.test.ts src\i18n\ui-inventory.test.ts
~~~

Saída RED registrada:

~~~text
src\i18n\format.test.ts:
Cannot find module "./format"

src\i18n\provider.test.tsx:
Cannot find module "./provider"

src\i18n\locale.test.ts:
TypeError: locale.getLocaleDirection is not a function

src\i18n\ui-inventory.test.ts:
missing settings.locales.en, settings.locales.pt-BR, settings.locales.es,
settings.locales.fr, settings.locales.zh, settings.locales.hi and
settings.locales.ar in all seven locales

6 pass
8 fail
4 errors
23 expect() calls
~~~

Também foi executado o teste de Settings antes do atributo acessível ser
adicionado:

~~~text
bun test src\pages\dashboard\SettingsPage.test.tsx

2 pass
1 fail
9 expect() calls

Unable to find role="status" and name "Idioma: Português (Brasil)"
~~~

As falhas eram esperadas: os testes descreviam os helpers/provider, a direção,
as chaves de locale, a tradução de status e o contrato acessível antes da
implementação correspondente.

## TDD — GREEN

Após a implementação mínima, o mesmo conjunto focado foi executado:

~~~text
bun test src\i18n\format.test.ts src\i18n\provider.test.tsx src\pages\dashboard\SettingsPage.test.tsx src\components\ui\status-select.test.tsx src\lib\status.test.ts src\i18n\locale.test.ts src\i18n\ui-inventory.test.ts

bun test v1.4.0 (34cbb9a40)

src\i18n\format.test.ts:
(pass) active-locale helpers > formats BRL, numbers, and dates with the active locale [8.03ms]
(pass) active-locale helpers > selects plural messages using the active locale rules [0.56ms]
(pass) active-locale helpers > translates stable status and catalog IDs while preserving custom labels [2.34ms]

src\i18n\locale.test.ts:
(pass) locale foundation > normalizes supported exact and regional locale values to the closed set [0.15ms]
(pass) locale foundation > reads and persists only normalized supported locales [0.41ms]
(pass) locale foundation > exposes direction metadata without changing the supported locale set [0.09ms]

src\i18n\provider.test.tsx:
(pass) I18nProvider > updates rendered translations, document language, and storage immediately [26.51ms]

src\i18n\ui-inventory.test.ts:
(pass) current hardcoded UI inventory > has a translated resource leaf for the first local inventory batch in every locale [1.02ms]
(pass) current hardcoded UI inventory > has a translated resource leaf for every inventoried UI string in every locale [1.87ms]

src\lib\status.test.ts:
(pass) status > lists all 4 order statuses in workflow order [0.17ms]
(pass) status > maps each status to the approved hex color [0.10ms]
(pass) status > keeps the unknown fallback safe [0.04ms]
(pass) status > maps stable status codes through the requested locale [0.18ms]
(pass) status > falls back to the raw string for an unknown status label [0.04ms]

src\components\ui\status-select.test.tsx:
(pass) StatusSelect > shows the current status label [30.25ms]
(pass) StatusSelect > applies the status color as the trigger border color [14.13ms]
(pass) StatusSelect > calls onValueChange with the new status when an option is picked [82.62ms]
(pass) StatusSelect > is disabled when disabled=true [9.16ms]

src\pages\dashboard\SettingsPage.test.tsx:
(pass) SettingsPage > renders the page heading and appearance section [9.25ms]
(pass) SettingsPage > toggles the theme when the mode button is clicked [17.13ms]
(pass) SettingsPage > changes the active locale immediately and persists the selected value [23.15ms]

21 pass
0 fail
57 expect() calls
Ran 21 tests across 7 files. [600.00ms]
~~~

## Regressão e verificação

Testes completos:

~~~text
bun test v1.4.0 (34cbb9a40)
66 pass
0 fail
250 expect() calls
Ran 66 tests across 19 files. [1009.00ms]
~~~

Checker de bundles:

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

TypeScript:

~~~text
bunx tsc --noEmit
exit code 0
~~~

Build:

~~~text
$ tsc && vite build
vite v5.4.21 building for production...
transforming...
Browserslist: browsers data (caniuse-lite) is 8 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-browserslist-db#readme
✓ 2369 modules transformed.
✓ built in 5.30s
exit code 0
~~~

git diff --check terminou com exit code 0. O Git emitiu somente avisos de
normalização LF/CRLF da configuração do repositório; não houve erro de
whitespace.

Lint:

~~~text
$ eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
bun: command not found: eslint
error: script "lint" exited with code 1
~~~

## Concerns

- O script de lint não pôde rodar porque eslint não está disponível neste
  workspace; nenhuma dependência foi instalada como parte desta subtarefa.
- O build passou, com os avisos existentes de dados desatualizados do
  Browserslist e de chunks maiores que 500 kB.
- Aplicação de layout RTL (dir e ajustes visuais) permanece explicitamente
  fora do escopo e deve ser tratada em T8.
