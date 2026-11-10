# 05 — Configurações

Seção **Read Aloud (TTS)** em _Ferramentas → Opções_. Todas as chaves têm o prefixo `tts.` para não colidir com outros plugins. Valores lidos passam por `normalizeSettings`, que descarta valores inválidos e usa o padrão.

| Chave                | Tipo   | Padrão      | Visível | Descrição                                                               |
| -------------------- | ------ | ----------- | ------- | ----------------------------------------------------------------------- |
| `tts.engine`         | enum   | `webspeech` | sim     | `webspeech` (vozes do sistema, offline) ou `google` (Google Cloud TTS)  |
| `tts.voice`          | string | `""`        | não     | Voz escolhida no painel; vazio = voz padrão                             |
| `tts.rate`           | string | `"1"`       | não     | Velocidade (0.5–3). Guardada como string: o Joplin não tem tipo _float_ |
| `tts.googleApiKey`   | string | `""`        | sim     | Chave da API Google Cloud. **`secure: true`** (armazenada no chaveiro)  |
| `tts.googleLanguage` | string | `en-US`     | sim     | Código de idioma usado para listar/escolher vozes Google (ex.: `pt-BR`) |
| `tts.readTitle`      | bool   | `true`      | sim     | Lê o título da nota antes do corpo                                      |

## Comandos

| Comando        | Rótulo             | Onde aparece                                      |
| -------------- | ------------------ | ------------------------------------------------- |
| `tts.readNote` | Read note aloud    | Barra da nota, menu Ferramentas, `Ctrl/Cmd+Alt+R` |
| `tts.stop`     | Stop reading aloud | Paleta de comandos                                |

## Segurança e privacidade

- A chave Google é opcional, **fornecida pelo usuário** e guardada como configuração segura.
- Com o motor Google, o **texto das frases é enviado ao Google Cloud**. Com o motor Web Speech nada sai do dispositivo.
- O plugin não coleta telemetria.
