# 06 — Testes e qualidade

## Boas práticas do Joplin adotadas

- Estrutura gerada pelo `generator-joplin` (`src/`, `api/`, `webpack.config.js`, `plugin.config.json`, `publish/`).
- Pacote npm `joplin-plugin-*` com a palavra-chave `joplin-plugin` e `files: ["publish"]`.
- `manifest.json` completo: `id` único em notação reversa, `app_min_version`, `categories`, `repository_url`, `homepage_url`.
- Configurações registradas numa seção própria, com chaves com prefixo e segredos com `secure: true`.
- Comandos registrados com `joplin.commands` e expostos por toolbar/menu (nada de atalhos soltos).
- Interface em inglês com tradução pt-BR; sem dependências em tempo de execução (bundle pequeno).
- Versão sincronizada entre `package.json` e `manifest.json` (`npm run updateVersion`).

## Estratégia de testes

Jest + ts-jest. O código foi organizado para que quase tudo seja puro e testável:

| Camada                   | Como é testada                                                                |
| ------------------------ | ----------------------------------------------------------------------------- |
| `lib/*` (lógica)         | Testes unitários puros; motores com `speechSynthesis`/`fetch`/`Audio` _fakes_ |
| `webview/player.ts` (UI) | `jest-environment-jsdom`: DOM real simulado, mensagens simuladas, cliques     |
| `plugin.ts` / `index.ts` | API do Joplin substituída por _mock_ (`test/mocks/joplinApi.ts`)              |

- **Cobertura mínima exigida** (falha o CI): 100% de _statements_, linhas e funções; 95% de _branches_. Hoje o projeto está em 100% em todas as métricas.
- Cenários cobertos incluem: cancelamento durante requisição, falas obsoletas após pause/seek, fallback de `Intl.Segmenter`, vozes que carregam tardiamente, erros de API, mensagens em formato embrulhado, painel oculto, troca de nota.

## Verificação local

```bash
npm run validate   # eslint + prettier --check + tsc --noEmit + jest --coverage
npm run dist       # gera publish/com.rafaeljpc.joplin-tts.jpl
```

## Limites dos testes automatizados

Os _fakes_ garantem a lógica, **não** o comportamento real de `speechSynthesis` no Electron, do WebView do Android ou do iOS. Esses pontos exigem teste manual em cada plataforma (ver checklist em [07-roadmap-e-decisoes.md](07-roadmap-e-decisoes.md)).
