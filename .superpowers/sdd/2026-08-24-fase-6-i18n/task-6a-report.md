# Relatório T6-A — Fundação local e checker

## Implementação

- Instalei via Bun i18next@26.4.0 e react-i18next@17.0.12 em
  package.json/bun.lock. Nenhum backend remoto de tradução foi adicionado.
- Criei a fundação em src/i18n/:
  - locale.ts: conjunto fechado en, pt-BR, es, fr, zh, hi, ar, normalização de
    tags regionais, fallback en e leitura/gravação em localStorage sob
    tozzo.locale;
  - resources.ts, config.ts, index.ts e i18next.d.ts: recursos locais,
    namespaces, fallbackLng: en, supportedLngs fechado, defaultNS e tipagem da
    instância i18next;
  - locales/{en,pt-BR,es,fr,zh,hi,ar}.json: bundles completos com os 14
    namespaces common, auth, navigation, orders, sales, products, employees,
    charts, settings, sync, printer, status, errors e catalog, construídos a
    partir do inventário real do front. Os textos são chrome de UI; nenhum dado
    de negócio foi traduzido.
- Criei scripts/check-i18n.mjs como biblioteca/CLI. Ele achata folhas, rejeita
  chaves faltantes/extras e compara o conjunto de placeholders por folha,
  reportando locale/namespace/chave. O CLI lê os sete arquivos locais, portanto
  fallback do i18next não mascara bundle incompleto.
- Adicionei i18n:check ao package.json.
- Não alterei main.tsx, App, páginas, componentes, layouts, contexts ou lógica
  de negócio; a migração de telas fica para as subtarefas seguintes.

## Arquivos

Novos/alterados e staged para este commit:

~~~text
bun.lock
package.json
scripts/check-i18n.mjs
scripts/check-i18n.test.mjs
src/i18n/config.ts
src/i18n/i18next.d.ts
src/i18n/index.ts
src/i18n/locale.test.ts
src/i18n/locale.ts
src/i18n/locales/ar.json
src/i18n/locales/en.json
src/i18n/locales/es.json
src/i18n/locales/fr.json
src/i18n/locales/hi.json
src/i18n/locales/pt-BR.json
src/i18n/locales/zh.json
src/i18n/resources.test.ts
src/i18n/resources.ts
.superpowers/sdd/2026-08-24-fase-6-i18n/task-6a-report.md
~~~

O diretório não rastreado preexistente audit-context/ permaneceu fora do
staging e não foi alterado.

## TDD — RED/GREEN real

### RED do normalizer/checker

Antes dos módulos de produção, rodei:

~~~text
bun test src\i18n\locale.test.ts scripts\check-i18n.test.mjs
~~~

Saída real resumida:

~~~text
error: expect(received).not.toBeNull()
Received: null
(fail) i18n bundle checker > reports a missing leaf instead of accepting fallback completion
(fail) i18n bundle checker > reports placeholder incompatibility and extra leaves with their location
(fail) locale foundation > normalizes supported exact and regional locale values to the closed set
(fail) locale foundation > reads and persists only normalized supported locales
0 pass
4 fail
4 expect() calls
~~~

Depois dos testes, implementei o normalizer e o checker mínimos. O primeiro
GREEN real foi:

~~~text
bun test src\i18n\locale.test.ts scripts\check-i18n.test.mjs
bun test v1.4.0 (34cbb9a40)
4 pass
0 fail
16 expect() calls
Ran 4 tests across 2 files.
~~~

### RED/GREEN dos bundles

Escrevi primeiro src/i18n/resources.test.ts e rodei:

~~~text
bun test src\i18n\resources.test.ts
~~~

Saída RED real:

~~~text
error: expect(received).not.toBeNull()
Received: null
(fail) local i18n resources > contains the closed locale set and exactly the required namespaces
0 pass
1 fail
1 expect() calls
~~~

Após criar os sete bundles, resources e configuração, o GREEN focado real foi:

~~~text
bun test src\i18n\resources.test.ts src\i18n\locale.test.ts scripts\check-i18n.test.mjs
5 pass
0 fail
123 expect() calls
Ran 5 tests across 3 files.
~~~

Durante a verificação, typecheck/build inicialmente encontraram duas causas locais:
replaceAll não é suportado pelo lib ES2020 do projeto e o teste precisava
preservar a união literal dos locales. Corrigi cada causa isoladamente e
confirmei o typecheck verde.

## Testes e gates

Dependências:

~~~text
bun add i18next react-i18next
installed i18next@26.4.0
installed react-i18next@17.0.12
3 packages installed
~~~

Checker real:

~~~text
bun run i18n:check
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

Typecheck:

~~~text
bunx tsc --noEmit
exit 0, sem saída
~~~

Suíte completa:

~~~text
bun test
58 pass
0 fail
222 expect() calls
Ran 58 tests across 16 files.
~~~

Build:

~~~text
bun run build
exit 0
vite v5.4.21
2332 modules transformed
built in 4.24s
~~~

Self-review:

~~~text
git diff --cached --check
exit 0
~~~

## Concerns

- bun run lint não pôde executar porque o script existente chama eslint, mas
  eslint não está declarado nas dependências e node_modules/.bin/eslint não
  existe. Não instalei uma dependência de lint fora do escopo T6-A; isso
  permanece como concern de ambiente/repositório.
- O build passou com o aviso já conhecido de caniuse-lite desatualizado.
- A configuração foi criada, mas não foi ligada ao provider/root e nenhuma
  tela foi migrada, conforme o limite explícito da T6-A; isso é trabalho das
  subtarefas T6-B/T6-C.

## Fix round — safe stopping point

### Estado

Status: DONE_WITH_CONCERNS.

Foi iniciado o atendimento do finding sobre cobertura incompleta dos bundles.
O inventário de strings de UI foi transformado primeiro em uma asserção TDD em
`src/i18n/ui-inventory.test.ts`, sem alterar consumidores. A asserção cobre
UI chrome, textos de erro/toast e acessibilidade nos diretórios solicitados,
incluindo explicitamente `ProductSelectionModal.tsx:242`,
`EmployeesPage.tsx:248` e `ChartsPage.tsx:713`.

### TDD RED real

Com o teste escrito antes das alterações de recursos, rodei:

~~~text
bun test src/i18n/ui-inventory.test.ts
bun test v1.4.0 (34cbb9a40)
error: expect(received).toEqual(expected)
(fail) current hardcoded UI inventory > has a translated resource leaf for every inventoried UI string in every locale
0 pass
1 fail
1 expect() calls
~~~

O RED foi esperado: a saída listou chaves ausentes nos sete locales, começando
por `common.footerCopyright`, `products.selection.description`,
`employees.dialog.addTitle` e `charts.pageTitle`, entre outras.

### Trabalho restante

- Adicionar as chaves semânticas faltantes aos sete JSONs (`en`, `pt-BR`,
  `es`, `fr`, `zh`, `hi`, `ar`) com traduções reais e placeholders
  consistentes.
- Rodar GREEN do inventário, `bun run i18n:check`, typecheck, suíte focada e
  suíte completa; fazer self-review do diff.
- Staging/commit coerente do fix e atualização final deste relatório com as
  saídas GREEN.

Nenhum bundle, consumidor, rota, dado de negócio, comentário ou diagnóstico de
console foi alterado nesta rodada. `audit-context/` continua preexistente,
não rastreado e intocado; `dev/main` não foi tocada. Não houve instalação de
backend remoto de tradução nem criação de subagentes.

## Fix round 2 — safe stopping point

### Estado

Status: DONE_WITH_CONCERNS.

O teste foi mantido como guarda ampla e recebeu uma segunda asserção focada no
primeiro lote (`common`, `auth`, `navigation`, `settings`, `status`, `printer`
e `errors`). Nenhum consumidor foi tocado. A execução foi interrompida antes
da alteração dos recursos, portanto os sete JSONs ainda não contêm as novas
folhas desse lote.

### TDD RED real do lote

Após adicionar a guarda focada e antes de alterar qualquer bundle, rodei:

~~~text
bun test src/i18n/ui-inventory.test.ts --test-name-pattern first.*batch
bun test v1.4.0 (34cbb9a40)
error: expect(received).toEqual(expected)
(fail) current hardcoded UI inventory > has a translated resource leaf for the first local inventory batch in every locale
0 pass
1 filtered out
1 fail
1 expect() calls
~~~

### Gap concreto

Ainda falta adicionar, com traduções reais e placeholders preservados, as
chaves do primeiro lote em `en`, `pt-BR`, `es`, `fr`, `zh`, `hi` e `ar`, e
então rodar GREEN focado, `bun run i18n:check`, typecheck e a suíte relevante.
As chaves de `products`, `employees`, `charts`, `orders` e `sales` continuam
abertas para as próximas rodadas. Não há commit para esta rodada; o teste e o
relatório permanecem como alterações locais. `audit-context/` foi preservado e
`dev/main` permaneceu intocada.

## Fix round 3 — common-only repair

### Estado

Status: DONE_WITH_CONCERNS.

Adicionei as 83 folhas `common.*` faltantes nos sete bundles (`en`, `pt-BR`,
`es`, `fr`, `zh`, `hi` e `ar`), com traduções reais, placeholders consistentes
(`{{year}}`, `{{page}}`, `{{total}}`, `{{price}}` e `{{count}}`) e sem alterar
consumidores, outros namespaces, dados de negócio ou `audit-context/`. O teste
amplo de inventário permaneceu fora da execução conforme o brief, pois os
namespaces irmãos continuam sendo trabalho de outras microtarefas.

### Verificações — saídas exatas

Verificação direta de `common.*`:

~~~text
common inventory GREEN: 7 locales, 104 unique leaves, placeholders consistent
~~~

Checker de i18n:

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

Typecheck solicitado:

~~~text
src/i18n/resources.ts(28,3): error TS2322: Type '{ common: { appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; ... 49 more ...; saveChanges: string; }; ... 12 more ...; catalog: { ...; }; }' is not assignable to type 'Record<"auth" | "products" | "orders" | "sales" | "status" | "navigation" | "employees" | "common" | "charts" | "settings" | "sync" | "printer" | "errors" | "catalog", Record<string, string>>'.
  Types of property 'common' are incompatible.
    Type '{ appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; confirm: string; ... 48 more ...; saveChanges: string; }' is not assignable to type 'Record<string, string>'.
      Property '"accessibility"' is incompatible with index signature.
        Type '{ linkedin: string; github: string; email: string; openMenu: string; logout: string; collapseFilters: string; expandFilters: string; toggleTheme: string; close: string; }' is not assignable to type 'string'.
src/i18n/resources.ts(29,3): error TS2322: Type '{ common: { appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; ... 49 more ...; saveChanges: string; }; ... 12 more ...; catalog: { ...; }; }' is not assignable to type 'Record<"auth" | "products" | "orders" | "sales" | "status" | "navigation" | "employees" | "common" | "charts" | "settings" | "sync" | "printer" | "errors" | "catalog", Record<string, string>>'.
  Types of property 'common' are incompatible.
    Type '{ appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; confirm: string; ... 48 more ...; saveChanges: string; }' is not assignable to type 'Record<string, string>'.
      Property '"accessibility"' is incompatible with index signature.
        Type '{ linkedin: string; github: string; email: string; openMenu: string; logout: string; collapseFilters: string; expandFilters: string; toggleTheme: string; close: string; }' is not assignable to type 'string'.
src/i18n/resources.ts(30,3): error TS2322: Type '{ common: { appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; ... 49 more ...; saveChanges: string; }; ... 12 more ...; catalog: { ...; }; }' is not assignable to type 'Record<"auth" | "products" | "orders" | "sales" | "status" | "navigation" | "employees" | "common" | "charts" | "settings" | "sync" | "printer" | "errors" | "catalog", Record<string, string>>'.
  Types of property 'common' are incompatible.
    Type '{ appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; confirm: string; ... 48 more ...; saveChanges: string; }' is not assignable to type 'Record<string, string>'.
      Property '"accessibility"' is incompatible with index signature.
        Type '{ linkedin: string; github: string; email: string; openMenu: string; logout: string; collapseFilters: string; expandFilters: string; toggleTheme: string; close: string; }' is not assignable to type 'string'.
src/i18n/resources.ts(31,3): error TS2322: Type '{ common: { appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; ... 49 more ...; saveChanges: string; }; ... 12 more ...; catalog: { ...; }; }' is not assignable to type 'Record<"auth" | "products" | "orders" | "sales" | "status" | "navigation" | "employees" | "common" | "charts" | "settings" | "sync" | "printer" | "errors" | "catalog", Record<string, string>>'.
  Types of property 'common' are incompatible.
    Type '{ appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; confirm: string; ... 48 more ...; saveChanges: string; };' is not assignable to type 'Record<string, string>'.
      Property '"accessibility"' is incompatible with index signature.
        Type '{ linkedin: string; github: string; email: string; openMenu: string; logout: string; collapseFilters: string; expandFilters: string; toggleTheme: string; close: string; }' is not assignable to type 'string'.
src/i18n/resources.ts(32,3): error TS2322: Type '{ common: { appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; ... 49 more ...; saveChanges: string; }; ... 12 more ...; catalog: { ...; }; }' is not assignable to type 'Record<"auth" | "products" | "orders" | "sales" | "status" | "navigation" | "employees" | "common" | "charts" | "settings" | "sync" | "printer" | "errors" | "catalog", Record<string, string>>'.
  Types of property 'common' are incompatible.
    Type '{ appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; confirm: string; ... 48 more ...; saveChanges: string; }' is not assignable to type 'Record<string, string>'.
      Property '"accessibility"' is incompatible with index signature.
        Type '{ linkedin: string; github: string; email: string; openMenu: string; logout: string; collapseFilters: string; expandFilters: string; toggleTheme: string; close: string; }' is not assignable to type 'string'.
src/i18n/resources.ts(33,3): error TS2322: Type '{ common: { appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; ... 49 more ...; saveChanges: string; }; ... 12 more ...; catalog: { ...; }; }' is not assignable to type 'Record<"auth" | "products" | "orders" | "sales" | "status" | "navigation" | "employees" | "common" | "charts" | "settings" | "sync" | "printer" | "errors" | "catalog", Record<string, string>>'.
  Types of property 'common' are incompatible.
    Type '{ appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; confirm: string; ... 48 more ...; saveChanges: string; }' is not assignable to type 'Record<string, string>'.
      Property '"accessibility"' is incompatible with index signature.
        Type '{ linkedin: string; github: string; email: string; openMenu: string; logout: string; collapseFilters: string; expandFilters: string; toggleTheme: string; close: string; }' is not assignable to type 'string'.
src/i18n/resources.ts(34,3): error TS2322: Type '{ common: { appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; ... 49 more ...; saveChanges: string; }; ... 12 more ...; catalog: { ...; }; }' is not assignable to type 'Record<"auth" | "products" | "orders" | "sales" | "status" | "navigation" | "employees" | "common" | "charts" | "settings" | "sync" | "printer" | "errors" | "catalog", Record<string, string>>'.
  Types of property 'common' are incompatible.
    Type '{ appName: string; loading: string; processing: string; saving: string; search: string; filter: string; filters: string; clear: string; apply: string; save: string; cancel: string; close: string; confirm: string; ... 48 more ...; saveChanges: string; }' is not assignable to type 'Record<string, string>'.
      Property '"accessibility"' is incompatible with index signature.
        Type '{ linkedin: string; github: string; email: string; openMenu: string; logout: string; collapseFilters: string; expandFilters: string; toggleTheme: string; close: string; }' is not assignable to type 'string'.
exit 1
~~~

### Self-review

- `rtk git diff --check -- src/i18n/locales`: exit 0, sem saída.
- O diff de recursos contém somente os sete JSONs locais e somente adições no
  namespace `common`.
- `TODO`/`FIXME`, folhas vazias, placeholders divergentes e preços de negócio
  não foram introduzidos.
- O erro de `tsc` pertence ao tipo flat existente em `src/i18n/resources.ts`;
  esse arquivo permaneceu intocado por estar fora do escopo de escrita.

## Fix round 4 — common resource type safety

### Estado

Status: DONE.

Corrigi o finding TS2322 na fundação sem achatar os namespaces em runtime. O
novo `I18nResource` aceita recursivamente somente folhas `string` ou outros
recursos `I18nResource`; `resources` continua usando `satisfies`, preservando
as chaves aninhadas inferidas dos JSONs. O contrato TDD em
`src/i18n/resources.test.ts` confirma folhas comuns como `string`, aceita um
nó aninhado e rejeita folhas numéricas. Consumidores, outros namespaces e o
lote de traduções comum não foram alterados.

### TDD — RED/GREEN

Depois de adicionar o contrato, o RED real de `bunx tsc --noEmit` saiu com
`I18nResource` ainda não exportado, a asserção de rejeição numérica falhando e
os TS2322 em `resources.ts:28-34`. Após o modelo recursivo, o GREEN foi:

~~~text
bunx tsc --noEmit
exit 0
sem saída
~~~

### Verificações — saídas exatas

Testes i18n relevantes:

~~~text
bun test v1.4.0 (34cbb9a40)

scripts\check-i18n.test.mjs:
(pass) i18n bundle checker > reports a missing leaf instead of accepting fallback completion [13.41ms]
(pass) i18n bundle checker > reports placeholder incompatibility and extra leaves with their location [0.12ms]

src\i18n\locale.test.ts:
(pass) locale foundation > normalizes supported exact and regional locale values to the closed set [0.56ms]
(pass) locale foundation > reads and persists only normalized supported locales [0.21ms]

src\i18n\resources.test.ts:
(pass) local i18n resources > contains the closed locale set and exactly the required namespaces [1.80ms]

 5 pass
 0 fail
 123 expect() calls
Ran 5 tests across 3 files. [819.00ms]
~~~

Checker de i18n:

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

Verificação direta do lote comum:

~~~text
common inventory GREEN: 7 locales, 104 unique leaves, placeholders consistent
~~~

Preservação das namespaces aninhadas em runtime:

~~~text
nested common runtime namespaces preserved: accessibility, landing, plans
~~~

### Self-review

- O diff desta rodada está limitado a `src/i18n/resources.ts`,
  `src/i18n/resources.test.ts` e este relatório.
- O modelo não aceita folhas numéricas, arrays ou valores `unknown`; não há
  flattening de `common.accessibility`, `common.landing` ou `common.plans`.
- `audit-context/`, `src/i18n/ui-inventory.test.ts`, consumidores e
  `dev/main` permanecem intocados.

## Fix round 5 — auth/navigation/settings/status/printer/errors resource repair

### Estado

O lote T6-A foi aplicado somente aos sete bundles locais (`en`, `pt-BR`, `es`,
`fr`, `zh`, `hi` e `ar`). Foram adicionadas apenas as 21 folhas ausentes do
inventário focado: 11 folhas `auth`, `settings.moreComingSoon`,
`printer.printSoon` e oito folhas aninhadas em `errors.products`/
`errors.employees`. `navigation` e `status` já estavam completos e não foram
alterados. Os placeholders existentes permanecem consistentes; não foram
alterados consumidores, dados de negócio ou outras famílias de namespace.

A asserção ampla continua aberta para `products`, `employees`, `charts`,
`orders` e `sales`, conforme esperado para as próximas microtarefas.

### Verificação focada — saída exata

Comando: `bun test src/i18n/ui-inventory.test.ts --test-name-pattern first.*batch`

~~~text
bun test v1.4.0 (34cbb9a40)

src\i18n\ui-inventory.test.ts:
(pass) current hardcoded UI inventory > has a translated resource leaf for the first local inventory batch in every locale [0.88ms]

 1 pass
 1 filtered out
 0 fail
 1 expect() calls
Ran 1 test across 1 file. [267.00ms]
~~~

### Checker de i18n — saída exata

Comando: `bun run i18n:check`

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

### Typecheck — saída exata

Comando: `bunx tsc --noEmit` — exit 0, sem saída.

## Fix round 6 — products/employees resource repair

### Estado

O lote T6-A de `products`/`employees` foi aplicado somente aos sete bundles
locais (`en`, `pt-BR`, `es`, `fr`, `zh`, `hi` e `ar`). Foram adicionadas as 49
folhas ausentes em cada locale: 37 folhas de `products` e 12 de `employees`,
com traduções reais de chrome, labels, status, confirmações e erros. O
placeholder `{{count}}` foi preservado em todos os totais de funcionários.
Nenhum consumidor, tipo, outra família de namespace, dado de negócio,
`audit-context/` ou `dev/main` foi alterado.

A asserção ampla continua aberta para `charts`, `orders` e `sales`, conforme o
brief; esta rodada verifica somente as famílias `products` e `employees`.

### Verificação focada — saída exata

Comando: `bun scripts\.t6a-products-employees-check.mjs`

~~~text
products/employees inventory GREEN: 7 locales, 62 unique leaves
~~~

### Checker de i18n — saída exata

Comando: `bun run i18n:check`

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

### Typecheck — saída exata

Comando: `bunx tsc --noEmit`

~~~text
(sem saída; exit 0)
~~~

### Self-review

- `git diff --check -- src/i18n/locales`: exit 0.
- O diff contém somente os sete JSONs locais; os valores existentes foram
  preservados e as alterações ficam restritas às folhas ausentes em
  `products`/`employees`.
- Não foram adicionados nomes de produtos, ingredientes, estabelecimentos,
  clientes ou descrições comerciais; apenas textos de interface foram
  traduzidos.
- `audit-context/` e `src/i18n/ui-inventory.test.ts` permaneceram fora do
  staging, e `dev/main` não foram tocadas.

## Fix round 7 — charts/orders/sales resource repair

### Estado

O lote final de T6-A foi aplicado somente aos sete bundles locais (en,
pt-BR, es, fr, zh, hi e ar). Foram adicionadas as 60 folhas ausentes por
locale: 46 de charts, seis de orders e oito de sales, com traduções reais de
chrome, filtros, relatórios, visualizações, confirmações, estados vazios,
tooltips e erros. Os placeholders {{count}}, {{day}} e {{total}} foram
preservados; nenhum dado de negócio foi traduzido.

Para suportar os caminhos aninhados do inventário, os rótulos escalares
existentes charts.filters e charts.details foram promovidos aos objetos
filters.title e details.title; os demais leaves legados foram preservados.
Não foram alterados consumidores, checker, tipos, outras famílias de
namespace, audit-context/ ou dev/main.

### Verificação focada — saída exata

Asserção inline das famílias charts, orders e sales:

~~~text
charts/orders/sales inventory GREEN: 7 locales, 70 unique leaves, placeholders consistent
~~~

### Inventário completo — saída exata

Comando: bun test src/i18n/ui-inventory.test.ts

~~~text
bun test v1.4.0 (34cbb9a40)

src\i18n\ui-inventory.test.ts:
(pass) current hardcoded UI inventory > has a translated resource leaf for the first local inventory batch in every locale [0.90ms]
(pass) current hardcoded UI inventory > has a translated resource leaf for every inventoried UI string in every locale [0.93ms]

 2 pass
 0 fail
 2 expect() calls
Ran 2 tests across 1 file. [270.00ms]
~~~

### Checker de i18n — saída exata

Comando: bun run i18n:check

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

### Typecheck — saída exata

Comando: bunx tsc --noEmit

~~~text
(sem saída; exit 0)
~~~

### Self-review

- git diff --check -- src/i18n/locales: exit 0; o diff ficou restrito aos
  sete bundles locais.
- As alterações ficam em charts, orders e sales, sem consumidores, dados de
  negócio, tipos ou outras famílias de namespace.
- Os sete bundles mantêm a mesma topologia; folhas não vazias e placeholders
  foram validados pela asserção focada e pelo checker.

## T6-A closeout — exhaustive UI inventory test

### Estado

Status: DONE.

O teste exaustivo `src/i18n/ui-inventory.test.ts` foi mantido sem alterações.
Ele verifica cada par fonte/chave inventariado contra todos os sete locales e
exige uma folha de recurso existente, string e não vazia. A asserção focada do
primeiro lote foi preservada como guarda histórica; não foram alterados
bundles, consumidores, dados de negócio, `audit-context/` ou `dev/main`.

### Inventário completo — saída exata

Comando: `bun test src/i18n/ui-inventory.test.ts`

~~~text
bun test v1.4.0 (34cbb9a40)

src\i18n\ui-inventory.test.ts:
(pass) current hardcoded UI inventory > has a translated resource leaf for the first local inventory batch in every locale [0.92ms]
(pass) current hardcoded UI inventory > has a translated resource leaf for every inventoried UI string in every locale [1.08ms]

 2 pass
 0 fail
 2 expect() calls
Ran 2 tests across 1 file. [268.00ms]
~~~

### Checker de i18n — saída exata

Comando: `bun run i18n:check`

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

### Typecheck — saída exata

Comando: `bunx tsc --noEmit`

~~~text
(sem saída; exit 0)
~~~

### Self-review

- O teste não tem alterações locais além do arquivo novo solicitado; a
  verificação de folhas rejeita caminhos ausentes, nós intermediários,
  valores não-string e strings vazias.
- O inventário cobre `src/pages`, `src/components`, `src/layouts` e
  `src/contexts` por meio das entradas fonte/chave declaradas; todos os sete
  locales passam.
- Nenhum bundle, consumidor, dado de negócio, `audit-context/`, `dev/main` ou
  outra parte do teste foi alterado.
- O commit desta rodada deve conter somente `src/i18n/ui-inventory.test.ts`,
  com subject `test(front): ...`; este relatório fica fora do commit.

## Fix round 9 — toast/error fallback inventory closeout

### Estado

Status: DONE.

Commit: a493412 — fix(front):complete-toast-fallback-inventory.

O finding foi corrigido sem alterar consumidores ou dados de negócio. O
inventário agora cobre os 26 sites de toast encontrados em
`src/pages`/`src/components`, incluindo todos os fallbacks de erro nomeados
na revisão; `src/layouts` e `src/contexts` não possuem sites de toast nessa
auditoria. As coordenadas dos entries tocados foram atualizadas para as linhas
atuais. Os leaves reutilizam `auth`/`errors` existentes quando disponíveis e
adicionam somente `errors.products.selectItems`,
`errors.employees.create` e `errors.employees.update` nos sete bundles.

### TDD RED — saída exata

Comando: bun test src/i18n/ui-inventory.test.ts — exit 1

~~~text
bun test v1.4.0 (34cbb9a40)

src\i18n\ui-inventory.test.ts:
error: expect(received).toEqual(expected)

- []
+ [
+   "en: errors.products.selectItems (src/components/ProductSelectionModal.tsx:212)",
+   "en: errors.employees.create (src/pages/dashboard/EmployeesPage.tsx:148)",
+   "en: errors.employees.update (src/pages/dashboard/EmployeesPage.tsx:184)",
+   "pt-BR: errors.products.selectItems (src/components/ProductSelectionModal.tsx:212)",
+   "pt-BR: errors.employees.create (src/pages/dashboard/EmployeesPage.tsx:148)",
+   "pt-BR: errors.employees.update (src/pages/dashboard/EmployeesPage.tsx:184)",
+   "es: errors.products.selectItems (src/components/ProductSelectionModal.tsx:212)",
+   "es: errors.employees.create (src/pages/dashboard/EmployeesPage.tsx:148)",
+   "es: errors.employees.update (src/pages/dashboard/EmployeesPage.tsx:184)",
+   "fr: errors.products.selectItems (src/components/ProductSelectionModal.tsx:212)",
+   "fr: errors.employees.create (src/pages/dashboard/EmployeesPage.tsx:148)",
+   "fr: errors.employees.update (src/pages/dashboard/EmployeesPage.tsx:184)",
+   "zh: errors.products.selectItems (src/components/ProductSelectionModal.tsx:212)",
+   "zh: errors.employees.create (src/pages/dashboard/EmployeesPage.tsx:148)",
+   "zh: errors.employees.update (src/pages/dashboard/EmployeesPage.tsx:184)",
+   "hi: errors.products.selectItems (src/components/ProductSelectionModal.tsx:212)",
+   "hi: errors.employees.create (src/pages/dashboard/EmployeesPage.tsx:148)",
+   "hi: errors.employees.update (src/pages/dashboard/EmployeesPage.tsx:184)",
+   "ar: errors.products.selectItems (src/components/ProductSelectionModal.tsx:212)",
+   "ar: errors.employees.create (src/pages/dashboard/EmployeesPage.tsx:148)",
+   "ar: errors.employees.update (src/pages/dashboard/EmployeesPage.tsx:184)",
+ ]

(fail) current hardcoded UI inventory > has a translated resource leaf for the first local inventory batch in every locale
(fail) current hardcoded UI inventory > has a translated resource leaf for every inventoried UI string in every locale

 0 pass
 2 fail
 2 expect() calls
Ran 2 tests across 1 file. [275.00ms]
~~~

### TDD GREEN — inventário completo

Comando: bun test src/i18n/ui-inventory.test.ts — exit 0

~~~text
bun test v1.4.0 (34cbb9a40)

src\i18n\ui-inventory.test.ts:
(pass) current hardcoded UI inventory > has a translated resource leaf for the first local inventory batch in every locale [1.01ms]
(pass) current hardcoded UI inventory > has a translated resource leaf for every inventoried UI string in every locale [0.96ms]

 2 pass
 0 fail
 2 expect() calls
Ran 2 tests across 1 file. [267.00ms]
~~~

### Checker de i18n — saída exata

Comando: bun run i18n:check — exit 0

~~~text
$ node scripts/check-i18n.mjs
i18n bundles OK: 7 locales, 14 namespaces
~~~

### Typecheck — saída exata

Comando: bunx tsc --noEmit — exit 0

~~~text
(sem saída)
~~~

### Testes focados — saída exata

Comando: bun test scripts/check-i18n.test.mjs src/i18n/locale.test.ts src/i18n/resources.test.ts — exit 0

~~~text
bun test v1.4.0 (34cbb9a40)

scripts\check-i18n.test.mjs:
(pass) i18n bundle checker > reports a missing leaf instead of accepting fallback completion [1.06ms]
(pass) i18n bundle checker > reports placeholder incompatibility and extra leaves with their location [0.12ms]

src\i18n\locale.test.ts:
(pass) locale foundation > normalizes supported exact and regional locale values to the closed set [0.46ms]
(pass) locale foundation > reads and persists only normalized supported locales [0.17ms]

src\i18n\resources.test.ts:
(pass) local i18n resources > contains the closed locale set and exactly the required namespaces [1.97ms]

 5 pass
 0 fail
 123 expect() calls
Ran 5 tests across 3 files. [272.00ms]
~~~

### Self-review

- git grep -n toast -- src/pages src/components confirma os 26 sites de toast;
  cada fallback está representado no inventário com a coordenada atual.
- src/layouts e src/contexts não retornam sites de toast; não há omissões da
  mesma família nesses diretórios.
- Os sete JSONs receberam somente as três folhas nested novas, sem placeholders
  ou dados de negócio; os demais fallbacks apontam para leaves semânticos já
  existentes em auth/errors.
- O commit coerente desta correção deve conter somente
  src/i18n/ui-inventory.test.ts e os sete bundles de locale; este relatório
  permanece fora do staging.
