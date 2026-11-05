// Button actions: "When tapped → Action → Target". Targets can be a block or a tag.
import { updateBlock } from '../model/ops'
import { blocksWithTag, connectedPlaylist, tagIndex } from '../model/tags'
import type { Block, ID, Snapshot } from '../model/types'
import { getAudio, play, toggle as toggleAudio, tracksOfBlock } from './audio'
import { change, getSnap, showToast } from './store'

export type ActionKind = 'link' | 'toggle' | 'playpause' | 'portal' | 'taggroup'
export const ACTIONS: { kind: ActionKind; label: string }[] = [
  { kind: 'link', label: 'Open a link' },
  { kind: 'toggle', label: 'Toggle a block' },
  { kind: 'playpause', label: 'Play / pause a player' },
  { kind: 'portal', label: 'Go to a portal' },
  { kind: 'taggroup', label: 'Show / hide a tag group' },
]

export interface ButtonCfg {
  action?: ActionKind
  targetKind?: 'block' | 'tag' | 'space'
  targetId?: ID
  tagName?: string
  url?: string
}
export const cfgOf = (b: Block): ButtonCfg => b.content as ButtonCfg

/** What the button will do, in words (for the label under the button and a11y). */
export function describe(snap: Snapshot, b: Block): string {
  const c = cfgOf(b)
  const name = (id?: ID) => snap.blocks.find((x) => x.id === id)?.title || 'a block'
  switch (c.action) {
    case 'link':
      return c.url ? `Opens ${c.url}` : 'Opens a link (not set yet)'
    case 'toggle':
      return c.targetKind === 'tag'
        ? `Toggles blocks tagged #${c.tagName}`
        : `Toggles ${name(c.targetId)}`
    case 'playpause':
      return c.targetKind === 'tag'
        ? `Plays or pauses players tagged #${c.tagName}`
        : `Plays or pauses ${name(c.targetId)}`
    case 'portal':
      return `Goes to ${snap.spaces.find((s) => s.id === (c.targetKind === 'space' ? c.targetId : (snap.blocks.find((x) => x.id === c.targetId)?.content.targetSpaceId as string)))?.title ?? 'a portal'}`
    case 'taggroup':
      return `Shows or hides blocks tagged #${c.tagName}`
    default:
      return 'Not set up yet. Open ⋯ → Edit.'
  }
}

function targets(snap: Snapshot, b: Block): Block[] {
  const c = cfgOf(b)
  if (c.targetKind === 'tag' && c.tagName)
    return blocksWithTag(snap, b.worldId, c.tagName).filter((x) => x.id !== b.id)
  return snap.blocks.filter((x) => x.id === c.targetId)
}

export function runButton(b: Block, enterSpace: (id: ID) => void) {
  const snap = getSnap()
  const c = cfgOf(b)
  switch (c.action) {
    case 'link':
      if (c.url) window.open(c.url, '_blank', 'noopener,noreferrer')
      else showToast('Set a link first: ⋯ → Edit.')
      return
    case 'toggle': {
      const ts = targets(snap, b)
      if (!ts.length) return showToast('Nothing to toggle yet. Pick a target in ⋯ → Edit.')
      change((s) => {
        let cur = s
        for (const t of ts)
          cur =
            t.type === 'toggle'
              ? updateBlock(cur, t.id, { content: { ...t.content, on: !t.content.on } })
              : updateBlock(cur, t.id, { hidden: !t.hidden })
        return cur
      }, 'Toggled.')
      return
    }
    case 'taggroup': {
      const ts = targets(snap, b)
      if (!ts.length) return showToast('Nobody uses that tag yet.')
      const hide = ts.some((t) => !t.hidden)
      change(
        (s) => {
          let cur = s
          for (const t of ts) cur = updateBlock(cur, t.id, { hidden: hide })
          return cur
        },
        hide
          ? `Hid ${ts.length} block${ts.length > 1 ? 's' : ''}.`
          : `Showed ${ts.length} block${ts.length > 1 ? 's' : ''}.`,
      )
      return
    }
    case 'playpause': {
      const player = targets(snap, b).find((t) => t.type === 'player')
      if (!player) return showToast('No player found for this button.')
      const st = getAudio()
      const idx = tagIndex(snap)
      const link = connectedPlaylist(idx, player)
      const active = st.owner === player.id || (!!link && st.playlistId === link.other.id)
      if (active && st.queue.length) return toggleAudio()
      const own = String(player.content.url ?? '')
      const queue = link
        ? tracksOfBlock(link.other)
        : own
          ? [{ title: String(player.content.name ?? 'Audio'), url: own }]
          : []
      if (!queue.length) return showToast('That player has nothing to play yet.')
      void play(queue, 0, { owner: player.id, playlistId: link ? link.other.id : null })
      return
    }
    case 'portal': {
      const id =
        c.targetKind === 'space'
          ? c.targetId
          : (snap.blocks.find((x) => x.id === c.targetId)?.content.targetSpaceId as
              string | undefined)
      if (id) enterSpace(id)
      else showToast('Pick a portal first: ⋯ → Edit.')
      return
    }
    default:
      showToast('Set this button up first: ⋯ → Edit.')
  }
}
