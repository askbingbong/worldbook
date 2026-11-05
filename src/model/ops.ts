// Pure block/space operations: Snapshot in, Snapshot out. No I/O, no React.
import { uid } from './defaults'
import { defaultContent, metaOf } from './blockTypes'
import type { Block, BlockType, ID, Snapshot, Space } from './types'

export interface Dest {
  spaceId: ID
  /** null = directly in the space, else a Frame block id */
  parentId: ID | null
}

export const childrenOf = (blocks: Block[], spaceId: ID, parentId: ID | null): Block[] =>
  blocks
    .filter((b) => b.spaceId === spaceId && b.parentId === parentId)
    .sort((a, b) => a.order - b.order)

export function descendantsOf(blocks: Block[], id: ID): Block[] {
  const out: Block[] = []
  const walk = (pid: ID) => {
    for (const b of blocks)
      if (b.parentId === pid) {
        out.push(b)
        walk(b.id)
      }
  }
  walk(id)
  return out
}

/** Drop ids whose ancestor is also in the list (they travel with the ancestor). */
export function topLevel(blocks: Block[], ids: ID[]): Block[] {
  const set = new Set(ids)
  const byId = new Map(blocks.map((b) => [b.id, b]))
  return ids
    .map((i) => byId.get(i))
    .filter((b): b is Block => !!b)
    .filter((b) => {
      let p = b.parentId
      while (p) {
        if (set.has(p)) return false
        p = byId.get(p)?.parentId ?? null
      }
      return true
    })
}

/** Document order across a space: depth-first, in sibling order. */
export function docOrder(blocks: Block[], spaceId: ID): Block[] {
  const out: Block[] = []
  const walk = (pid: ID | null) => {
    for (const b of childrenOf(blocks, spaceId, pid)) {
      out.push(b)
      walk(b.id)
    }
  }
  walk(null)
  return out
}

function setOrders(blocks: Block[], orderedIds: ID[]): Block[] {
  const idx = new Map(orderedIds.map((id, i) => [id, i]))
  return blocks.map((b) =>
    idx.has(b.id) && b.order !== idx.get(b.id) ? { ...b, order: idx.get(b.id)! } : b,
  )
}

/** Renumber one container's children 0..n-1 in current order. */
function renumber(blocks: Block[], spaceId: ID, parentId: ID | null): Block[] {
  return setOrders(
    blocks,
    childrenOf(blocks, spaceId, parentId).map((b) => b.id),
  )
}

export function addBlock(
  snap: Snapshot,
  spaceId: ID,
  type: BlockType,
  opts: {
    afterId?: ID | null
    parentId?: ID | null
    title?: string
    content?: Record<string, unknown>
  } = {},
): { snap: Snapshot; block: Block } {
  const world = snap.spaces.find((s) => s.id === spaceId)!.worldId
  const after = opts.afterId ? snap.blocks.find((b) => b.id === opts.afterId) : undefined
  const sId = after ? after.spaceId : spaceId
  const parentId = after ? after.parentId : (opts.parentId ?? null)
  const sibs = childrenOf(snap.blocks, sId, parentId)
  const block: Block = {
    id: uid(),
    worldId: world,
    spaceId: sId,
    parentId,
    order: 0,
    type,
    title: opts.title ?? metaOf(type).label,
    content: opts.content ?? defaultContent(type),
    tags: [],
    style: {},
    collapsed: false,
  }
  const at = after ? sibs.findIndex((b) => b.id === after.id) + 1 : sibs.length
  const ids = sibs.map((b) => b.id)
  ids.splice(at, 0, block.id)
  return { snap: { ...snap, blocks: setOrders([...snap.blocks, block], ids) }, block }
}

export function updateBlock(snap: Snapshot, id: ID, patch: Partial<Block>): Snapshot {
  return { ...snap, blocks: snap.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }
}

export function deleteBlocks(snap: Snapshot, ids: ID[]): Snapshot {
  const gone = new Set<ID>()
  for (const b of topLevel(snap.blocks, ids)) {
    gone.add(b.id)
    descendantsOf(snap.blocks, b.id).forEach((d) => gone.add(d.id))
  }
  return { ...snap, blocks: snap.blocks.filter((b) => !gone.has(b.id)) }
}

function cloneTree(blocks: Block[], root: Block): Block[] {
  const all = [root, ...descendantsOf(blocks, root.id)]
  const map = new Map(all.map((b) => [b.id, uid()]))
  return all.map((b) => ({
    ...b,
    id: map.get(b.id)!,
    parentId: b.parentId && map.has(b.parentId) ? map.get(b.parentId)! : b.parentId,
    content: structuredClone(b.content),
    tags: b.tags.map((t) => ({ ...t })),
    style: { ...b.style },
  }))
}

/** Duplicate each (top-level) block, placing the copy right after the original. */
export function duplicateBlocks(snap: Snapshot, ids: ID[]): Snapshot {
  let blocks = snap.blocks
  for (const orig of topLevel(snap.blocks, ids)) {
    const copy = cloneTree(blocks, orig)
    const sibs = childrenOf(blocks, orig.spaceId, orig.parentId).map((b) => b.id)
    sibs.splice(sibs.indexOf(orig.id) + 1, 0, copy[0].id)
    blocks = setOrders([...blocks, ...copy], sibs)
  }
  return { ...snap, blocks }
}

export function moveStep(snap: Snapshot, id: ID, dir: -1 | 1): Snapshot {
  const b = snap.blocks.find((x) => x.id === id)
  if (!b) return snap
  const ids = childrenOf(snap.blocks, b.spaceId, b.parentId).map((x) => x.id)
  const i = ids.indexOf(id)
  const j = i + dir
  if (j < 0 || j >= ids.length) return snap
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  return { ...snap, blocks: setOrders(snap.blocks, ids) }
}

/** Can these blocks move to `dest`? (A frame can't go into itself or its own descendants.) */
export function canMoveInto(snap: Snapshot, ids: ID[], dest: Dest): boolean {
  if (!dest.parentId) return true
  const bad = new Set<ID>()
  for (const b of topLevel(snap.blocks, ids)) {
    bad.add(b.id)
    descendantsOf(snap.blocks, b.id).forEach((d) => bad.add(d.id))
  }
  return !bad.has(dest.parentId)
}

export function moveInto(snap: Snapshot, ids: ID[], dest: Dest): Snapshot {
  if (!canMoveInto(snap, ids, dest)) return snap
  const tops = topLevel(snap.blocks, ids)
  const topIds = new Set(tops.map((b) => b.id))
  const allMoved = new Map<ID, Block>()
  tops.forEach((b) => descendantsOf(snap.blocks, b.id).forEach((d) => allMoved.set(d.id, d)))
  const base = childrenOf(
    snap.blocks.filter((b) => !topIds.has(b.id)),
    dest.spaceId,
    dest.parentId,
  ).length
  const order = new Map(tops.map((b, i) => [b.id, base + i]))
  const blocks = snap.blocks.map((b) => {
    if (topIds.has(b.id))
      return { ...b, spaceId: dest.spaceId, parentId: dest.parentId, order: order.get(b.id)! }
    if (allMoved.has(b.id)) return { ...b, spaceId: dest.spaceId }
    return b
  })
  return { ...snap, blocks }
}

export function wrapInFrame(snap: Snapshot, ids: ID[]): { snap: Snapshot; frame: Block | null } {
  const tops = topLevel(snap.blocks, ids)
  if (!tops.length) return { snap, frame: null }
  // Place the frame where the earliest selected block sits.
  const order = docOrder(snap.blocks, tops[0].spaceId)
  const first = [...tops].sort(
    (a, b) => order.findIndex((x) => x.id === a.id) - order.findIndex((x) => x.id === b.id),
  )[0]
  const added = addBlock(snap, first.spaceId, 'frame', { afterId: first.id, title: 'Frame' })
  const moved = moveInto(
    added.snap,
    tops.map((b) => b.id),
    { spaceId: first.spaceId, parentId: added.block.id },
  )
  return {
    snap: { ...moved, blocks: renumber(moved.blocks, first.spaceId, first.parentId) },
    frame: added.block,
  }
}

/* ---------- spaces ---------- */

export function createSubspace(
  snap: Snapshot,
  parentSpaceId: ID,
  title: string,
): { snap: Snapshot; space: Space } {
  const parent = snap.spaces.find((s) => s.id === parentSpaceId)!
  const space: Space = { id: uid(), worldId: parent.worldId, parentSpaceId, title, appearance: {} }
  return { snap: { ...snap, spaces: [...snap.spaces, space] }, space }
}

export function spacePath(snap: Snapshot, spaceId: ID): Space[] {
  const path: Space[] = []
  let cur = snap.spaces.find((s) => s.id === spaceId)
  while (cur && path.length < 100) {
    path.unshift(cur)
    cur = cur.parentSpaceId ? snap.spaces.find((s) => s.id === cur!.parentSpaceId) : undefined
  }
  return path
}
