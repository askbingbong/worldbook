import { DEFAULT_LOOK, uid } from './defaults'
import type { Block, BlockType, Look, Snapshot, Space, TagRef, World } from './types'

const mangoSvg =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#F6A623"/><circle cx="160" cy="90" r="52" fill="#FFCB47"/><text x="160" y="106" font-size="52" text-anchor="middle">🥭</text></svg>',
  )

export function buildSeed(tones: [string, string]): Snapshot {
  const now = Date.now()
  const look: Look = { ...DEFAULT_LOOK, name: 'Mango', accent: '#FFB347' }
  const worldId = uid()
  const root: Space = {
    id: uid(),
    worldId,
    parentSpaceId: null,
    title: 'Mango World',
    appearance: {},
  }
  const beach: Space = {
    id: uid(),
    worldId,
    parentSpaceId: root.id,
    title: 'Beach',
    appearance: {},
  }
  const world: World = {
    id: worldId,
    title: 'Mango World',
    emoji: '🥭',
    folderId: null,
    pinned: true,
    look,
    rootSpaceId: root.id,
    createdAt: now,
    lastVisited: now,
  }
  const blocks: Block[] = []
  const add = (
    space: Space,
    type: BlockType,
    title: string,
    content: Record<string, unknown>,
    tags: TagRef[] = [],
    parentId: string | null = null,
  ): Block => {
    const order = blocks.filter((b) => b.spaceId === space.id && b.parentId === parentId).length
    const b: Block = {
      id: uid(),
      worldId,
      spaceId: space.id,
      parentId,
      order,
      type,
      title,
      content,
      tags,
      style: {},
      collapsed: false,
    }
    blocks.push(b)
    return b
  }
  const mango: TagRef[] = [{ name: 'mango', dir: 'both' }]
  add(
    root,
    'playlist',
    'Summer',
    {
      items: [
        { id: uid(), title: 'Sunny Day (sample tune)', url: tones[0] },
        { id: uid(), title: 'Mango Groove (sample tune)', url: tones[1] },
      ],
    },
    mango,
  )
  add(root, 'player', 'Player', { url: '' }, mango)
  const frame = add(root, 'frame', 'Mango notes', { layout: 'stack' })
  add(
    root,
    'note',
    'Tasting notes',
    { text: 'Ataulfo mangoes are the sweetest. **Ripe = slight give.**' },
    [],
    frame.id,
  )
  add(root, 'media', 'Photo', { kind: 'image', url: mangoSvg }, [], frame.id)
  add(root, 'portal', 'Beach', { style: 'card', targetSpaceId: beach.id })
  add(beach, 'note', 'Beach day', { text: 'Sand, sun and a cold mango.' })
  return {
    worlds: [world],
    spaces: [root, beach],
    blocks,
    folders: [],
    recents: [],
    tagColors: [],
    customs: [],
  }
}
