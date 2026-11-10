# Read Aloud (TTS) — Joplin plugin

Reads the open note aloud, **sentence by sentence**, with a player panel: voice selection, play/pause, previous/next/stop and playback speed.

> Status: **v0.1 (early)**. Desktop first. See [doc/spec](doc/spec/README.md) for the design, platform analysis and roadmap (in Portuguese).

## Features

- 🔊 Toolbar button, **Tools → Read note aloud** menu item and `Ctrl/Cmd+Alt+R`.
- Player panel with voice picker, speed (0.75×–2×), progress ("Sentence 3 of 8") and the current sentence.
- Two speech engines:
  - **System voices** (Web Speech API) — offline, free.
  - **Google Cloud Text-to-Speech** — bring your own API key.
- Markdown is converted to speakable text (code blocks, links, images and HTML are skipped).
- English and Brazilian Portuguese UI.

## Install

1. Download `com.rafaeljpc.joplin-tts.jpl` from the [releases](../../releases).
2. Joplin → **Tools → Options → Plugins → ⚙ → Install from file**.
3. Restart Joplin.

## Settings

**Tools → Options → Read Aloud (TTS)**: speech engine, Google Cloud API key (stored securely), Google language code (e.g. `pt-BR`), read the title first. Voice and speed are chosen in the player panel.

> When the Google engine is selected, the text of the note is sent to Google Cloud. System voices never leave your device.

## Development

```bash
npm install
npm run validate   # eslint + prettier + tsc + jest (100% coverage required)
npm run dist       # builds publish/com.rafaeljpc.joplin-tts.jpl
```

Project layout:

```
src/lib/        pure logic (markdown, sentences, player, engines, settings, i18n)
src/webview/    player UI that runs inside the Joplin panel
src/plugin.ts   Joplin integration (panel, commands, settings)
test/mocks/     Joplin API mock for Jest
doc/spec/       design documentation
```

Contributions follow gitflow — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
