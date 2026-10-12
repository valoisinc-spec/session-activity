import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity } from '../types'

const EMPTY: Activity = { startedAt: null, toolCalls: 0, files: [] }
const activity = atom({ plugin: 'session-activity', key: 'activity' } as const, EMPTY)

export const formatElapsed = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

export const formatStatus = (a: Activity, now: number): string => {
  const elapsed = formatElapsed(now - (a.startedAt ?? now))
  const files = a.files.length === 1 ? '1 file' : `${a.files.length} files`
  const tools = a.toolCalls === 1 ? '1 tool call' : `${a.toolCalls} tool calls`
  return `⏱ ${elapsed} · ${tools} · ${files} edited`
}

const refresh = async ($: EngineInterface) =>
  $.ui.status(formatStatus(await read($, activity), await $.clock.now()))

const editedPath = (e: Record<string, unknown>): string | undefined => {
  if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit') return undefined
  const path = e.file_path ?? e.notebook_path
  return typeof path === 'string' ? path : undefined
}

export const formatReport = (a: Activity, now: number): string => {
  const lines = [formatStatus(a, now)]
  if (a.files.length > 0) lines.push('', 'Edited files:', ...a.files.map(f => `  ${f}`))
  return lines.join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'activity',
      description: "Show this session's activity and edited files; `reset` zeroes the counters",
      argumentHint: '[reset]',
    })
    const now = await $.clock.now()
    // Keep the start time across hot reloads; only set it once per session.
    await update($, activity, a => (a.startedAt === null ? { ...a, startedAt: now } : a))
    await refresh($)
    $.clock.every(30_000, () => void refresh($))

    return next(e)
  })

  on('command.run', { command: 'activity' }, async ($, e) => {
    const now = await $.clock.now()
    if (e.args.trim().toLowerCase() === 'reset') {
      await update($, activity, () => ({ ...EMPTY, startedAt: now }))
      await refresh($)
      return { text: 'Session activity reset.' }
    }
    return { text: formatReport(await read($, activity), now) }
  })

  // A counting failure must never block the tool call itself (see .catch).
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined) {
      const path = editedPath(e)
      await update($, activity, a => ({
        ...a,
        toolCalls: a.toolCalls + 1,
        files: path && !a.files.includes(path) ? [...a.files, path] : a.files,
      }))
      await refresh($)
    }

    return ran
  }).catch(($, e, next) => next(e))
}
