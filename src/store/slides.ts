import { useSyncExternalStore } from 'react'

/**
 * "Jump to this item" requests from a Playlist's item list to the slideshow(s) showing it.
 * A slideshow applies a request when `n` changes; `index` is the playlist item index.
 */
interface Jump {
  n: number
  index: number
}
const jumps = new Map<string, Jump>()
const listeners = new Set<() => void>()
export function jumpTo(playlistId: string, index: number) {
  jumps.set(playlistId, { n: (jumps.get(playlistId)?.n ?? 0) + 1, index })
  listeners.forEach((l) => l())
}
const EMPTY: Jump = { n: 0, index: 0 }
export const useJump = (playlistId: string | null) =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => (playlistId ? (jumps.get(playlistId) ?? EMPTY) : EMPTY),
  )
