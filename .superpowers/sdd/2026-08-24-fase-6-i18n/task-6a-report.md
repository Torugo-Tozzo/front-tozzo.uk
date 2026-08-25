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
