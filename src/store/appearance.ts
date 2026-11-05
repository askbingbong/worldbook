import { normalizeLook, uid } from '../model/defaults'
import type { BlockPatch, Custom, ID, Look, Patch, Snapshot } from '../model/types'
import { change, getSnap } from './store'

const copy = (l: Look): Look => structuredClone(l)

/* ---------- My Customs ---------- */

export function saveCustom(name: string, look: Look): Custom {
  const now = Date.now()
  const snap = getSnap()
  const c: Custom = {
    id: uid(),
    name: name.trim() || 'My look',
    look: { ...copy(look), name: name.trim() || 'My look' },
    includeInRandom: true,
    order: Math.max(-1, ...snap.customs.map((x) => x.order)) + 1,
    createdAt: now,
    lastUsed: now,
    uses: 0,
  }
  change((s) => ({ ...s, customs: [...s.customs, c] }), 'Saved to My Customs.')
  return c
}
const patchCustom = (id: ID, f: (c: Custom) => Custom, msg?: string) =>
  change((s) => ({ ...s, customs: s.customs.map((c) => (c.id === id ? f(c) : c)) }), msg)

export const updateCustom = (id: ID, look: Look) =>
  patchCustom(
    id,
    (c) => ({ ...c, look: { ...copy(look), name: c.name } }),
    'Custom updated. Worlds already using it keep their own copy.',
  )
export const renameCustom = (id: ID, name: string) =>
  name.trim() &&
  patchCustom(id, (c) => ({ ...c, name: name.trim(), look: { ...c.look, name: name.trim() } }))
export const setIncludeInRandom = (id: ID, on: boolean) =>
  patchCustom(id, (c) => ({ ...c, includeInRandom: on }))
export const touchCustom = (id: ID) =>
  patchCustom(id, (c) => ({ ...c, uses: c.uses + 1, lastUsed: Date.now() }))

export function duplicateCustom(id: ID) {
  change((s) => {
    const c = s.customs.find((x) => x.id === id)
    if (!c) return s
    const name = `${c.name} copy`
    const dup: Custom = {
      ...c,
      id: uid(),
      name,
      look: { ...copy(c.look), name },
      uses: 0,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      order: Math.max(...s.customs.map((x) => x.order)) + 1,
    }
    return { ...s, customs: [...s.customs, dup] }
  }, 'Duplicated.')
}
export const deleteCustom = (id: ID) =>
  change(
    (s) => ({ ...s, customs: s.customs.filter((c) => c.id !== id) }),
    'Custom deleted. Worlds keep their look.',
  )

export function moveCustom(id: ID, dir: -1 | 1) {
  change((s) => {
    const sorted = [...s.customs].sort((a, b) => a.order - b.order)
    const i = sorted.findIndex((c) => c.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sorted.length) return s
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    const order = new Map(sorted.map((c, n) => [c.id, n]))
    return {
      ...s,
      customs: s.customs.map((c) =>
        c.order === order.get(c.id) ? c : { ...c, order: order.get(c.id)! },
      ),
    }
  })
}

/* ---------- world / space looks ---------- */

/** "Done (this world only)": the world stores its own COPY of the look. */
export function setWorldLook(
  worldId: ID,
  look: Look,
  sourceCustomId?: ID | null,
  message = 'Appearance updated.',
) {
  change(
    (s) => ({
      ...s,
      worlds: s.worlds.map((w) =>
        w.id === worldId
          ? {
              ...w,
              look: copy(look),
              sourceCustomId:
                sourceCustomId === null ? undefined : (sourceCustomId ?? w.sourceCustomId),
            }
          : w,
      ),
    }),
    message,
  )
}
export const setSpaceAppearance = (spaceId: ID, patch: Patch, message = 'Appearance updated.') =>
  change(
    (s) => ({
      ...s,
      spaces: s.spaces.map((x) =>
        x.id === spaceId ? { ...x, appearance: structuredClone(patch) } : x,
      ),
    }),
    message,
  )

export function descendantSpaces(s: Snapshot, spaceId: ID): ID[] {
  const out: ID[] = []
  const walk = (id: ID) => {
    for (const x of s.spaces)
      if (x.parentSpaceId === id) {
        out.push(x.id)
        walk(x.id)
      }
  }
  walk(spaceId)
  return out
}
/** Copy this space's overrides onto every subspace below it (undoable). */
export function applyToAllSubspaces(spaceId: ID, patch: Patch) {
  change((s) => {
    const ids = new Set([spaceId, ...descendantSpaces(s, spaceId)])
    return {
      ...s,
      spaces: s.spaces.map((x) =>
        ids.has(x.id) ? { ...x, appearance: structuredClone(patch) } : x,
      ),
    }
  }, 'Applied to this space and all subspaces.')
}

export const setBlockStyle = (blockId: ID, style: BlockPatch, message?: string) =>
  change(
    (s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, style: structuredClone(style) } : b)),
    }),
    message,
  )

/** Make older saved looks complete (new fields get defaults). */
export function normalizeSnapshotLooks(s: Snapshot): Snapshot {
  return {
    ...s,
    worlds: s.worlds.map((w) => ({ ...w, look: normalizeLook(w.look) })),
    customs: s.customs.map((c) => ({ ...c, look: normalizeLook(c.look) })),
  }
}
