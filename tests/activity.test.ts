import { expect, mock, test } from 'claude-code/testing'

import { formatElapsed } from '../hooks/register'

test('formats elapsed time', async () => {
  expect(formatElapsed(0)).toBe('0m')
  expect(formatElapsed(5 * 60_000)).toBe('5m')
  expect(formatElapsed(125 * 60_000)).toBe('2h05m')
})

test('counts tool calls and distinct edited files', async ($, on) => {
  const clock = mock.clock(on)
  const statuses: (string | undefined)[] = []
  on('ui.status', ($, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))

  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  expect(statuses.at(-1)).toBe('⏱ 0m · 0 tool calls · 0 files edited')

  await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'x', new_string: 'y' })
  await $.tool.call({ tool: 'Write', file_path: '/a.ts', content: 'z' })
  await $.tool.call({ tool: 'Write', file_path: '/b.ts', content: 'z' })
  await $.tool.call({ tool: 'Read', file_path: '/c.ts' })
  expect(statuses.at(-1)).toBe('⏱ 0m · 4 tool calls · 2 files edited')

  await clock.advance(61_000)
  expect(statuses.at(-1)).toBe('⏱ 1m · 4 tool calls · 2 files edited')

  const report = await $.command.run({ command: 'activity', args: '' })
  expect(report.text).toContain('/a.ts')
  expect(report.text).toContain('/b.ts')

  await $.command.run({ command: 'activity', args: 'reset' })
  expect(statuses.at(-1)).toBe('⏱ 0m · 0 tool calls · 0 files edited')
})
