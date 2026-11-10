# 05 — Settings

The **Joplin Text-to-Speech** section under _Tools → Options_. All keys use the `tts.` prefix so they do not clash with other plugins. Values read back go through `normalizeSettings`, which discards invalid values and falls back to the default.

| Key                | Type   | Default     | Visible | Description                                                              |
| ------------------ | ------ | ----------- | ------- | ------------------------------------------------------------------------ |
| `tts.engine`       | enum   | `webspeech` | yes     | `webspeech`, `google-translate`, `azure` or `google-cloud`               |
| `tts.voice`        | string | `""`        | no      | Voice chosen in the panel; empty = default voice                         |
| `tts.rate`         | string | `"1"`       | no      | Speed (0.5–3). Stored as a string: Joplin has no _float_ setting type    |
| `tts.googleApiKey` | string | `""`        | yes     | Google Cloud API key. **`secure: true`** (stored in the system keychain) |
| `tts.azureApiKey`  | string | `""`        | yes     | Azure Speech key. **`secure: true`**                                     |
| `tts.azureRegion`  | string | `eastus`    | yes     | Region of the Azure Speech resource (e.g. `brazilsouth`)                 |
| `tts.language`     | string | `en-US`     | yes     | Language code (e.g. `pt-BR`) for the online engines                      |
| `tts.readTitle`    | bool   | `true`      | yes     | Reads the note title before the body                                     |

## Commands

| Command        | Label                            | Where it appears                           |
| -------------- | -------------------------------- | ------------------------------------------ |
| `tts.readNote` | Joplin Text-to-Speech: read note | Note toolbar, Tools menu, `Ctrl/Cmd+Alt+R` |
| `tts.stop`     | Joplin Text-to-Speech: stop      | Command palette                            |

## Security and privacy

- The Google key is optional, **provided by the user** and stored as a secure setting.
- With an online engine the **text of the sentences is sent to that service**. With the Web Speech engine nothing leaves the device.
- The Google Translate engine uses an unofficial public endpoint (the same one behind the Google Translate voices of the Read Aloud browser extension). It needs no key but offers no guarantees and may break at any time.
- The plugin collects no telemetry.
