import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { formatElapsed, lineDelta, settingsFrom } from '../hooks/register'

test('formats elapsed time', async () => {
  expect(formatElapsed(0)).toBe('0m')
  expect(formatElapsed(5 * 60_000)).toBe('5m')
  expect(formatElapsed(125 * 60_000)).toBe('2h05m')
})

test('counts changed lines ignoring shared head and tail', async () => {
  expect(lineDelta('a\nb\nc', 'a\nX\nY\nc')).toEqual({ added: 2, removed: 1 })
  expect(lineDelta('', 'one\ntwo')).toEqual({ added: 2, removed: 0 })
  expect(lineDelta('same', 'same')).toEqual({ added: 0, removed: 0 })
})

test('fills in default settings', async () => {
  expect(settingsFrom(undefined)).toEqual({
    refreshSeconds: 30,
    showTime: true,
    showTools: true,
    showFiles: true,
    showLines: true,
    historySize: 20,
  })
  expect(settingsFrom({ refreshSeconds: 1, showLines: false }).refreshSeconds).toBe(5)
})

const harness = (on: On) => {
  const clock = mock.clock(on)
  mock.store(on)
  const statuses: (string | undefined)[] = []
  on('ui.status', ($, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'session-1' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  return { clock, statuses }
}

const start = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const activity = (args: string) => ({
  command: 'activity',
  args,
  origin: { kind: 'composer' } as const,
  presentation: { isFullscreen: false, columns: 80 },
})

test('counts tool calls, files and lines, and keeps history', async ($, on) => {
  const { clock, statuses } = harness(on)

  await $.session.start(start)
  expect(statuses.at(-1)).toBe('⏱ 0m · 0 tool calls · 0 files edited · +0/−0')

  await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'x', new_string: 'y\nz' })
  await $.tool.call({ tool: 'Write', file_path: '/a.ts', content: 'one\ntwo\nthree' })
  await $.tool.call({ tool: 'Write', file_path: '/b.ts', content: 'z' })
  await $.tool.call({ tool: 'Read', file_path: '/c.ts' })
  expect(statuses.at(-1)).toBe('⏱ 0m · 4 tool calls · 2 files edited · +6/−1')

  await clock.advance(61_000)
  expect(statuses.at(-1)).toBe('⏱ 1m · 4 tool calls · 2 files edited · +6/−1')

  const report = await $.command.run(activity(''))
  expect(report.text).toContain('/a.ts')
  expect(report.text).toContain('/b.ts')

  const history = await $.command.run(activity('history'))
  expect(history.text).toContain('4 tool calls')
  expect(history.text).toContain('(this session)')

  await $.command.run(activity('reset'))
  expect(statuses.at(-1)).toBe('⏱ 0m · 0 tool calls · 0 files edited · +0/−0')

  await $.command.run(activity('clear-history'))
  const cleared = await $.command.run(activity('history'))
  expect(cleared.text).toContain('Last 1 session')
  expect(cleared.text).toContain('0 tool calls')

  const help = await $.command.run(activity('nonsense'))
  expect(help.text).toContain('Usage: /activity')
})

test('hides parts the settings turn off', { options: { showTime: false, showLines: false } }, async ($, on) => {
  const { statuses } = harness(on)
  await $.session.start(start)
  await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'x', new_string: 'y' })
  expect(statuses.at(-1)).toBe('1 tool call · 1 file edited')
})
