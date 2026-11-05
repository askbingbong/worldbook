import type { Look } from './types'
import { onColor } from './color'
import { fontStack } from './fonts'

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
  border: 'thin',
  shadow: 'none',
  density: 'comfortable',
  iconStyle: 'filled',
  fontTitle: 'sans',
  fontBody: 'sans',
  fontScale: 1,
  titleWeight: 700,
  motion: 'full',
  header: 'plain',
  backdrop: {
    mode: 'none',
    color: '#0F1115',
    color2: '#1B1040',
    angle: 160,
    url: '',
    mime: '',
    fit: 'cover',
    position: 'center',
    dim: 30,
    blur: 0,
    fixed: true,
    pauseIdle: true,
  },
}

export const uid = (): string =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Fill in anything missing (older saved looks, imports) so a Look is always complete. */
export function normalizeLook(l: Partial<Look> | undefined): Look {
  const x = l ?? {}
  return { ...DEFAULT_LOOK, ...x, backdrop: { ...DEFAULT_LOOK.backdrop, ...(x.backdrop ?? {}) } }
}

const BORDER = { none: 0, thin: 1, thick: 2 }
const DENSITY = { compact: ['8px', '10px'], comfortable: ['12px', '16px'], airy: ['20px', '24px'] }

/** CSS variable map for a look; the single place theme tokens are produced. */
export function lookVars(look: Look): Record<string, string> {
  const r = look.radius
  const [gap, pad] = DENSITY[look.density]
  return {
    '--bg': look.bg,
    '--surface': look.surface,
    '--surface-2': look.surface2,
    '--line': look.line,
    '--text': look.text,
    '--text-dim': look.textDim,
    '--accent': look.accent,
    '--on-accent': onColor(look.accent),
    '--r-block': `${r}px`,
    '--r-nested': `${Math.max(0, r - 4)}px`,
    '--r-sheet': `${Math.min(28, r + 8)}px`,
    '--r-btn': r >= 24 ? '999px' : `${Math.max(2, r - 4)}px`,
    '--r-chip': r <= 4 ? '2px' : r >= 20 ? '999px' : `${r}px`,
    '--bw': `${BORDER[look.border]}px`,
    '--shadow':
      look.shadow === 'soft'
        ? '0 4px 16px rgba(0,0,0,0.28)'
        : look.shadow === 'hard'
          ? '4px 4px 0 color-mix(in srgb, var(--text) 40%, var(--bg))'
          : '0 0 0 0 transparent',
    '--gap': gap,
    '--pad': pad,
    '--font-title': fontStack(look.fontTitle),
    '--font-body': fontStack(look.fontBody),
    '--fs': String(look.fontScale),
    '--title-weight': String(look.titleWeight),
  }
}
