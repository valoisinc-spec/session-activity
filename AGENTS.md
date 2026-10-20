# AGENTS.md

Notes for AI coding agents working in this repo.

## What this is

`session-activity` is a Claude Code plugin. It shows a status line with the session's
elapsed time, tool calls, files edited and lines changed, plus an `/activity` command
with per-session history. User-facing docs are in `README.md`.

## Layout

| Path | Purpose |
| --- | --- |
| `hooks/register.ts` | All plugin logic: settings, formatting, line counting, event handlers |
| `hooks/hooks.json` | Points Claude Code at `register.ts` |
| `types/index.d.ts` | `Activity` and `HistoryEntry` types, plus the plugin's state declaration |
| `tests/activity.test.ts` | Tests, using `claude-code/testing` (`expect`, `mock`, `test`) |
| `.claude-plugin/plugin.json` | Plugin manifest: name, version, `userConfig` settings |
| `.claude-plugin/marketplace.json` | Marketplace entry used by `/plugin install` |

There is no `package.json` and no build step. Claude Code loads the TypeScript directly.
`node_modules/` and `.claude-plugin/types/` are generated and git-ignored; don't edit or commit them.

## Commands

Run from the repo root:

```
claude plugin validate .   # check the manifest and hooks
claude plugin test .       # run tests/
```

Run both before finishing any change. Both must pass.

## How the code works

- State lives in one atom, `activity` (see `EMPTY`). Change it only through `update($, activity, fn)`.
- History is saved in `$.store` under the key `history`, trimmed to `historySize` entries.
- Event handlers are registered in `register`: `session.start`, `session.end`,
  `command.run` (for `/activity`) and `tool.call`.
- Pure helpers (`settingsFrom`, `formatElapsed`, `formatStatus`, `lineDelta`, `editOf`,
  `formatReport`, `formatHistory`) are exported so tests can call them directly.
  Put new logic in pure helpers like these and test it.

## Rules

- **Never break the user's session.** The `tool.call` handler ends in `.catch(($, e, next) => next(e))`
  so a counting bug can't block a tool call, and `session.end` swallows errors from history.
  Keep both safeguards.
- **Old state must still load.** `session.start` spreads `EMPTY` under the stored state so
  fields added in newer versions get defaults. When you add a field to `Activity`, add its
  default to `EMPTY` too.
- **Settings stay in sync.** A new setting needs all three: an entry in `plugin.json` `userConfig`,
  handling in `settingsFrom` (with its default and limits), and a row in the README's Settings table.
- **New `/activity` subcommands** go in the `command.run` switch, in `HELP`, in the `argumentHint`
  passed to `$.command.register`, and in the README's Commands table.
- **Releases:** bump `version` in `.claude-plugin/plugin.json` for any user-visible change.

## Style

- TypeScript, 2-space indent, single quotes, no semicolons, trailing commas in multi-line lists.
- Arrow functions for helpers; short `/** */` comments only where the reason isn't obvious.
- Status text uses `·` as the separator and `−` (U+2212), not `-`, for removed lines.
  Keep the existing output format; tests and the README depend on it.
- Commit messages: short, imperative, sentence case (for example "Add lines changed, settings and session history").
