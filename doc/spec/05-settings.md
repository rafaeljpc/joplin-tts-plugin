# 05 — Settings

The **Read Aloud (TTS)** section under _Tools → Options_. All keys use the `tts.` prefix so they do not clash with other plugins. Values read back go through `normalizeSettings`, which discards invalid values and falls back to the default.

| Key                  | Type   | Default     | Visible | Description                                                              |
| -------------------- | ------ | ----------- | ------- | ------------------------------------------------------------------------ |
| `tts.engine`         | enum   | `webspeech` | yes     | `webspeech` (system voices, offline) or `google` (Google Cloud TTS)      |
| `tts.voice`          | string | `""`        | no      | Voice chosen in the panel; empty = default voice                         |
| `tts.rate`           | string | `"1"`       | no      | Speed (0.5–3). Stored as a string: Joplin has no _float_ setting type    |
| `tts.googleApiKey`   | string | `""`        | yes     | Google Cloud API key. **`secure: true`** (stored in the system keychain) |
| `tts.googleLanguage` | string | `en-US`     | yes     | Language code used to list/pick Google voices (e.g. `pt-BR`)             |
| `tts.readTitle`      | bool   | `true`      | yes     | Reads the note title before the body                                     |

## Commands

| Command        | Label              | Where it appears                           |
| -------------- | ------------------ | ------------------------------------------ |
| `tts.readNote` | Read note aloud    | Note toolbar, Tools menu, `Ctrl/Cmd+Alt+R` |
| `tts.stop`     | Stop reading aloud | Command palette                            |

## Security and privacy

- The Google key is optional, **provided by the user** and stored as a secure setting.
- With the Google engine, the **text of the sentences is sent to Google Cloud**. With the Web Speech engine nothing leaves the device.
- The plugin collects no telemetry.
