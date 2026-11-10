# 01 — Overview

## Goal

A plugin for [Joplin](https://joplinapp.org/) with a **TTS** button that reads the text of the open note aloud, **sentence by sentence**.

## Player requirements

1. **Choose the voice** (and the speech engine) in the settings — and also in the panel itself.
2. **Playback controls**: play and pause (plus previous, next and stop).
3. **Playback speed** control.

## Target platforms (original intent)

| Platform | Intended engine                                     |
| -------- | --------------------------------------------------- |
| Windows  | Google voice (via Google Cloud TTS) or system voice |
| macOS    | Google voice (via Google Cloud TTS) or system voice |
| Android  | Native Google                                       |
| iPhone   | _Open question_ — no solution known at the time     |

The feasibility analysis is in [02-platform-analysis.md](02-platform-analysis.md).

## Market research

No TTS plugin that reads the content of Joplin notes was found (only within the searches done in the session — check the official catalog before publishing):

- The "Text to speech" topic on the Joplin forum is an old feature request with no plugin.
- _Voluble_ is a GNOME extension that reads Joplin to-do **notifications** with the Piper voice; it does not read note content.
- Obsidian has interface/feature references: _Voice Aloud_ (sentence-by-sentence reading with highlighting) and _Note Reader_ (local or Azure voice).

## v0.1 scope

Included:

- Player panel (voice, play/pause, previous/next/stop, speed, "Sentence N of M" progress).
- Note toolbar button + Tools menu item + shortcut.
- Four engines: **Web Speech** (system voices, offline), **Google Translate** (online, free, unofficial), **Microsoft Azure Speech** (user's key) and **Google Cloud TTS** (user's key).
- Markdown-to-speakable-text conversion and sentence splitting.
- English and Portuguese (pt-BR) interface.

Out of scope for v0.1 (see [07-roadmap-and-decisions.md](07-roadmap-and-decisions.md)):

- Highlighting the current sentence **inside the note** (v0.1 shows the sentence only in the panel).
- Offline Piper/WASM engine.
- Native Android TTS API (would require a contribution to Joplin core).
- Effective iPhone support (depends on the "recommended" plugin list).
