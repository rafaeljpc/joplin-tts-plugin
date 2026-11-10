# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-11-10

### Added

- The sentence being read is highlighted inside the note: in the Markdown editor (CodeMirror 6, with scrolling) and in the rendered viewer.

### Changed

- `npm run version:set -- X.Y.Z[-dev]` sets the version in `package.json`, `package-lock.json` and the manifest at once; development of a version starts at `X.Y.Z-dev` so local packages are identifiable, and the release workflow refuses to publish a `-dev` version.
- Release automation: merging a new version into `main` creates the tag and publishes the GitHub release with the `.jpl`; the notes come from this changelog.

## [0.2.0] - 2026-11-10

### Added

- Online engines (Google Translate, Azure, Google Cloud) fetch the next sentence's audio while the current one plays, removing the pause between sentences.

## [0.1.2] - 2026-11-10

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
