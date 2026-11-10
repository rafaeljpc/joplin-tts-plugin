# 07 — Decisions, open items and roadmap

## Decisions made

| Decision                                                                  | Reason                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Player layout approved (see [04](04-ui-prototype.md))                     | Approved in the design session                                                               |
| Desktop first, with `speechSynthesis`                                     | The only sure path; Android/iOS depend on testing and on the platform                        |
| Online engines: Google Translate, Azure, Google Cloud TTS (audio via API) | The same code serves desktop, Android and iOS; only the provider changes                     |
| v0.1 shows the sentence **only in the panel**                             | Highlighting inside the note is complex (would need a _content script_ in the viewer/editor) |
| Panel player in plain JS/TS, no framework                                 | Small bundle and easy to test                                                                |
| Pause = cancel and repeat the sentence                                    | `speechSynthesis.pause()` is inconsistent across platforms                                   |
| Branch flow: gitflow with `main` as the main branch                       | Author's request                                                                             |

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
| 0.4     | Offline Piper/WASM engine (idea mentioned on the Joplin forum; no ready-made example known)                                                  |
| ≥ 1.0   | Publish to the official catalog; submit as a "recommended" plugin for iOS; evaluate a native Android TTS API (contribution to Joplin core)   |
