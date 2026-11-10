# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Reading speeds 2.5× and 3× in the player.

## [0.1.1] - 2026-11-10

### Changed

- Reorganized `src` into `domain`, `application`, `adapters` and `webview` layers; the dependency rule is enforced by ESLint. No behaviour change.
- Split the panel's `initPlayer` into a view, a settings manager and a message handler. No behaviour change.

## [0.1.0] - 2026-11-10

### Added

- In the Markdown editor, reading starts at the sentence under the cursor; the player's play button honours it.
- If text is selected in the editor or the rendered viewer, only that selection is read.
- Player panel with voice picker, play/pause, previous/next/stop, speed and progress.
- Toolbar button, Tools menu item and `Ctrl/Cmd+Alt+R` shortcut.
- Speech engines: system voices (Web Speech), Google Translate, Microsoft Azure Speech and Google Cloud Text-to-Speech.
- Button in both the note toolbar and the editor toolbar.
- Markdown-to-speech conversion and sentence splitting.
- English and Portuguese (pt-BR) interface.
- Design documentation in `doc/spec`.
