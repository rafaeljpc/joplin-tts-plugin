# 01 — Visão geral

## Objetivo

Plugin para o [Joplin](https://joplinapp.org/) com um botão **TTS** que lê em voz alta, **frase por frase**, o texto da nota aberta.

## Requisitos do player

1. **Escolher a voz** (e o motor de voz) nas configurações — e também no próprio painel.
2. **Controles de reprodução**: play e pause (mais anterior, próxima e parar).
3. **Controle de velocidade** de reprodução.

## Plataformas-alvo (intenção original)

| Plataforma | Motor pretendido                                    |
| ---------- | --------------------------------------------------- |
| Windows    | Voz Google (via Google Cloud TTS) ou voz do sistema |
| macOS      | Voz Google (via Google Cloud TTS) ou voz do sistema |
| Android    | Google nativo                                       |
| iPhone     | _Em aberto_ — não se sabia como resolver            |

A análise de viabilidade está em [02-analise-plataformas.md](02-analise-plataformas.md).

## Pesquisa de mercado

Não foi encontrado nenhum plugin de TTS que leia o conteúdo de notas do Joplin (apenas nas buscas feitas na sessão — confirmar no catálogo oficial antes de publicar):

- O tópico "Text to speech" no fórum do Joplin é um pedido antigo, sem plugin.
- _Voluble_ é uma extensão do GNOME que lê **notificações** de to-do do Joplin com a voz Piper; não lê o conteúdo das notas.
- No Obsidian existem referências de interface/funcionalidade: _Voice Aloud_ (leitura frase por frase com destaque) e _Note Reader_ (voz local ou Azure).

## Escopo da v0.1

Inclui:

- Painel player (voz, play/pause, anterior/próxima/parar, velocidade, progresso "Frase N de M").
- Botão na barra de ferramentas da nota + item no menu Ferramentas + atalho.
- Motor **Web Speech** (vozes do sistema, offline) e motor **Google Cloud TTS** (chave do usuário).
- Conversão de Markdown para texto falável e divisão em frases.
- Interface em inglês e português (pt-BR).

Fora do escopo da v0.1 (ver [07-roadmap-e-decisoes.md](07-roadmap-e-decisoes.md)):

- Destaque da frase atual **dentro da nota** (v0.1 mostra a frase só no painel).
- Motor offline Piper/WASM.
- API de TTS nativo do Android (exigiria contribuição ao núcleo do Joplin).
- Suporte efetivo no iPhone (depende da lista de plugins recomendados).
