@AGENTS.md

# Claude Code neste repo

## Roteamento entre agentes

A sessão principal planeja, decide e conversa com o usuário. O trabalho pesado em tokens vai para os subagents em `.claude/agents/`:

| Tarefa | Agente | Modelo |
|---|---|---|
| Achar código: grep, glob, AST, símbolos, referências, chaves i18n, rotas, histórico do git | `code-navigator` | Haiku |
| Rodar testes, build, `i18n:check` e Playwright; acompanhar CI; resumir logs longos | `test-runner` | Haiku |
| Abrir páginas no navegador para inspecionar: snapshot, screenshot, console, rede, conferir um fluxo à mão | `browser-inspector` | Haiku |
| Escrever ou corrigir specs Playwright (E2E, visual, acessibilidade, mocks com `page.route`) e depurar testes de navegador | `e2e-playwright` | Opus |
| Escrever ou alterar código (componentes, páginas, `src/`), com escopo claro | `implementer` | Opus |
| Revisar diff antes de commit ou push | `reviewer` | Opus |

Regras:
- **Busca ampla** vai para o `code-navigator`. Um lookup pontual, de arquivo conhecido, a sessão faz direto.
- **Saída longa** (suíte, Playwright, `gh run watch`) vai para o `test-runner`.
- **Navegador:**
  - olhar ou diagnosticar vai para o `browser-inspector`;
  - escrever teste vai para o `e2e-playwright`;
  - o que a inspeção descobrir vira spec.
- **Implementação:**
  - mudança pequena e com contexto já carregado a sessão faz direto;
  - tarefa maior e bem especificada (página, fase do Solid) vai para o `implementer`, com objetivo, arquivos, critério de pronto e restrições no prompt.
- **Antes de push** de algo não trivial, rode o `reviewer`.
- Subagents não chamam outros subagents. O prompt de cada um precisa ser autossuficiente.

## Ferramentas

- **Serena** para símbolos TypeScript (ative o projeto `front-tozzo.uk`); `rg` como alternativa.
- **Playwright:**
  - `bun run browser:install` uma vez;
  - `bun run browse …` (Playwright CLI) para automação;
  - artefatos ficam fora do Git.
- **Claude in Chrome** para inspecionar o navegador real (console, rede, GIF de fluxo): carregue as ferramentas numa única ToolSearch e use uma aba nova.
- **RTK** reescreve comandos para economizar saída; se vier truncada, leia a original (`rtk proxy <cmd>`).
- **Windows:** os scripts do `package.json` usam sintaxe POSIX (`VAR=x cmd`), então rode pelo Bash. Heredoc longo engasga: escreva scripts com Write.
