# Especificação — joplin-tts-plugin

Documentação derivada da sessão de design do projeto (conversa "Plugin TTS para Joplin" no claude.ai) e mantida junto ao código. Onde o código já implementa algo, o documento descreve o comportamento real; onde ainda é intenção, está marcado como **planejado**.

| Documento                                              | Conteúdo                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| [01-visao-geral.md](01-visao-geral.md)                 | Objetivo, requisitos, escopo e não-objetivos                     |
| [02-analise-plataformas.md](02-analise-plataformas.md) | Viabilidade por plataforma (Windows, macOS, Linux, Android, iOS) |
| [03-arquitetura.md](03-arquitetura.md)                 | Componentes, protocolo de mensagens, interface `TtsEngine`       |
| [04-prototipo-ui.md](04-prototipo-ui.md)               | Telas aprovadas e como foram implementadas                       |
| [05-configuracoes.md](05-configuracoes.md)             | Configurações do plugin                                          |
| [06-testes-e-qualidade.md](06-testes-e-qualidade.md)   | Estratégia de testes, cobertura e boas práticas Joplin           |
| [07-roadmap-e-decisoes.md](07-roadmap-e-decisoes.md)   | Decisões tomadas, pendências e roadmap                           |

## Convenções

- **Fato**: confirmado em fonte citada (ver fontes em cada documento).
- **Inferência**: dedução do autor da análise, ainda não testada. Aparece marcada como _inferência_.
- **Planejado**: não implementado nesta versão.
