# 07 — Decisions, open items and roadmap

## Decisions made

| Decision                                                                                  | Reason                                                                                       |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Player layout approved (see [04](04-ui-prototype.md))                                     | Approved in the design session                                                               |
| Desktop first, with `speechSynthesis`                                                     | The only sure path; Android/iOS depend on testing and on the platform                        |
| Online engines: Google Translate, Azure, Google Cloud TTS (audio via API)                 | The same code serves desktop, Android and iOS; only the provider changes                     |
| v0.1 shows the sentence **only in the panel**                                             | Highlighting inside the note is complex (would need a _content script_ in the viewer/editor) |
| Panel player in plain JS/TS, no framework                                                 | Small bundle and easy to test                                                                |
| Pause = cancel and repeat the sentence                                                    | `speechSynthesis.pause()` is inconsistent across platforms                                   |
| Branch flow: gitflow with `main` as the main branch                                       | Author's request                                                                             |
| Piper voices (0.4): see [0.4 design decisions](#04-offline-piper-engine-design-decisions) | Author's request                                                                             |

## Open items and questions from the original session

1. **API keys** (Azure Speech, Google Cloud) to test those engines. The Google Translate engine needs none but must be verified inside Joplin (media loading from `translate.google.com`).
2. Confirm in the official plugin catalog that no equivalent plugin exists yet.
3. Test early whether `speechSynthesis` exists in the Joplin Android WebView.

## Manual test checklist per platform

- [ ] Windows — system voices listed, play/pause/speed
- [ ] macOS — same
- [ ] Linux — check whether `speechSynthesis` works (a failure was reported)
- [ ] Any desktop — Google engine with a valid and an invalid key
- [ ] Android — is `speechSynthesis` present? If not, Google engine
- [ ] iOS — depends on the plugin being "recommended"

## Roadmap

| Version | Items                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | Panel, commands, Web Speech, Google Translate, Azure, Google Cloud TTS, tests with 100% coverage (**this repository**)                       |
| 0.2     | Prefetch the next sentence's audio (online engines) to remove gaps (**done**); start at the cursor / read only the selection (done in 0.1.x) |
| 0.3     | Highlight the current sentence inside the note (editor and viewer) (**done**); release published automatically on merge to `main`            |
| 0.4     | Offline Piper/WASM engine, with voices downloaded by the user (design below; idea from the Joplin forum, no ready-made example known)        |
| ≥ 1.0   | Publish to the official catalog; submit as a "recommended" plugin for iOS; evaluate a native Android TTS API (contribution to Joplin core)   |

## 0.4 offline Piper engine: design decisions

Design only; nothing is implemented yet. The first step is a proof of concept.

| Decision                                                                                                                                                  | Reason                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **No voice is bundled or downloaded by default.** The user picks and downloads each voice                                                                 | Keeps the `.jpl` small; voices are tens of MB each           |
| In the setup screen, choosing the Piper engine does not let the user leave until they **download and pick a voice**, or switch to another engine          | The engine is unusable without a voice                       |
| The voice list shows the **size in MB** of each voice when it is known                                                                                    | The user decides what to download                            |
| Voices are stored in a **local folder** (the plugin's data directory)                                                                                     | Persistent, and offline after the first download             |
| Without internet and with no voice downloaded, no voice can be selected, so the user is **forced back to another engine**                                 | Piper is only offline after at least one voice is downloaded |
| The voice catalog URL is a **setting**, pre-filled with the current Hugging Face repository (`rhasspy/piper-voices`); if it moves, the default is updated | The origin may change; users can repoint it                  |

Open questions for the proof of concept: which Piper/WASM runtime to use (community ports of `onnxruntime-web` exist; maintenance to be checked), whether it runs in Joplin's webview (Web Worker allowed?), and how the plugin writes the downloaded files to its data directory.
