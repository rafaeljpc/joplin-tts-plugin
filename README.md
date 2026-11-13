# Joplin Text-to-Speech

[![CI](https://github.com/rafaeljpc/joplin-tts-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaeljpc/joplin-tts-plugin/actions/workflows/ci.yml)
![Coverage](.github/badges/coverage.svg)
![Branch coverage](.github/badges/branches.svg)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Reads the open note aloud, **sentence by sentence**, with a player panel: voice selection, play/pause, previous/next/stop and playback speed.

> Status: **v0.1 (early)**. Desktop first. See [doc/spec](doc/spec/README.md) for the design, platform analysis and roadmap.

## Features

- **Where reading starts:** in the Markdown editor, at the sentence under the cursor; if you select text (editor or viewer), only the selection is read; otherwise the whole note from the beginning. This needs the CodeMirror 6 editor.
- 🔊 Button in the note toolbar and above the editor, **Tools → Joplin Text-to-Speech: read note** menu item and `Ctrl/Cmd+Alt+R`.
- The sentence being read is highlighted in the note, in the Markdown editor and in the rendered view.
- Online engines prefetch the next sentence, so there is no pause between sentences.
- Player panel with voice picker, speed (0.75×–3×), progress ("Sentence 3 of 8") and the current sentence.
- Five speech engines (pick one in the settings):
  - **System voices** (Web Speech API) — offline, free.
  - **Google Translate** — online, free, no key, one voice per language. It uses an unofficial public endpoint, so it may change or stop working.
  - **Microsoft Azure Speech** — neural voices, official API; bring your own key (the free tier covers 500,000 characters per month).
  - **Google Cloud Text-to-Speech** — official API; bring your own key.
  - **Piper** — neural voices that run **offline** on your computer. You download the voices you want (about 60 MB each) in a dialog; see [Piper voices](#piper-voices).
- Markdown is converted to speakable text (code blocks, links, images and HTML are skipped).
- English and Brazilian Portuguese UI.

## Install

1. Download `com.rafaeljpc.joplin-tts.jpl` from the [releases](../../releases).
2. Joplin → **Tools → Options → Plugins → ⚙ → Install from file**.
3. Restart Joplin.

## Platform support

✅ tested and working · ⚠️ not tested · ❌ tested and does not work · ⬜ not available on this platform

| Engine                      | Windows | macOS | Linux | Android | iOS |
| --------------------------- | :-----: | :---: | :---: | :-----: | :-: |
| System voices               |   ✅    |  ✅   |  ⚠️   |   ❌    | ⚠️  |
| Google Translate            |   ✅    |  ✅   |  ⚠️   |   ✅    | ⚠️  |
| Piper                       |   ✅    |  ✅   |  ⚠️   |   ⬜    | ⬜  |
| Microsoft Azure Speech      |   ⚠️    |  ⚠️   |  ⚠️   |   ⚠️    | ⚠️  |
| Google Cloud Text-to-Speech |   ⚠️    |  ⚠️   |  ⚠️   |   ⚠️    | ⚠️  |

Tested by the author on Windows and macOS (system voices, Google Translate and Piper) and on Android (system voices do not work; Google Translate works). The Azure and Google Cloud engines have not been tested because no API key was available; reports are welcome.

Android installs a plugin from a file (**Configuration → Plugins → Advanced settings**), so it can be tested directly. The iOS app, to follow App Store rules, only installs plugins that the Joplin team marks as [recommended](https://joplinapp.org/help/apps/plugins), so this plugin cannot be installed on iOS today and has not been tested there. Android is tested only as described above; iOS is untested rather than ruled out.

On Android the System voices engine depends on the WebView exposing a working `speechSynthesis`; many Android WebViews do not (no API, no voices, or speech that never starts). The player then says so and suggests the **Google Translate** engine. With any online engine the text is sent to that service; the plugin never switches to one by itself.

On mobile the player opens in a compact dialog instead of the full-screen panel (it is modal, so the note is dimmed behind it; close it by tapping outside). The advanced setting _Player in a dialog_ turns it off (Joplin gives plugins no way to dock a panel at the bottom of the screen).

The manifest declares mobile support and the code avoids Node-only features there. On mobile, Piper is not available: Joplin gives mobile plugins no file access (`fs`, `dataDir`), so the voices cannot be stored. It will be reconsidered if Joplin adds one. The Tools menu, keyboard shortcut, editor highlight and cursor tracking may be missing depending on what Joplin mobile provides; reading itself does not depend on them. The system voices need `speechSynthesis` in the mobile WebView; if it is missing, the player says so.

## Settings

**Tools → Options → Joplin Text-to-Speech**: speech engine, API keys (stored securely), Azure region, language (a dropdown of codes such as `pt-BR`; a value typed in an older version is kept as a "Custom" option) for the online engines and the Piper voice list, read the title first, Piper voices URL (advanced). Voice and speed are chosen in the player panel.

> With any online engine (Google Translate, Google Cloud, Azure) the text of the note is sent to that service. System voices never leave your device.

## Piper voices

Piper is the offline neural engine. Nothing is bundled and no voice is downloaded by default:

1. Choose **Piper** as the speech engine in the settings. A **voice dialog** opens and lists the voices of the catalog (filtered by your language code), with the size of each one. It cannot be left until you download and select a voice, or go back to another engine (closing the dialog counts as going back).
2. **Download** a voice and select it. The first download also fetches about 30 MB of runtime files (eSpeak and ONNX Runtime, WebAssembly) shared by all voices. Everything is stored in the plugin's data folder.
3. Reopen the screen any time with **Tools → Joplin Text-to-Speech: Piper voices** to download or remove voices.

Without an internet connection the screen lists only the downloaded voices; if there are none, Piper cannot be used and you go back to another engine. After the first download Piper works fully offline.

The voice catalog (`rhasspy/piper-voices` on Hugging Face) is the advanced setting **Piper voices URL**; if it ever moves, change it there. Runtime files come from a pinned CDN version and are checked against a SHA-256 before use.

> **Licenses:** the Piper voices are MIT-licensed, but the individual voice datasets have their own licenses (see the model card of each voice). The eSpeak NG phonemizer that Piper needs is GPL-3.0; it is **downloaded at runtime, not bundled** in this plugin.

### Step by step: first voice

1. **Tools → Options → Joplin Text-to-Speech**: set **Language** (for example Portuguese (Brazil) — `pt-BR`) so the list opens already filtered, then set **Speech engine** to **Piper**.
2. The voice dialog opens. Pick a voice (quality: `low` is the smallest and fastest, `medium` is the usual choice, `high` is the biggest) and press **Download**. The first one also downloads the shared runtime; wait for the percentage to reach 100%.
3. Select the voice and press **Use this voice**. Press play on a note: the first sentence takes a moment, the next ones are prepared while the current one plays.
4. To add or remove voices later: **Tools → Joplin Text-to-Speech: Piper voices**.

### Troubleshooting

| Symptom                                        | What to do                                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The list is empty or says there is no internet | Check the connection and the **Piper voices URL** setting (reset it to the default if you changed it), then reopen the screen |
| A download fails or stops                      | Press **Download** again; partial files are discarded and never listed                                                        |
| An error appears in the player when reading    | Pick another voice, or switch to another engine; please report it with the text of the error in the issues                    |
| Piper is slow on a long note                   | Use a `low` quality voice, or a faster speed in the player; synthesis runs on your computer                                   |
| You want the disk space back                   | Remove the voices in the screen; the runtime (about 30 MB) stays until you uninstall the plugin                               |

## Credits

This plugin stands on open-source work:

- [Piper](https://github.com/rhasspy/piper) and its [voices](https://huggingface.co/rhasspy/piper-voices) (Rhasspy / Open Home Foundation, MIT; each voice dataset has its own license in its model card).
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng) (GPL-3.0), the phonemizer, in the WebAssembly build of [`@diffusionstudio/piper-wasm`](https://github.com/diffusionstudio/piper-wasm); downloaded at runtime, not bundled.
- [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT), the model runtime.
- [Joplin](https://github.com/laurent22/joplin) and its plugin API.

Source code and issues: <https://github.com/rafaeljpc/joplin-tts-plugin>.

## Development

```bash
npm install
npm run validate   # eslint + prettier + tsc + jest (100% coverage required)
npm run dist       # builds publish/com.rafaeljpc.joplin-tts.jpl
```

Project layout:

```
src/domain/       pure logic: types and ports, markdown, sentences, reading plan, settings
src/application/  player state machine, plugin <-> panel messages
src/adapters/     speech engines (Web Speech, Google Translate, Azure, Google Cloud, Piper) and Piper storage
src/webview/      player UI that runs inside the Joplin panel
src/compose/      composition root of the plugin process (Joplin API, Node globals)
src/plugin.ts     Joplin integration (panel, commands, settings)
test/mocks/     Joplin API mock for Jest
doc/spec/       design documentation
```

Contributions follow gitflow — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
