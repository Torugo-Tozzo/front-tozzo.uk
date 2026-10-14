# Convenções

## Regra principal

**O visual não muda; só o framework.** Isso vale para tokens, classes Tailwind, componentes, ícones, textos, responsividade, temas claro e escuro, estados vazios, toasts e diálogos.

- Gráficos e tabelas podem ter diferenças pequenas que vêm da biblioteca, mas mantêm cores, fontes, card, títulos e legendas.
- `web/tailwind.config.js` e `web/src/index.css` são cópias do React. Mudar token ou cor exige o "ok" do usuário.
- Uma página só está migrada quando o teste visual bate com o baseline do React ([TESTING.md](TESTING.md#visual)).

## Gerais (React e Solid)

- Código em inglês; documentos em português. Commits `feat:`/`fix:`/`test:`/`docs:`…
- Siga o estilo do arquivo em volta. Não reformate arquivos fora do escopo.
- Mudança no web não leva a nenhuma mudança no mobile; o efeito só é registrado no acompanhamento mobile.
- **Texto visível só por i18next**, com as **mesmas chaves** nos 6 idiomas (`en`, `pt-BR`, `es`, `fr`, `zh`, `hi`). Rode `i18n:check`. Use os formatadores de moeda, data e quantidade.
- **Componentes UI existentes primeiro**, com:
  - labels acessíveis e foco gerenciado nos diálogos;
  - estados de carregamento, erro e vazio;
  - botão desabilitado durante mutação.
- **Sem envio duplicado.** Não masque erro com sucesso otimista em pagamento ou fechamento, e preserve os dados do formulário quando der falha.
- Esconder menu não é segurança: proteja a rota e conte com a autorização da API.
- **Biblioteca nova** só se o stack atual (ou o mapa de bibliotecas do plano) não resolver, e perguntando antes. A licença também conta (ver [SECURITY.md](SECURITY.md#dependências)).

## Solid (`web/`)

1. **Dados remotos** só por TanStack Query e pelo cliente `openapi-fetch` (`web/src/api/`). Nada de `fetch` solto em componente.
2. **Erros da API** chegam em `problem+json` com `code`. A mensagem vem de `web/src/i18n/error-keys.ts` pelo `code`, nunca do `detail`.
3. **Dinheiro** chega em centavos (`…Cents`). Formate com `web/src/i18n/format.ts`; nunca divida por 100 no componente.
4. **Tempo real** só pelo `web/src/realtime.ts`. Nenhum componente abre `EventSource`.
5. **Sessão:** access token só em memória. Nada de token em `localStorage`.
6. **Rotas pesadas com `lazy()`.** O ECharts só no chunk de relatórios. Respeite as metas de tamanho ([ARCHITECTURE.md](ARCHITECTURE.md#metas-de-desempenho-solid)).
7. **Primitivas `ui/`** com as mesmas classes e variantes CVA do React. Os atributos de estado do Radix viram os do Kobalte (`data-[state=open]` → `data-[expanded]`), mantendo o efeito. Confira cada um na documentação da versão instalada.
8. `web/src/api/schema.d.ts` é gerado (`bun run api:types`): nunca edite à mão.
9. Testes no `web/` são em **Vitest**: é a exceção à regra "não migre para Vitest", que vale só para o React.
10. **Kobalte no lugar do Radix**, ao portar uma tela:
    - `class` em vez de `className`;
    - um trigger vira `as={Button}` em vez de `asChild`;
    - o `Select` recebe `options` e `itemComponent` (com `<SelectItem item={...}>`), e o trigger dele tem papel `button`, não `combobox`.

    O `/__ui` (`web/src/pages/dev/UiShowcasePage.tsx`) tem um exemplo de cada.
11. **Rotas** com `lazyPage()` (`web/src/lib/lazy-page.ts`), que recarrega uma vez quando o chunk sumiu depois de um deploy.

## React (raiz, congelado)

- Formatos HTTP legados ficam no adaptador (`src/lib/legacyWire.ts`, `src/services/api.ts`). Teste o payload realmente serializado, não só o objeto passado a `api.post`.
- Uma `EventSource` por aba, pelo hook compartilhado. Timers e listeners saem no unmount.
- A suíte continua em `bun test` (Testing Library + happy-dom); não migre para Vitest.
