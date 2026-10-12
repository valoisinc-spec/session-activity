# session-activity

A Claude Code plugin that adds a status line showing what the current session has done:

```
⏱ 12m · 34 tool calls · 5 files edited
```

- **Elapsed time:** counts from session start and refreshes every 30 seconds.
- **Tool calls:** goes up after each tool call that isn't denied.
- **Files edited:** distinct files touched by Edit, Write or NotebookEdit.

## Commands

- `/activity` shows the status line plus the list of edited files.
- `/activity reset` zeroes the counters and restarts the timer.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install session-activity --marketplace <owner>/session-activity
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

## Develop

```
claude plugin validate .
claude plugin test .
```
