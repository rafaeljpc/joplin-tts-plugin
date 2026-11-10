# Joplin Text-to-Speech

[![CI](https://github.com/rafaeljpc/joplin-tts-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaeljpc/joplin-tts-plugin/actions/workflows/ci.yml)
![Coverage](.github/badges/coverage.svg)
![Branch coverage](.github/badges/branches.svg)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Reads the open note aloud, **sentence by sentence**, with a player panel: voice selection, play/pause, previous/next/stop and playback speed.

> Status: **v0.1 (early)**. Desktop first. See [doc/spec](doc/spec/README.md) for the design, platform analysis and roadmap.

## Features

- **Where reading starts:** in the Markdown editor it starts at the sentence under the cursor; if you select text (editor or viewer), only the selection is read. Otherwise the whole note is read from the beginning. Unverified in the legacy CodeMirror 5 editor, which is not supported for this.

- 🔊 Button in the note toolbar and above the editor, **Tools → Joplin Text-to-Speech: read note** menu item and `Ctrl/Cmd+Alt+R`.
- Player panel with voice picker, speed (0.75×–2×), progress ("Sentence 3 of 8") and the current sentence.
- Four speech engines (pick one in the settings):
  - **System voices** (Web Speech API) — offline, free.
  - **Google Translate** — online, free, no key, one voice per language. It uses an unofficial public endpoint, so it may change or stop working.
  - **Microsoft Azure Speech** — neural voices, official API; bring your own key (the free tier covers 500,000 characters per month).
  - **Google Cloud Text-to-Speech** — official API; bring your own key.
- Markdown is converted to speakable text (code blocks, links, images and HTML are skipped).
- English and Brazilian Portuguese UI.

## Install

1. Download `com.rafaeljpc.joplin-tts.jpl` from the [releases](../../releases).
2. Joplin → **Tools → Options → Plugins → ⚙ → Install from file**.
3. Restart Joplin.

## Settings

**Tools → Options → Joplin Text-to-Speech**: speech engine, API keys (stored securely), Azure region, language code (e.g. `pt-BR`) for the online engines, read the title first. Voice and speed are chosen in the player panel.

> With any online engine (Google Translate, Google Cloud, Azure) the text of the note is sent to that service. System voices never leave your device.

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
