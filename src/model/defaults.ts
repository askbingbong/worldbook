import type { Look } from './types'

export const DEFAULT_LOOK: Look = {
  name: 'Default',
  base: 'dark',
  accent: '#7C9CFF',
  bg: '#0F1115',
  surface: '#171A21',
  surface2: '#1F232C',
  line: '#2A2F3A',
  text: '#E8EAF0',
  textDim: '#8B93A5',
  radius: 16,
}

export const uid = (): string =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** CSS variable map for a look; the single place tokens are produced. */
export function lookVars(look: Look): Record<string, string> {
  return {
    '--bg': look.bg,
    '--surface': look.surface,
    '--surface-2': look.surface2,
    '--line': look.line,
    '--text': look.text,
    '--text-dim': look.textDim,
    '--accent': look.accent,
    '--r-block': `${look.radius}px`,
    '--r-nested': `${Math.max(0, look.radius - 4)}px`,
    '--r-sheet': `${Math.min(24, look.radius + 8)}px`,
  }
}
