// Tags are the glue: same tag (in the same scope) = connected. Resolved at runtime from blocks.
import type { Block, ID, Snapshot, TagDir, TagRef } from './types'

export const isGlobal = (name: string) => name.startsWith('@')
export const tagLabel = (name: string) => (isGlobal(name) ? name : `#${name}`)

/** Normalise user input: lowercase, no spaces, optional leading @ kept, "#" stripped. */
export function normTag(raw: string): string {
  const t = raw.trim().toLowerCase()
  const global = t.startsWith('@')
  const body = t
    .replace(/^[#@]+/, '')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return body ? (global ? '@' : '') + body : ''
}

/** Local tags only connect inside one world; global (@) tags connect across worlds. */
export const scopeKey = (worldId: ID, name: string) =>
  isGlobal(name) ? name : `${worldId}|${name}`

export const PALETTE = [
  '#FF6B6B',
  '#FFA94D',
  '#FFD43B',
  '#69DB7C',
  '#38D9A9',
  '#4DABF7',
  '#748FFC',
  '#DA77F2',
  '#F783AC',
  '#A9E34B',
]
function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
/** A tag keeps its color everywhere: override if set, else a stable palette pick by name. */
export const tagColor = (snap: Pick<Snapshot, 'tagColors'>, name: string) =>
  snap.tagColors.find((c) => c.id === name)?.color ?? PALETTE[hash(name) % PALETTE.length]

export const DIR_GLYPH: Record<TagDir, string> = { both: '⇄', send: '→', receive: '←' }
export const DIR_WORD: Record<TagDir, string> = {
  both: 'both ways',
  send: 'sends only',
  receive: 'receives only',
}
export const nextDir = (d: TagDir): TagDir =>
  d === 'both' ? 'send' : d === 'send' ? 'receive' : 'both'

/* ---------- index + links ---------- */

export interface IndexEntry {
  block: Block
  tag: TagRef
}
export type TagIndex = Map<string, IndexEntry[]>

let cache: { blocks: Block[]; idx: TagIndex } | null = null
export function tagIndex(snap: Pick<Snapshot, 'blocks'>): TagIndex {
  if (cache && cache.blocks === snap.blocks) return cache.idx
  const idx: TagIndex = new Map()
  for (const block of snap.blocks)
    for (const tag of block.tags) {
      const k = scopeKey(block.worldId, tag.name)
      const l = idx.get(k)
      if (l) l.push({ block, tag })
      else idx.set(k, [{ block, tag }])
    }
  cache = { blocks: snap.blocks, idx }
  return idx
}

export interface Link {
  other: Block
  tag: string
  /** from this block's point of view */
  relation: 'both' | 'sends' | 'receives' | 'blocked'
}

export function linksOf(idx: TagIndex, block: Block): Link[] {
  const out: Link[] = []
  for (const t of block.tags)
    for (const e of idx.get(scopeKey(block.worldId, t.name)) ?? []) {
      if (e.block.id === block.id) continue
      const sends = t.dir !== 'receive' && e.tag.dir !== 'send'
      const receives = e.tag.dir !== 'receive' && t.dir !== 'send'
      out.push({
        other: e.block,
        tag: t.name,
        relation: sends && receives ? 'both' : sends ? 'sends' : receives ? 'receives' : 'blocked',
      })
    }
  return out
}
/** Links where data actually flows (not blocked by direction). */
export const activeLinks = (idx: TagIndex, b: Block) =>
  linksOf(idx, b).filter((l) => l.relation !== 'blocked')

/** Blocks that can feed `block` (they send, it receives). */
export const sourcesOf = (idx: TagIndex, b: Block) =>
  linksOf(idx, b).filter((l) => l.relation === 'both' || l.relation === 'receives')
/** Blocks that `block` can drive (it sends, they receive). */
export const targetsOf = (idx: TagIndex, b: Block) =>
  linksOf(idx, b).filter((l) => l.relation === 'both' || l.relation === 'sends')

export function connectedPlaylist(idx: TagIndex, player: Block): Link | undefined {
  return sourcesOf(idx, player).find((l) => l.other.type === 'playlist')
}

/** Plain-language lines and warnings for the Inspector. */
export function explain(idx: TagIndex, block: Block): { lines: string[]; warnings: string[] } {
  const lines: string[] = []
  const warnings: string[] = []
  const typeName = (b: Block) => b.type[0].toUpperCase() + b.type.slice(1)
  for (const t of block.tags) {
    const label = tagLabel(t.name)
    const all = (idx.get(scopeKey(block.worldId, t.name)) ?? []).filter(
      (e) => e.block.id !== block.id,
    )
    if (!all.length) {
      warnings.push(`Nobody else is tagged ${label} yet.`)
      continue
    }
    const links = linksOf(idx, block).filter((l) => l.tag === t.name)
    const live = links.filter((l) => l.relation !== 'blocked')
    if (!live.length) {
      warnings.push(
        `Blocks tagged ${label} exist, but ${DIR_WORD[t.dir]} on this block means nothing flows. Tap the tag's arrow to change it.`,
      )
      continue
    }
    for (const l of live) {
      const o = `${typeName(l.other)}: ${l.other.title || typeName(l.other)}`
      const why = `because both use ${label}`
      if (block.type === 'player' && l.other.type === 'playlist' && l.relation !== 'sends')
        lines.push(`Plays from ${o} ${why}.`)
      else if (block.type === 'playlist' && l.other.type === 'player' && l.relation !== 'receives')
        lines.push(`Feeds ${o} ${why}.`)
      else if (l.relation === 'both') lines.push(`Connected with ${o} ${why}.`)
      else if (l.relation === 'sends') lines.push(`Sends to ${o} ${why}.`)
      else lines.push(`Receives from ${o} ${why}.`)
    }
    if (live.length < links.length)
      warnings.push(`Some ${label} blocks can't reach this one because of their arrows.`)
  }
  if (block.type === 'player' && block.tags.length && !connectedPlaylist(idx, block))
    warnings.push('This player has tags but no connected playlist, so it plays its own file.')
  return { lines, warnings }
}

/* ---------- edits (pure) ---------- */

const mapBlocks = (s: Snapshot, f: (b: Block) => Block): Snapshot => {
  let changed = false
  const blocks = s.blocks.map((b) => {
    const n = f(b)
    if (n !== b) changed = true
    return n
  })
  return changed ? { ...s, blocks } : s
}

const dedupe = (tags: TagRef[]): TagRef[] => {
  const out: TagRef[] = []
  for (const t of tags) {
    const have = out.find((x) => x.name === t.name)
    if (!have) out.push(t)
    else if (have.dir !== t.dir) out[out.indexOf(have)] = { ...have, dir: 'both' }
  }
  return out
}

export function addTags(s: Snapshot, ids: ID[], names: string[], dir: TagDir = 'both'): Snapshot {
  const set = new Set(ids)
  const clean = names.map(normTag).filter(Boolean)
  return mapBlocks(s, (b) => {
    if (!set.has(b.id)) return b
    const add = clean
      .filter((n) => !b.tags.some((t) => t.name === n))
      .map((name) => ({ name, dir }))
    return add.length ? { ...b, tags: [...b.tags, ...add] } : b
  })
}
export const removeTag = (s: Snapshot, id: ID, name: string): Snapshot =>
  mapBlocks(s, (b) => (b.id === id ? { ...b, tags: b.tags.filter((t) => t.name !== name) } : b))
export const setTagDir = (s: Snapshot, id: ID, name: string, dir: TagDir): Snapshot =>
  mapBlocks(s, (b) =>
    b.id === id ? { ...b, tags: b.tags.map((t) => (t.name === name ? { ...t, dir } : t)) } : b,
  )

const inScope = (b: Block, worldId: ID, name: string) =>
  isGlobal(name)
    ? b.tags.some((t) => t.name === name)
    : b.worldId === worldId && b.tags.some((t) => t.name === name)

/** Rename (or merge into an existing tag: duplicates on a block collapse). Affects blocks in the tag's scope. */
export function renameTag(s: Snapshot, worldId: ID, from: string, to: string): Snapshot {
  const target = normTag(to)
  if (!target || target === from) return s
  const next = mapBlocks(s, (b) =>
    inScope(b, worldId, from)
      ? { ...b, tags: dedupe(b.tags.map((t) => (t.name === from ? { ...t, name: target } : t))) }
      : b,
  )
  const color = s.tagColors.find((c) => c.id === from)
  return color ? { ...next, tagColors: next.tagColors.filter((c) => c.id !== from) } : next
}
/** Remove the tag from blocks only; blocks themselves are untouched. */
export const deleteTag = (s: Snapshot, worldId: ID, name: string): Snapshot =>
  mapBlocks(s, (b) =>
    inScope(b, worldId, name) ? { ...b, tags: b.tags.filter((t) => t.name !== name) } : b,
  )

export function setTagColor(s: Snapshot, name: string, color: string): Snapshot {
  const rest = s.tagColors.filter((c) => c.id !== name)
  return { ...s, tagColors: [...rest, { id: name, color }] }
}

export interface TagSummary {
  key: string
  name: string
  global: boolean
  count: number
  worldIds: ID[]
}
/** Tags visible from a world: its local tags plus every global tag. */
export function summaries(s: Snapshot, worldId: ID): TagSummary[] {
  const m = new Map<string, TagSummary>()
  for (const b of s.blocks)
    for (const t of b.tags) {
      const g = isGlobal(t.name)
      if (!g && b.worldId !== worldId) continue
      const key = scopeKey(b.worldId, t.name)
      const cur = m.get(key) ?? { key, name: t.name, global: g, count: 0, worldIds: [] }
      cur.count++
      if (!cur.worldIds.includes(b.worldId)) cur.worldIds.push(b.worldId)
      m.set(key, cur)
    }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
}
export const blocksWithTag = (s: Snapshot, worldId: ID, name: string) =>
  s.blocks.filter((b) => inScope(b, worldId, name))
