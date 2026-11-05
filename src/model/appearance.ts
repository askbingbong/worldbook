// Appearance resolution. Each level stores only what it overrides; the rest inherits.
// Priority (most specific wins): Block → Type → Family → Frame → Space → Parent space → World → Default.
import { metaOf } from './blockTypes'
import { clamp, contrast, fixFg, hexToHsl, hslToHex } from './color'
import { DEFAULT_LOOK, lookVars, normalizeLook } from './defaults'
import { FONTS } from './fonts'
import type { Backdrop, Block, BlockPatch, ID, Look, Patch, Snapshot } from './types'

const mergeRules = (a?: Look['rules'], b?: Patch['rules']): Look['rules'] | undefined => {
  if (!a && !b) return undefined
  const out: Record<string, BlockPatch> = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b ?? {}))
    out[k] = { ...(out[k] ?? {}), ...v, fill: { ...(out[k]?.fill ?? {}), ...(v.fill ?? {}) } }
  return out
}

/** Apply one level's overrides on top of an inherited look. */
export function applyPatch(look: Look, patch: Patch | undefined): Look {
  if (!patch) return look
  const { backdrop, rules, ...rest } = patch
  const out: Look = { ...look, ...(rest as Partial<Look>) }
  if (backdrop) out.backdrop = { ...look.backdrop, ...backdrop }
  if (rules) out.rules = mergeRules(look.rules, rules)
  return out
}

/** Effective look of a space: world look + each space's overrides, root → current. */
export function spaceLook(snap: Snapshot, spaceId: ID): Look {
  const space = snap.spaces.find((s) => s.id === spaceId)
  const world = snap.worlds.find((w) => w.id === space?.worldId)
  let look = normalizeLook(world?.look)
  const chain: Patch[] = []
  let cur = space
  while (cur) {
    chain.unshift(cur.appearance)
    cur = cur.parentSpaceId ? snap.spaces.find((s) => s.id === cur!.parentSpaceId) : undefined
  }
  for (const p of chain) look = applyPatch(look, p)
  return look
}
/** The look a subspace inherits (its parent's effective look). */
export function inheritedLook(snap: Snapshot, spaceId: ID): Look {
  const sp = snap.spaces.find((s) => s.id === spaceId)
  return sp?.parentSpaceId
    ? spaceLook(snap, sp.parentSpaceId)
    : normalizeLook(snap.worlds.find((w) => w.id === sp?.worldId)?.look)
}

export interface BlockStyle {
  look: Look
  fill?: Partial<Backdrop>
  /** true when this block differs from its space at all */
  custom: boolean
}

/** Frame styles → family rule → type rule → the block's own style. */
export function blockStyle(snap: Pick<Snapshot, 'blocks'>, block: Block, base: Look): BlockStyle {
  const chain: BlockPatch[] = []
  let p = block.parentId ? snap.blocks.find((b) => b.id === block.parentId) : undefined
  const frames: Block[] = []
  while (p) {
    frames.unshift(p)
    p = p.parentId ? snap.blocks.find((b) => b.id === p!.parentId) : undefined
  }
  for (const f of frames) chain.push(f.style)
  const rules = base.rules ?? {}
  chain.push(
    rules[`family:${metaOf(block.type).group}`] ?? {},
    rules[`type:${block.type}`] ?? {},
    block.style,
  )
  let look = base
  let fill: Partial<Backdrop> | undefined
  let custom = false
  for (const patch of chain) {
    const keys = Object.keys(patch ?? {})
    if (!keys.length) continue
    custom = true
    const { fill: f, ...rest } = patch
    look = { ...look, ...(rest as Partial<Look>) }
    if (f) fill = { ...(fill ?? {}), ...f }
  }
  return { look, fill, custom }
}

/** CSS variables that differ between a block's look and its space's look (keeps inline styles small). */
export function diffVars(look: Look, base: Look): Record<string, string> {
  const a = lookVars(look)
  const b = lookVars(base)
  const out: Record<string, string> = {}
  for (const k of Object.keys(a)) if (a[k] !== b[k]) out[k] = a[k]
  return out
}

/** CSS `background` for a block fill (solid / gradient). Images are handled by the caller. */
export function fillCss(
  f: Partial<Backdrop> | undefined,
  imageUrl?: string | null,
): string | undefined {
  if (!f || !f.mode || f.mode === 'none') return undefined
  if (f.mode === 'solid') return f.color
  if (f.mode === 'gradient')
    return `linear-gradient(${f.angle ?? 160}deg, ${f.color ?? '#000'}, ${f.color2 ?? '#222'})`
  if (f.mode === 'image' && imageUrl) {
    const size = f.fit === 'contain' ? 'contain' : f.fit === 'tile' ? 'auto' : 'cover'
    const dim = (f.dim ?? 30) / 100
    return `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${imageUrl}") ${f.position ?? 'center'} / ${size} ${f.fit === 'tile' ? 'repeat' : 'no-repeat'}`
  }
  return undefined
}

/* ---------- presets (built-in, read-only) ---------- */

const make = (o: Partial<Look> & { name: string }): Look =>
  ({ ...DEFAULT_LOOK, ...o, backdrop: { ...DEFAULT_LOOK.backdrop, ...(o.backdrop ?? {}) } }) as Look

export const PRESETS: Look[] = [
  make({
    name: 'Cozy',
    base: 'dark',
    accent: '#F2A65A',
    bg: '#2B1D14',
    surface: '#3A281C',
    surface2: '#4A3424',
    line: '#6A4E3A',
    text: '#F6E7D3',
    textDim: '#D2B79B',
    radius: 22,
    border: 'thin',
    shadow: 'soft',
    density: 'airy',
    fontTitle: 'serif',
    fontBody: 'rounded',
    titleWeight: 700,
    backdrop: {
      ...DEFAULT_LOOK.backdrop,
      mode: 'gradient',
      color: '#2B1D14',
      color2: '#4A2C1A',
      angle: 170,
    },
  }),
  make({
    name: 'Neon',
    base: 'dark',
    accent: '#00F5D4',
    bg: '#0A0014',
    surface: '#14002B',
    surface2: '#1E0A3C',
    line: '#6A2BD9',
    text: '#F2EBFF',
    textDim: '#B79CFF',
    radius: 4,
    border: 'thick',
    shadow: 'hard',
    density: 'comfortable',
    fontTitle: 'display',
    fontBody: 'mono',
    titleWeight: 700,
    iconStyle: 'duotone',
  }),
  make({
    name: 'Paper',
    base: 'light',
    accent: '#A63E27',
    bg: '#F5F0E6',
    surface: '#FFFDF8',
    surface2: '#F0EADB',
    line: '#CFC4AD',
    text: '#2B2620',
    textDim: '#5F5649',
    radius: 8,
    border: 'thin',
    shadow: 'soft',
    density: 'comfortable',
    fontTitle: 'book',
    fontBody: 'sans',
    titleWeight: 700,
    iconStyle: 'outline',
  }),
  make({
    name: 'Space',
    base: 'dark',
    accent: '#8FA8FF',
    bg: '#05070F',
    surface: '#0C1224',
    surface2: '#131B36',
    line: '#2E3B6E',
    text: '#E6ECFF',
    textDim: '#9AA9DB',
    radius: 16,
    border: 'thin',
    shadow: 'none',
    density: 'comfortable',
    fontTitle: 'geometric',
    fontBody: 'sans',
    titleWeight: 600,
    backdrop: {
      ...DEFAULT_LOOK.backdrop,
      mode: 'gradient',
      color: '#05070F',
      color2: '#1B1040',
      angle: 160,
    },
  }),
]

export const LIGHT_BASE: Partial<Look> = {
  base: 'light',
  bg: '#F6F7FA',
  surface: '#FFFFFF',
  surface2: '#EEF0F5',
  line: '#D5D9E2',
  text: '#1B1F2A',
  textDim: '#566074',
}
export const DARK_BASE: Partial<Look> = {
  base: 'dark',
  bg: '#0F1115',
  surface: '#171A21',
  surface2: '#1F232C',
  line: '#2A2F3A',
  text: '#E8EAF0',
  textDim: '#8B93A5',
}

/* ---------- contrast guard ---------- */

export interface Issue {
  label: string
  ratio: number
  min: number
}
export function contrastIssues(l: Look): Issue[] {
  const out: Issue[] = []
  const check = (label: string, fg: string, bg: string, min = 4.5) => {
    const ratio = contrast(fg, bg)
    if (ratio < min) out.push({ label, ratio, min })
  }
  check('Text on background', l.text, l.bg)
  check('Text on blocks', l.text, l.surface)
  check('Text on nested blocks', l.text, l.surface2)
  check('Dim text on background', l.textDim, l.bg)
  check('Dim text on blocks', l.textDim, l.surface)
  check('Dim text on nested blocks', l.textDim, l.surface2)
  check('Accent text on blocks', l.accent, l.surface)
  return out
}
/** Nudge text colors (never backgrounds) until everything reads. Locked keys are left alone. */
export function fixContrast(l: Look, locked: ReadonlySet<string> = new Set()): Look {
  const bgs = [l.bg, l.surface, l.surface2]
  const out = { ...l }
  if (!locked.has('text')) out.text = fixFg(l.text, bgs)
  if (!locked.has('textDim')) out.textDim = fixFg(l.textDim, bgs)
  if (!locked.has('accent')) out.accent = fixFg(l.accent, [l.surface, l.bg])
  return out
}

/* ---------- randomize ---------- */

export type SettingKey =
  | 'accent'
  | 'bg'
  | 'surface'
  | 'surface2'
  | 'text'
  | 'textDim'
  | 'fontTitle'
  | 'fontBody'
  | 'fontScale'
  | 'titleWeight'
  | 'radius'
  | 'border'
  | 'shadow'
  | 'density'
  | 'iconStyle'
  | 'backdrop'
  | 'motion'

export const SETTING_KEYS: SettingKey[] = [
  'accent',
  'bg',
  'surface',
  'surface2',
  'text',
  'textDim',
  'fontTitle',
  'fontBody',
  'fontScale',
  'titleWeight',
  'radius',
  'border',
  'shadow',
  'density',
  'iconStyle',
  'backdrop',
  'motion',
]
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

export function randomPalette(
  base: 'dark' | 'light',
  hue = rnd(0, 360),
): Pick<Look, 'accent' | 'bg' | 'surface' | 'surface2' | 'line' | 'text' | 'textDim'> {
  const s = rnd(18, 40)
  const dark = base === 'dark'
  const bgL = dark ? rnd(6, 11) : rnd(94, 97)
  const step = dark ? 1 : -1
  return {
    accent: hslToHex(hue + rnd(-20, 20), rnd(65, 90), dark ? rnd(58, 68) : rnd(34, 44)),
    bg: hslToHex(hue, s, bgL),
    surface: hslToHex(hue, s, bgL + step * 4),
    surface2: hslToHex(hue, s, bgL + step * 9),
    line: hslToHex(hue, s, bgL + step * 17),
    text: hslToHex(hue, 15, dark ? 93 : 12),
    textDim: hslToHex(hue, 12, dark ? 70 : 38),
  }
}

export function randomizeKey(look: Look, key: SettingKey): Look {
  const l = { ...look }
  const dark = l.base === 'dark'
  const [h] = hexToHsl(l.accent)
  switch (key) {
    case 'accent':
      l.accent = hslToHex(rnd(0, 360), rnd(65, 90), dark ? rnd(58, 68) : rnd(34, 44))
      break
    case 'bg': {
      const [, bs] = hexToHsl(l.bg)
      l.bg = hslToHex(rnd(0, 360), Math.max(bs, 15), dark ? rnd(6, 11) : rnd(94, 97))
      break
    }
    case 'surface': {
      const [bh, bs, bl] = hexToHsl(l.bg)
      l.surface = hslToHex(bh, bs, bl + (dark ? rnd(2, 6) : -rnd(2, 6)))
      break
    }
    case 'surface2': {
      const [bh, bs, bl] = hexToHsl(l.surface)
      l.surface2 = hslToHex(bh, bs, bl + (dark ? rnd(3, 8) : -rnd(3, 8)))
      break
    }
    case 'text':
      l.text = hslToHex(rnd(0, 360), rnd(5, 25), dark ? rnd(88, 96) : rnd(8, 16))
      break
    case 'textDim':
      l.textDim = hslToHex(rnd(0, 360), rnd(5, 20), dark ? rnd(62, 74) : rnd(34, 44))
      break
    case 'fontTitle':
      l.fontTitle = pick(FONTS).key
      break
    case 'fontBody':
      l.fontBody = pick(FONTS.filter((f) => f.group !== 'display' && f.group !== 'handwritten')).key
      break
    case 'fontScale':
      l.fontScale = pick([0.9, 1, 1.1])
      break
    case 'titleWeight':
      l.titleWeight = pick([500, 600, 700, 800])
      break
    case 'radius':
      l.radius = pick([2, 8, 16, 28])
      break
    case 'border':
      l.border = pick(['none', 'thin', 'thick'] as const)
      break
    case 'shadow':
      l.shadow = pick(['none', 'soft', 'hard'] as const)
      break
    case 'density':
      l.density = pick(['compact', 'comfortable', 'airy'] as const)
      break
    case 'iconStyle':
      l.iconStyle = pick(['outline', 'filled', 'duotone'] as const)
      break
    case 'motion':
      l.motion = pick(['full', 'calm', 'none'] as const)
      break
    case 'backdrop': {
      const mode = pick(['none', 'solid', 'gradient'] as const)
      l.backdrop = {
        ...l.backdrop,
        mode,
        color: l.bg,
        color2: hslToHex(h, 45, dark ? 14 : 88),
        angle: Math.round(rnd(0, 360)),
      }
      break
    }
  }
  return l
}

/** Randomize everything that isn't locked. Colors come from one harmonious palette. */
export function randomizeAll(look: Look, locked: ReadonlySet<string>): Look {
  let l: Look = { ...look }
  const pal = randomPalette(l.base)
  for (const k of ['accent', 'bg', 'surface', 'surface2', 'text', 'textDim'] as const)
    if (!locked.has(k)) l[k] = pal[k]
  if (!locked.has('surface2') && !locked.has('surface') && !locked.has('bg')) l.line = pal.line
  for (const k of SETTING_KEYS) {
    if (locked.has(k) || ['accent', 'bg', 'surface', 'surface2', 'text', 'textDim'].includes(k))
      continue
    l = randomizeKey(l, k)
  }
  return fixContrast(l, locked)
}

export const clampRadius = (n: number) => clamp(n, 0, 32)
export const RADIUS_STOPS = [
  { label: 'Sharp', value: 2 },
  { label: 'Soft', value: 8 },
  { label: 'Round', value: 16 },
  { label: 'Pill', value: 28 },
]
export const stopName = (r: number) =>
  RADIUS_STOPS.reduce((a, b) => (Math.abs(b.value - r) < Math.abs(a.value - r) ? b : a)).label
