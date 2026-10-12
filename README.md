# session-activity

A Claude Code plugin that adds a status line showing what the current session has done:

```
⏱ 12m · 34 tool calls · 5 files edited · +120/−34
```

- **Elapsed time:** counts from session start and refreshes every 30 seconds (configurable).
- **Tool calls:** goes up after each tool call that isn't denied.
- **Files edited:** distinct files touched by Edit, Write or NotebookEdit.
- **Lines changed:** lines added and removed by those edits. Edits are measured from the
  edit itself; a Write counts its whole content as added, since the old file isn't read.

Each session's totals are also saved, so you can compare sessions with `/activity history`.

## Commands

| Command | What it does |
| --- | --- |
| `/activity` | This session's totals plus the list of edited files |
| `/activity history` | Recent sessions (newest first) and their combined totals |
| `/activity reset` | Zero this session's counters and restart the timer |
| `/activity clear-history` | Forget the saved sessions |
| `/activity help` | Show the usage |

## Settings

Set these at install time, or later in the config menu (`/config`):

| Setting | Default | Meaning |
| --- | --- | --- |
| `refreshSeconds` | `30` | How often the elapsed time refreshes (5–600) |
| `showTime` | `true` | Show elapsed time |
| `showTools` | `true` | Show the tool call count |
| `showFiles` | `true` | Show the edited file count |
| `showLines` | `true` | Show lines added and removed |
| `historySize` | `20` | Sessions kept by `/activity history` (1–200) |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install session-activity --marketplace valoisinc-spec/session-activity
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell instead:

```
claude plugin marketplace add valoisinc-spec/session-activity
claude plugin install session-activity@session-activity --scope user
```

To get a newer version later:

```
claude plugin marketplace update session-activity
claude plugin update session-activity@session-activity
```

## Develop

```
claude plugin validate .
claude plugin test .
```
