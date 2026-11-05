// Flat, ID-based data model. Appearance stores only overrides; missing values inherit.

export type ID = string

export type FontKey = string
export interface Backdrop {
  mode: 'none' | 'solid' | 'gradient' | 'image'
  color: string
  color2: string
  angle: number
  /** link or "file:<id>" for uploads (image, GIF or video) */
  url: string
  mime: string
  fit: 'cover' | 'contain' | 'tile'
  position: 'center' | 'top' | 'bottom' | 'left' | 'right'
  /** 0–80 */
  dim: number
  /** 0–20 px */
  blur: number
  fixed: boolean
  pauseIdle: boolean
}

export interface Look {
  name?: string
  base: 'dark' | 'light'
  accent: string
  bg: string
  surface: string
  /** nested surface */
  surface2: string
  line: string
  text: string
  textDim: string
  /** px radius for blocks (nested, buttons, chips, sheets derive from it) */
  radius: number
  border: 'none' | 'thin' | 'thick'
  shadow: 'none' | 'soft' | 'hard'
  density: 'compact' | 'comfortable' | 'airy'
  iconStyle: 'outline' | 'filled' | 'duotone'
  fontTitle: FontKey
  fontBody: FontKey
  fontScale: number
  titleWeight: number
  motion: 'full' | 'calm' | 'none'
  header: 'plain' | 'filled' | 'underline'
  backdrop: Backdrop
  /** Advanced style rules by family ("family:Audio") or block type ("type:note"). */
  rules?: Record<string, BlockPatch>
}

/** What one block / rule overrides. Anything missing inherits. */
export type BlockPatch = Partial<Omit<Look, 'backdrop' | 'rules' | 'name' | 'base'>> & {
  /** block background (color, gradient or image) */
  fill?: Partial<Backdrop>
}
/** What one space overrides. Anything missing inherits from the level above. */
export type Patch = Partial<Omit<Look, 'backdrop' | 'rules'>> & {
  backdrop?: Partial<Backdrop>
  rules?: Record<string, BlockPatch>
}

export type TagDir = 'both' | 'send' | 'receive'
export interface TagRef {
  /** includes leading "@" for global tags; stored without "#" */
  name: string
  dir: TagDir
}

export type BlockType =
  | 'note'
  | 'media'
  | 'list'
  | 'link'
  | 'counter'
  | 'timer'
  | 'clock'
  | 'player'
  | 'playlist'
  | 'button'
  | 'toggle'
  | 'picker'
  | 'frame'
  | 'portal'
  | 'divider'
  | 'label'
  | 'spacer'

export interface Block {
  id: ID
  worldId: ID
  spaceId: ID
  /** null = directly in the space; otherwise the id of a Frame block */
  parentId: ID | null
  order: number
  type: BlockType
  title: string
  content: Record<string, unknown>
  tags: TagRef[]
  style: BlockPatch
  collapsed: boolean
  /** Hidden by a Button action (or tag-group toggle). */
  hidden?: boolean
}

export interface Space {
  id: ID
  worldId: ID
  parentSpaceId: ID | null
  title: string
  /** appearance overrides for this space only */
  appearance: Patch
}

export interface World {
  id: ID
  title: string
  emoji: string
  folderId: ID | null
  pinned: boolean
  /** The world's own COPY of look values. Never linked to a custom. */
  look: Look
  /** the custom this look was last loaded from / saved to (for "Update [custom name]") */
  sourceCustomId?: ID
  rootSpaceId: ID
  createdAt: number
  lastVisited: number
}

export interface Folder {
  id: ID
  name: string
  order: number
}

export interface RecentPortal {
  id: ID
  worldId: ID
  spaceId: ID
  title: string
  at: number
}

/** Per-tag color override. id = tag display name (including "@" for global tags). */
export interface TagColor {
  id: string
  color: string
}

/** A saved look in "My Customs". Worlds keep their own COPY of the look values. */
export interface Custom {
  id: ID
  name: string
  look: Look
  includeInRandom: boolean
  order: number
  createdAt: number
  lastUsed: number
  uses: number
}

export interface Snapshot {
  worlds: World[]
  spaces: Space[]
  blocks: Block[]
  folders: Folder[]
  recents: RecentPortal[]
  tagColors: TagColor[]
  customs: Custom[]
}
