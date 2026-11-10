# 02 — Platform analysis

> Summary: on **desktop** it is certainly doable. On **Android** a _fallback_ is likely needed. On **iPhone**, only with an engine that generates audio, and only after the plugin enters the "recommended" list. Nothing below was tested on a device; whatever has no source is _inference_.

## Common architecture across platforms

- **Panel (webview)**: `joplin.views.panels` shows HTML and `postMessage` connects panel and plugin. The player lives in the panel.
- **Reading the note**: `joplin.workspace.selectedNote()` → text → sentences → panel.
- **Sentence by sentence**: the panel reads one sentence, waits for it to end and moves to the next.
- **Settings**: `joplin.settings` stores voice, speed and provider.
- **`TtsEngine` interface**: each platform implements its own engine (see [03-architecture.md](03-architecture.md)).

## Windows and macOS

- **Web Speech API (`speechSynthesis`)**: Joplin desktop is Electron, so it uses the system voices at no cost.
  - Caveat: the "Google" voices shown in Chrome are online browser voices; do **not** expect them in Electron.
- **Google Cloud TTS**: the path to a real Google voice. Requires a **user-provided API key**, has a free quota and is paid afterwards. It returns audio (mp3) played in an `<audio>` element, with speed via `playbackRate`.

## Linux

A Joplin forum topic reports that the Web Speech API did not work on a Linux system. The Google Cloud engine is the alternative.

## Android

Joplin Android already supports plugins (installation from file under "Advanced settings"); they run in webviews.

- _Inference_: the Android WebView may **not** have `speechSynthesis`. An Obsidian plugin reports this in its environment, which also uses the Android WebView. **Test this early in Joplin.**
- If it does not work, two options:
  1. **Google Cloud TTS** with `<audio>`, same as desktop — the simplest.
  2. **Native Android TTS**: would require a contribution to Joplin core (for example with `react-native-tts`) to expose an API to plugins. More work and subject to the maintainer's approval.

## iPhone

Two separate problems:

1. **Distribution**: due to App Store rules, the iOS app only installs "recommended" plugins. The plugin only runs on iPhone after that review.
2. **Engine**: _inference_ — the iOS WebView usually has `speechSynthesis`, so it might work with Apple voices; this depends on the review above.

Alternatives outside the plugin: iOS "Speak Screen"/"Spoken Content", or the Web Clipper/export to a reading app.

## Online engines added after the first field test

The first test on desktop showed that only the offline system voices were reachable, while the [Read Aloud browser extension](https://github.com/Read-Aloud/read-aloud) offers many more and better voices. v0.1 therefore ships these online engines (desktop webview; Android/iOS still depend on the points above):

| Engine           | Access                                   | Notes                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Translate | Free, no key                             | Unofficial `translate_tts` endpoint played through `<audio>` (no CORS needed). One voice per language, ~180 characters per request, so long sentences are chunked. Can change or stop working without notice. |
| Microsoft Azure  | Official REST API, user's key and region | Neural voices. CORS is open on the Speech endpoints, so `fetch` works from the webview. Free tier: 500,000 characters per month.                                                                              |
| Google Cloud TTS | Official API, user's key                 | Wavenet/Neural2 voices.                                                                                                                                                                                       |

**Not included: Microsoft Edge's free "read aloud" voices.** Those are reached through an undocumented WebSocket service that only accepts requests presenting a browser extension's identity (a spoofed `Origin` and a time-based token), and it has been reported as blocked for browser-based clients. Implementing it would mean impersonating Microsoft's client, so the official Azure API is used for Microsoft voices instead.

## Recommendation

Do **desktop first** with `speechSynthesis`. In parallel, build the "audio via API" engine (Google Cloud TTS, or Piper compiled to WASM, which is offline). This second engine serves Android and iPhone with the same code, swapping only the provider. Piper appears on the Joplin forum as an idea, but no ready-made example is known.

## Sources

- Joplin: Plugins (help)
- Mobile: Plugin support (Joplin forum)
- Joplin: panels API (`joplin.views.panels`)
- Text to speech (Joplin forum)
- Local TTS Reader (Obsidian) — Android limitation
- Voluble (GNOME extension)
- Voice Aloud and Note Reader (Obsidian)
