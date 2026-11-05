import type { BlockType } from './types'

export type Group = 'Content' | 'Audio' | 'Interactive' | 'Structural'
export interface TypeMeta {
  type: BlockType
  label: string
  icon: string
  group: Group
  /** false = shown in the picker as "Soon" until its stage lands */
  ready: boolean
}

export const BLOCK_TYPES: TypeMeta[] = [
  { type: 'note', label: 'Note', icon: '📝', group: 'Content', ready: true },
  { type: 'media', label: 'Media', icon: '🖼️', group: 'Content', ready: true },
  { type: 'list', label: 'List', icon: '☑️', group: 'Content', ready: true },
  { type: 'link', label: 'Link card', icon: '🔗', group: 'Content', ready: true },
  { type: 'counter', label: 'Counter', icon: '🔢', group: 'Content', ready: true },
  { type: 'timer', label: 'Timer', icon: '⏱️', group: 'Content', ready: true },
  { type: 'clock', label: 'Clock', icon: '🕒', group: 'Content', ready: true },
  { type: 'player', label: 'Player', icon: '▶️', group: 'Audio', ready: true },
  { type: 'playlist', label: 'Playlist', icon: '🎵', group: 'Audio', ready: true },
  { type: 'button', label: 'Button', icon: '🔘', group: 'Interactive', ready: true },
  { type: 'toggle', label: 'Toggle', icon: '🎚️', group: 'Interactive', ready: true },
  { type: 'picker', label: 'Random picker', icon: '🎲', group: 'Interactive', ready: true },
  { type: 'frame', label: 'Frame', icon: '🗂️', group: 'Structural', ready: true },
  { type: 'portal', label: 'Portal', icon: '🌀', group: 'Structural', ready: true },
  { type: 'divider', label: 'Divider', icon: '➖', group: 'Structural', ready: true },
  { type: 'label', label: 'Label', icon: '🏷️', group: 'Structural', ready: true },
  { type: 'spacer', label: 'Spacer', icon: '↕️', group: 'Structural', ready: true },
]
export const GROUPS: Group[] = ['Content', 'Audio', 'Interactive', 'Structural']
export const metaOf = (t: BlockType): TypeMeta => BLOCK_TYPES.find((m) => m.type === t)!

export function defaultContent(type: BlockType): Record<string, unknown> {
  switch (type) {
    case 'note':
      return { text: '' }
    case 'list':
      return { checkable: true, items: [] }
    case 'frame':
      return { layout: 'stack' }
    case 'portal':
      return { style: 'card', targetSpaceId: '' }
    case 'label':
      return { text: 'Label' }
    case 'spacer':
      return { height: 24 }
    case 'media':
      return { kind: 'image', url: '' }
    case 'link':
      return { url: '' }
    case 'counter':
      return { value: 0 }
    case 'timer':
      return { seconds: 300 }
    case 'player':
      return { url: '' }
    case 'playlist':
      return { items: [] }
    case 'toggle':
      return { on: true }
    default:
      return {}
  }
}
