export type Activity = {
  startedAt: number | null
  toolCalls: number
  files: string[]
  added: number
  removed: number
}

/** One finished or ongoing session, as kept in `$.store` under `history`. */
export type HistoryEntry = {
  sessionId: string
  startedAt: number
  updatedAt: number
  toolCalls: number
  files: number
  added: number
  removed: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-activity': { activity: Activity }
  }
}
