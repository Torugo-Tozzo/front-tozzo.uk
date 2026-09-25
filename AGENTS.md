# Web Tozzo — instruções para agentes

## Contexto

React 18, TypeScript, Vite, React Router, Tailwind, componentes Radix e i18next. API irmã: `../api-tozzo.uk`; mobile: `../TozzoBurger`. São repositórios Git independentes.
O planejamento compartilhado está no repositório privado da API, em `../api-tozzo.uk/proximas-etapas/README.md`. Não copie documentos privados completos para este repositório. Se a API não estiver disponível, solicite os documentos necessários ao trabalho.
O guia de trabalho compartilhado fica em `../api-tozzo.uk/skills/tozzo-development/SKILL.md`; leia a referência pertinente à tarefa.

## Mapa

- `src/App.tsx`: rotas e páginas lazy.
- `src/components/ProtectedRoute.tsx`, `src/contexts/AuthContext.tsx`: sessão e acesso.
- `src/layouts/DashboardLayout.tsx`: navegação, badge e shell.
- `src/pages/dashboard/`: páginas; `src/components/dashboard/`: pedidos e vendas.
- `src/services/api.ts`: Axios, sessão GoTrue e conversão da fronteira HTTP.
- `src/lib/legacyWire.ts`: conversão português/inglês; não duplique nos componentes.
- `src/domain/models.ts`, `src/domain/dtos.ts`: contratos tipados.
- `src/hooks/useRealtimeEvents.ts`: EventSource compartilhada por aba.
- `src/i18n/`: recursos, labels e formatação; seis idiomas.
- `src/components/receipt/`: impressão no navegador.

## Comandos

```bash
bun install --frozen-lockfile
bun run dev --host 127.0.0.1 --strictPort
bun run test
bun test src/components/dashboard/PedidosTab.test.tsx
bun run test:e2e
bun run i18n:check
bun run build
```

Testes usam Bun + Testing Library + Happy DOM, com preloads em `bunfig.toml`. Apesar do nome de alguns mocks, não migre a suíte para Vitest. Existe script `lint`, mas confirme a disponibilidade/configuração do ESLint antes de adotá-lo como gate; o package atual não declara ESLint.
Os testes de navegador ficam em `e2e/*.e2e.ts` e usam Playwright/Chromium. `bun run test:e2e` inicia o Vite local; `E2E_BASE_URL=https://dev.tozzo.uk bun run test:e2e` usa homologação. `bun run browse open <URL>` permite navegar e inspecionar a página. Consulte o README para instalação e exemplos.

## Regras

- Confira alterações existentes e preserve-as. Nenhuma mudança de mobile por consequência de uma mudança web.
- Texto de produto passa por i18next; mantenha as mesmas chaves em `en`, `pt-BR`, `es`, `fr`, `zh`, `hi`. Reutilize formatadores de moeda/data/quantidade.
- Use os componentes UI existentes, labels acessíveis, foco de dialogs, estados de carregamento/erro/vazio e botões desabilitados durante mutações.
- Não trate esconder menu como segurança. Defina proteção de URL e exija autorização da API.
- Não crie uma EventSource por componente. Reutilize o hook compartilhado; remova timers/listeners no unmount.
- Formatos HTTP legados ficam no adaptador. Teste o payload realmente serializado, não só o objeto passado a `api.post`.
- Não masque erros com sucesso otimista para pagamentos ou fechamento. Evite envios duplicados e preserve os dados do formulário após falha.
- Sem tokens ou senhas em logs/documentação. Não substituir `.env` por exemplos.
- Não adicione biblioteca se o stack atual resolve a tarefa. Não reformate arquivos alheios ao escopo.
- Ao implementar uma nova feature, crie ou atualize testes automatizados para seus fluxos principais e erros relevantes. Para fluxos visíveis no navegador, inclua um teste Playwright em `e2e/` além dos testes de lógica/componentes pertinentes. Execute os testes afetados; se o ambiente impedir o teste de navegador, relate a limitação.
- Em homologação, use apenas fluxos de leitura nos testes padrão. Fluxos que alteram dados exigem conta e estabelecimento exclusivos para testes, sem credenciais versionadas.

## Ferramentas e entrega

Use Superpowers pertinente e siga especificação/plano aprovado, sem reabrir decisões fixadas. Use Serena para símbolos quando conectado e `rg` como alternativa. RTK pode resumir saída extensa, mas falhas exigem leitura completa. Não delegue automaticamente.
Verifique comportamento afetado, testes, build e traduções. Informe o resultado efetivo de cada gate e qualquer teste não executado. Documentação de uma funcionalidade futura não prova sua implementação.
