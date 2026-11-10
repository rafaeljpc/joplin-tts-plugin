# Specification — joplin-tts-plugin

Documentation derived from the project's design session (the "Plugin TTS para Joplin" conversation on claude.ai) and kept alongside the code. Where the code already implements something, the document describes the actual behavior; where it is still an intention, it is marked **planned**.

| Document                                                   | Contents                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| [01-overview.md](01-overview.md)                           | Goal, requirements, scope and non-goals                        |
| [02-platform-analysis.md](02-platform-analysis.md)         | Feasibility per platform (Windows, macOS, Linux, Android, iOS) |
| [03-architecture.md](03-architecture.md)                   | Components, message protocol, `TtsEngine` interface            |
| [04-ui-prototype.md](04-ui-prototype.md)                   | Approved screens and how they were implemented                 |
| [05-settings.md](05-settings.md)                           | Plugin settings                                                |
| [06-testing-and-quality.md](06-testing-and-quality.md)     | Testing strategy, coverage and Joplin best practices           |
| [07-roadmap-and-decisions.md](07-roadmap-and-decisions.md) | Decisions made, open items and roadmap                         |

## Conventions

- **Fact**: confirmed by a cited source (see the sources in each document).
- **Inference**: the analysis author's deduction, not yet tested. Marked as _inference_.
- **Planned**: not implemented in this version.
