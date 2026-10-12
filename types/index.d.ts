export type Activity = {
  startedAt: number | null
  toolCalls: number
  files: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'session-activity': { activity: Activity }
  }
}
