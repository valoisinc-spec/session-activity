import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { Activity, HistoryEntry } from '../types'

const EMPTY: Activity = { startedAt: null, toolCalls: 0, files: [], added: 0, removed: 0 }
const activity = atom({ plugin: 'session-activity', key: 'activity' } as const, EMPTY)
const HISTORY = 'history'

export type Settings = {
  refreshSeconds: number
  showTime: boolean
  showTools: boolean
  showFiles: boolean
  showLines: boolean
  historySize: number
}

export const settingsFrom = (o: PluginOptions | undefined): Settings => {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const bool = (v: unknown) => v !== false
  return {
    refreshSeconds: Math.max(5, num(o?.refreshSeconds, 30)),
    showTime: bool(o?.showTime),
    showTools: bool(o?.showTools),
    showFiles: bool(o?.showFiles),
    showLines: bool(o?.showLines),
    historySize: Math.max(1, Math.floor(num(o?.historySize, 20))),
  }
}

export const formatElapsed = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const formatStatus = (a: Activity, now: number, s: Settings): string | undefined => {
  const parts: string[] = []
  if (s.showTime) parts.push(`⏱ ${formatElapsed(now - (a.startedAt ?? now))}`)
  if (s.showTools) parts.push(plural(a.toolCalls, 'tool call', 'tool calls'))
  if (s.showFiles) parts.push(`${plural(a.files.length, 'file', 'files')} edited`)
  if (s.showLines) parts.push(`+${a.added}/−${a.removed}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

const lineCount = (text: string): number => (text === '' ? 0 : text.split('\n').length)

/** Lines added and removed going from `before` to `after`, ignoring a shared head and tail. */
export const lineDelta = (before: string, after: string): { added: number; removed: number } => {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++
  return { added: b.length - head - tail, removed: a.length - head - tail }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** The file a tool call edits and the lines it changes, or undefined when it edits nothing. */
export const editOf = (
  e: Record<string, unknown>,
): { path: string; added: number; removed: number } | undefined => {
  switch (e.tool) {
    case 'Edit':
      if (typeof e.file_path !== 'string') return undefined
      return { path: e.file_path, ...lineDelta(str(e.old_string), str(e.new_string)) }
    case 'Write':
      if (typeof e.file_path !== 'string') return undefined
      return { path: e.file_path, added: lineCount(str(e.content)), removed: 0 }
    case 'NotebookEdit': {
      if (typeof e.notebook_path !== 'string') return undefined
      const added = e.edit_mode === 'delete' ? 0 : lineCount(str(e.new_source))
      return { path: e.notebook_path, added, removed: 0 }
    }
    default:
      return undefined
  }
}

const ALL_PARTS = { showTime: true, showTools: true, showFiles: true, showLines: true }

export const formatReport = (a: Activity, now: number, s: Settings): string => {
  const lines = [formatStatus(a, now, { ...s, ...ALL_PARTS }) ?? '']
  if (a.files.length > 0) lines.push('', 'Edited files:', ...a.files.map(f => `  ${f}`))
  return lines.join('\n')
}

const asHistory = (v: unknown): HistoryEntry[] => (Array.isArray(v) ? (v as HistoryEntry[]) : [])

export const formatHistory = (entries: HistoryEntry[], currentId: string | undefined): string => {
  if (entries.length === 0) return 'No sessions recorded yet.'
  const rows = [...entries].reverse().map(h => {
    const when = new Date(h.startedAt).toISOString().slice(0, 16).replace('T', ' ')
    const mark = h.sessionId === currentId ? ' (this session)' : ''
    const tools = plural(h.toolCalls, 'tool call', 'tool calls')
    const files = plural(h.files, 'file', 'files')
    return `  ${when} UTC · ${formatElapsed(h.updatedAt - h.startedAt)} · ${tools} · ${files} · +${h.added}/−${h.removed}${mark}`
  })
  const total = entries.reduce(
    (t, h) => ({ tools: t.tools + h.toolCalls, added: t.added + h.added, removed: t.removed + h.removed }),
    { tools: 0, added: 0, removed: 0 },
  )
  return [
    `Last ${plural(entries.length, 'session', 'sessions')} (newest first):`,
    ...rows,
    '',
    `Total: ${plural(total.tools, 'tool call', 'tool calls')} · +${total.added}/−${total.removed}`,
  ].join('\n')
}

const HELP = [
  'Usage: /activity [reset | history | clear-history | help]',
  '  (no argument)   this session: time, tool calls, files and lines, plus the edited files',
  "  reset           zero this session's counters and restart the timer",
  '  history         recent sessions and their totals',
  '  clear-history   forget the saved sessions',
].join('\n')

async function sessionId($: EngineInterface): Promise<string | undefined> {
  try {
    return await $.session.id()
  } catch {
    return undefined
  }
}

async function refresh($: EngineInterface, settings: Settings) {
  $.ui.status(formatStatus(await read($, activity), await $.clock.now(), settings))
}

/** Keep this session's totals in the cross-session history. */
async function record($: EngineInterface, settings: Settings) {
  const id = await sessionId($)
  const a = await read($, activity)
  if (id === undefined || a.startedAt === null) return
  const entry: HistoryEntry = {
    sessionId: id,
    startedAt: a.startedAt,
    updatedAt: await $.clock.now(),
    toolCalls: a.toolCalls,
    files: a.files.length,
    added: a.added,
    removed: a.removed,
  }
  const rest = asHistory(await $.store.get(HISTORY)).filter(h => h.sessionId !== id)
  await $.store.set(HISTORY, [...rest, entry].slice(-settings.historySize))
}

export const register: Register = (on, options) => {
  const settings = settingsFrom(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'activity',
      description: "Show this session's activity; `history` lists past sessions, `reset` zeroes the counters",
      argumentHint: '[reset | history | clear-history | help]',
    })
    const now = await $.clock.now()
    // Keep the start time across hot reloads; only set it once per session.
    // Spreading EMPTY first fills fields added since an older version wrote the state.
    await update($, activity, a => (a.startedAt === null ? { ...EMPTY, ...a, startedAt: now } : { ...EMPTY, ...a }))
    await refresh($, settings)
    $.clock.every(settings.refreshSeconds * 1000, () => void refresh($, settings))

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    try {
      await record($, settings)
    } catch {
      // History is best effort; never hold up the session's end.
    }
    return next(e)
  })

  on('command.run', { command: 'activity' }, async ($, e) => {
    const now = await $.clock.now()
    switch (e.args.trim().toLowerCase()) {
      case '':
        return { text: formatReport(await read($, activity), now, settings) }
      case 'reset':
        await update($, activity, () => ({ ...EMPTY, startedAt: now }))
        await refresh($, settings)
        await record($, settings)
        return { text: 'Session activity reset.' }
      case 'history':
        await record($, settings)
        return { text: formatHistory(asHistory(await $.store.get(HISTORY)), await sessionId($)) }
      case 'clear-history':
        await $.store.delete(HISTORY)
        return { text: 'Session history cleared.' }
      default:
        return { text: HELP }
    }
  })

  // A counting failure must never block the tool call itself (see .catch).
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined) {
      const edit = ran.isError === true ? undefined : editOf(e)
      await update($, activity, a => ({
        ...a,
        toolCalls: a.toolCalls + 1,
        files: edit && !a.files.includes(edit.path) ? [...a.files, edit.path] : a.files,
        added: a.added + (edit?.added ?? 0),
        removed: a.removed + (edit?.removed ?? 0),
      }))
      await refresh($, settings)
      await record($, settings)
    }

    return ran
  }).catch(($, e, next) => next(e))
}
