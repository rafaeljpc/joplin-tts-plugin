# 02 — Análise por plataforma

> Resumo da análise: no **desktop** dá para fazer com certeza. No **Android** é provável precisar de um _fallback_. No **iPhone**, só com um motor que gere áudio e depois de o plugin entrar na lista de "recomendados". Nada abaixo foi testado em dispositivo; o que não tem fonte é _inferência_.

## Arquitetura comum entre plataformas

- **Painel (webview)**: `joplin.views.panels` exibe HTML e `postMessage` liga painel e plugin. O player vive no painel.
- **Leitura da nota**: `joplin.workspace.selectedNote()` → texto → frases → painel.
- **Frase por frase**: o painel lê uma frase, espera o fim e segue para a próxima.
- **Configurações**: `joplin.settings` guarda voz, velocidade e provedor.
- **Interface `TtsEngine`**: cada plataforma implementa o seu motor (ver [03-arquitetura.md](03-arquitetura.md)).

## Windows e macOS

- **Web Speech API (`speechSynthesis`)**: o Joplin desktop é Electron, então usa as vozes do sistema, sem custo.
  - Ressalva: as vozes "Google" que aparecem no Chrome são online e do navegador; **não** se deve esperar tê-las no Electron.
- **Google Cloud TTS**: caminho para voz Google de verdade. Exige **chave de API do usuário**, tem cota gratuita e depois é pago. Retorna áudio (mp3) tocado em `<audio>`, com velocidade via `playbackRate`.

## Linux

Um tópico do fórum do Joplin relata que a Web Speech API não funcionou num sistema Linux. O motor Google Cloud é a alternativa.

## Android

O Joplin Android já suporta plugins (instalação por arquivo em "Advanced settings"); eles rodam em webviews.

- _Inferência_: o WebView do Android pode **não** ter `speechSynthesis`. Um plugin do Obsidian relata isso no ambiente dele, que também usa o WebView do Android. **Testar cedo no Joplin.**
- Se não funcionar, duas opções:
  1. **Google Cloud TTS** com `<audio>`, igual ao desktop — a mais simples.
  2. **TTS nativo do Android**: exigiria contribuição ao núcleo do Joplin (por exemplo com `react-native-tts`) para expor uma API ao plugin. Mais trabalho e depende de aprovação do mantenedor.

## iPhone

Dois problemas separados:

1. **Distribuição**: por regras da App Store, o app iOS só instala plugins "recomendados". O plugin só roda no iPhone depois dessa revisão.
2. **Motor**: _inferência_ — o WebView do iOS costuma ter `speechSynthesis`, então talvez funcione com as vozes da Apple; depende da revisão acima.

Alternativas fora do plugin: "Falar Tela"/"Conteúdo Falado" do iOS, ou Web Clipper/exportação para um app de leitura.

## Recomendação

Fazer o **desktop primeiro** com `speechSynthesis`. Em paralelo, o motor "áudio via API" (Google Cloud TTS, ou Piper compilado para WASM, que é offline). Esse segundo motor serve Android e iPhone com o mesmo código, trocando só o provedor. O Piper aparece no fórum do Joplin como ideia, mas não há exemplo pronto conhecido.

## Fontes

- Joplin: Plugins (ajuda)
- Mobile: Plugin support (fórum do Joplin)
- Joplin: API de painéis (`joplin.views.panels`)
- Text to speech (fórum do Joplin)
- Local TTS Reader (Obsidian) — limitação no Android
- Voluble (extensão GNOME)
- Voice Aloud e Note Reader (Obsidian)
