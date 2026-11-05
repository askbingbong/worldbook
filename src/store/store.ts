import { useSyncExternalStore } from 'react'
import { DEFAULT_LOOK, uid } from '../model/defaults'
import { buildSeed } from '../model/seed'
import { updateBlock } from '../model/ops'
import type { Block, Folder, ID, Look, Snapshot, Space, World } from '../model/types'
import { getMeta, loadAll, markSeeded, setMeta, write, type StoreName, type Write } from './db'
import { putFile } from './files'
import { normalizeSnapshotLooks } from './appearance'
import { protectStorage } from '../lib/pwa'
import { GROOVE, makeTone, SUNNY } from '../model/tones'

export interface Toast {
  id: number
  message: string
  undo?: () => void
}
interface State {
  ready: boolean
  snap: Snapshot
  toast: Toast | null
}

let state: State = {
  ready: false,
  snap: {
    worlds: [],
    spaces: [],
    blocks: [],
    folders: [],
    recents: [],
    tagColors: [],
    customs: [],
  },
  toast: null,
}
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const useStore = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  )

let toastTimer: number | undefined
export function showToast(message: string, undo?: () => void) {
  window.clearTimeout(toastTimer)
  set({ toast: { id: Date.now(), message, undo } })
  toastTimer = window.setTimeout(() => set({ toast: null }), 4000)
}
export const dismissToast = () => set({ toast: null })

/** Update in-memory snapshot and persist the same change. */
function commit(next: Snapshot, w: Write) {
  set({ snap: next })
  write(w).catch(() => showToast('Could not save to this browser. Storage may be full.'))
}

async function makeTones(): Promise<[string, string]> {
  return [
    await putFile(makeTone(SUNNY), 'sunny-day.wav'),
    await putFile(makeTone(GROOVE), 'mango-groove.wav'),
  ]
}

export async function init() {
  void protectStorage()
  const { snap, seeded } = await loadAll()
  if (!seeded && snap.worlds.length === 0) {
    const seed = buildSeed(await makeTones())
    await write({ put: seed })
    await markSeeded()
    await setMeta('tonesV1', true)
    set({ snap: seed, ready: true })
    return
  }
  // Stage 3 migration: swap the old placeholder sample links for playable tones.
  if (!(await getMeta('tonesV1'))) {
    const old = snap.blocks.filter(
      (b) =>
        b.type === 'playlist' &&
        ((b.content.items as { url?: string }[]) ?? []).some((i) => i.url?.includes('example.com')),
    )
    if (old.length) {
      const tones = await makeTones()
      const fixed = old.map((b) => ({
        ...b,
        content: {
          ...b.content,
          items: [
            { id: uid(), title: 'Sunny Day (sample tune)', url: tones[0] },
            { id: uid(), title: 'Mango Groove (sample tune)', url: tones[1] },
          ],
        },
      }))
      await write({ put: { blocks: fixed } })
      snap.blocks = snap.blocks.map((b) => fixed.find((f) => f.id === b.id) ?? b)
    }
    await setMeta('tonesV1', true)
  }
  set({ snap: normalizeSnapshotLooks(snap), ready: true })
}

export const getSnap = () => state.snap
const S = getSnap

export function createWorld(input: {
  title: string
  emoji: string
  folderId: ID | null
  look?: Look
  sourceCustomId?: ID
}): World {
  const now = Date.now()
  const id = uid()
  const title = input.title.trim() || 'Untitled world'
  const root: Space = { id: uid(), worldId: id, parentSpaceId: null, title, appearance: {} }
  const world: World = {
    id,
    title,
    emoji: input.emoji || '🌍',
    folderId: input.folderId,
    pinned: false,
    look: structuredClone(input.look ?? DEFAULT_LOOK), // always a COPY
    sourceCustomId: input.sourceCustomId,
    rootSpaceId: root.id,
    createdAt: now,
    lastVisited: now,
  }
  commit(
    { ...S(), worlds: [world, ...S().worlds], spaces: [...S().spaces, root] },
    { put: { worlds: [world], spaces: [root] } },
  )
  return world
}

function patchWorld(id: ID, patch: Partial<World>) {
  const cur = S().worlds.find((w) => w.id === id)
  if (!cur) return
  const next = { ...cur, ...patch }
  commit(
    { ...S(), worlds: S().worlds.map((w) => (w.id === id ? next : w)) },
    { put: { worlds: [next] } },
  )
}
export const renameWorld = (id: ID, title: string) => {
  const t = title.trim()
  if (t) patchWorld(id, { title: t })
}
export const togglePin = (id: ID) => {
  const w = S().worlds.find((x) => x.id === id)
  if (w) patchWorld(id, { pinned: !w.pinned })
}
export const moveToFolder = (id: ID, folderId: ID | null) => patchWorld(id, { folderId })
export const visitWorld = (id: ID) => patchWorld(id, { lastVisited: Date.now() })

export function createFolder(name: string): Folder | null {
  const n = name.trim()
  if (!n) return null
  const f: Folder = { id: uid(), name: n, order: S().folders.length }
  commit({ ...S(), folders: [...S().folders, f] }, { put: { folders: [f] } })
  return f
}

export function duplicateWorld(id: ID) {
  const w = S().worlds.find((x) => x.id === id)
  if (!w) return
  const spaces = S().spaces.filter((s) => s.worldId === id)
  const blocks = S().blocks.filter((b) => b.worldId === id)
  const newId = uid()
  const sMap = new Map(spaces.map((s) => [s.id, uid()]))
  const bMap = new Map(blocks.map((b) => [b.id, uid()]))
  const now = Date.now()
  const nSpaces: Space[] = spaces.map((s) => ({
    ...s,
    id: sMap.get(s.id)!,
    worldId: newId,
    parentSpaceId: s.parentSpaceId ? sMap.get(s.parentSpaceId)! : null,
    appearance: { ...s.appearance },
  }))
  const nBlocks: Block[] = blocks.map((b) => {
    const content = structuredClone(b.content)
    const t = content.targetSpaceId
    if (typeof t === 'string' && sMap.has(t)) content.targetSpaceId = sMap.get(t)
    return {
      ...b,
      id: bMap.get(b.id)!,
      worldId: newId,
      spaceId: sMap.get(b.spaceId)!,
      parentId: b.parentId ? bMap.get(b.parentId)! : null,
      content,
      tags: b.tags.map((x) => ({ ...x })),
      style: { ...b.style },
    }
  })
  const nw: World = {
    ...w,
    id: newId,
    title: `${w.title} copy`,
    pinned: false,
    look: { ...w.look },
    rootSpaceId: sMap.get(w.rootSpaceId)!,
    createdAt: now,
    lastVisited: now,
  }
  commit(
    {
      ...S(),
      worlds: [nw, ...S().worlds],
      spaces: [...S().spaces, ...nSpaces],
      blocks: [...S().blocks, ...nBlocks],
    },
    { put: { worlds: [nw], spaces: nSpaces, blocks: nBlocks } },
  )
  showToast('World duplicated.', () => removeWorld(newId, false))
}

function removeWorld(id: ID, withUndo: boolean) {
  const s = S()
  const w = s.worlds.find((x) => x.id === id)
  if (!w) return
  const spaces = s.spaces.filter((x) => x.worldId === id)
  const blocks = s.blocks.filter((x) => x.worldId === id)
  commit(
    {
      ...s,
      worlds: s.worlds.filter((x) => x.id !== id),
      spaces: s.spaces.filter((x) => x.worldId !== id),
      blocks: s.blocks.filter((x) => x.worldId !== id),
      recents: s.recents.filter((x) => x.worldId !== id),
    },
    {
      del: {
        worlds: [id],
        spaces: spaces.map((x) => x.id),
        blocks: blocks.map((x) => x.id),
        recents: s.recents.filter((x) => x.worldId === id).map((x) => x.id),
      },
    },
  )
  if (withUndo)
    showToast('World deleted.', () => {
      const c = S()
      commit(
        {
          ...c,
          worlds: [w, ...c.worlds],
          spaces: [...c.spaces, ...spaces],
          blocks: [...c.blocks, ...blocks],
        },
        { put: { worlds: [w], spaces, blocks } },
      )
    })
}
export const deleteWorld = (id: ID) => removeWorld(id, true)

/* ---------- generic change + undo ---------- */

const KEYS: StoreName[] = [
  'worlds',
  'spaces',
  'blocks',
  'folders',
  'recents',
  'tagColors',
  'customs',
]
type Rec = { id: string }
interface Diff {
  puts: Partial<Record<StoreName, Rec[]>>
  dels: Partial<Record<StoreName, string[]>>
  undoPuts: Partial<Record<StoreName, Rec[]>>
  undoDels: Partial<Record<StoreName, string[]>>
}

function diff(prev: Snapshot, next: Snapshot): Diff {
  const d: Diff = { puts: {}, dels: {}, undoPuts: {}, undoDels: {} }
  for (const k of KEYS) {
    const a = new Map((prev[k] as Rec[]).map((x) => [x.id, x]))
    const b = new Map((next[k] as Rec[]).map((x) => [x.id, x]))
    const puts: Rec[] = [],
      dels: string[] = [],
      uPuts: Rec[] = [],
      uDels: string[] = []
    for (const [id, v] of b) {
      if (a.get(id) === v) continue
      puts.push(v)
      if (a.has(id)) uPuts.push(a.get(id)!)
      else uDels.push(id)
    }
    for (const [id, v] of a)
      if (!b.has(id)) {
        dels.push(id)
        uPuts.push(v)
      }
    d.puts[k] = puts
    d.dels[k] = dels
    d.undoPuts[k] = uPuts
    d.undoDels[k] = uDels
  }
  return d
}

function applyTo(snap: Snapshot, puts: Diff['puts'], dels: Diff['dels']): Snapshot {
  const out = { ...snap } as Record<StoreName, Rec[]>
  for (const k of KEYS) {
    const gone = new Set(dels[k] ?? [])
    const upd = new Map((puts[k] ?? []).map((x) => [x.id, x]))
    const kept = (snap[k] as Rec[]).filter((x) => !gone.has(x.id)).map((x) => upd.get(x.id) ?? x)
    const have = new Set(kept.map((x) => x.id))
    out[k] = [...kept, ...(puts[k] ?? []).filter((x) => !have.has(x.id))]
  }
  return out as unknown as Snapshot
}

/** Apply a pure Snapshot->Snapshot change, persist the diff, and (optionally) offer Undo. */
export function change(mut: (s: Snapshot) => Snapshot, message?: string) {
  const prev = S()
  const next = mut(prev)
  if (next === prev) return
  const d = diff(prev, next)
  commit(next, { put: d.puts as Write['put'], del: d.dels })
  if (message)
    showToast(message, () => {
      const cur = S()
      commit(applyTo(cur, d.undoPuts, d.undoDels), {
        put: d.undoPuts as Write['put'],
        del: d.undoDels,
      })
    })
}

export function recordPortal(worldId: ID, spaceId: ID, title: string) {
  change((s) => {
    const id = `${worldId}:${spaceId}`
    const rec = { id, worldId, spaceId, title, at: Date.now() }
    return { ...s, recents: [rec, ...s.recents.filter((r) => r.id !== id)].slice(0, 20) }
  })
}

export const setBlock = (id: ID, patch: Partial<Block>) => change((s) => updateBlock(s, id, patch))
export const setContent = (id: ID, patch: Record<string, unknown>) =>
  change((s) => {
    const b = s.blocks.find((x) => x.id === id)
    return b ? updateBlock(s, id, { content: { ...b.content, ...patch } }) : s
  })
