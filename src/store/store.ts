import { useSyncExternalStore } from 'react'
import { DEFAULT_LOOK, uid } from '../model/defaults'
import { buildSeed } from '../model/seed'
import type { Block, Folder, ID, Look, Snapshot, Space, World } from '../model/types'
import { loadAll, markSeeded, write, type Write } from './db'

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
  snap: { worlds: [], spaces: [], blocks: [], folders: [], recents: [] },
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

export async function init() {
  const { snap, seeded } = await loadAll()
  if (!seeded && snap.worlds.length === 0) {
    const seed = buildSeed()
    await write({ put: seed })
    await markSeeded()
    set({ snap: seed, ready: true })
  } else {
    set({ snap, ready: true })
  }
}

const S = () => state.snap

export function createWorld(input: {
  title: string
  emoji: string
  folderId: ID | null
  look?: Look
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
    look: { ...(input.look ?? DEFAULT_LOOK) }, // always a COPY
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
