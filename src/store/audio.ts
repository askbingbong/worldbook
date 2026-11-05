import { useSyncExternalStore } from 'react'
import { resolveUrl } from './files'
import { youtubeId } from '../lib/media'

export interface Track {
  title: string
  url: string
}
export interface AudioState {
  /** player block id that started this playback (null when started from a playlist) */
  owner: string | null
  playlistId: string | null
  queue: Track[]
  index: number
  playing: boolean
  loading: boolean
  time: number
  duration: number
  rate: number
  error: string | null
}

const initial: AudioState = {
  owner: null,
  playlistId: null,
  queue: [],
  index: 0,
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  rate: 1,
  error: null,
}
let state = initial
const listeners = new Set<() => void>()
const set = (p: Partial<AudioState>) => {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

/** One shared element, created at module load, so playback survives navigation. */
const el: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null
if (el) {
  el.preload = 'auto'
  el.addEventListener('play', () => set({ playing: true }))
  el.addEventListener('playing', () => set({ playing: true, loading: false }))
  el.addEventListener('pause', () => set({ playing: false }))
  el.addEventListener('waiting', () => set({ loading: true }))
  el.addEventListener('timeupdate', () => {
    if (Math.abs(el.currentTime - state.time) >= 0.25) set({ time: el.currentTime })
  })
  el.addEventListener('durationchange', () =>
    set({ duration: Number.isFinite(el.duration) ? el.duration : 0 }),
  )
  el.addEventListener('ended', () => next())
  el.addEventListener('error', () =>
    set({
      playing: false,
      loading: false,
      error: 'This audio could not be played. Check the file or link.',
    }),
  )
}

export const isPlayable = (url: string) => !!url && !youtubeId(url)

export async function play(
  queue: Track[],
  index: number,
  meta: { owner: string | null; playlistId: string | null },
) {
  if (!el) return
  const t = queue[index]
  if (!t || !isPlayable(t.url)) return
  set({
    queue,
    index,
    owner: meta.owner,
    playlistId: meta.playlistId,
    error: null,
    loading: true,
    time: 0,
    duration: 0,
  })
  try {
    el.src = await resolveUrl(t.url)
    el.playbackRate = state.rate
    await el.play()
    updateSession()
  } catch (e) {
    set({
      playing: false,
      loading: false,
      error: e instanceof Error && e.message ? e.message : 'Could not start playback.',
    })
  }
}
export function toggle() {
  if (!el || !el.src) return
  if (el.paused) el.play().catch(() => set({ error: 'Could not start playback.' }))
  else el.pause()
}
export const seek = (t: number) => {
  if (el && el.src) el.currentTime = Math.max(0, Math.min(t, el.duration || t))
}
export const skip = (d: number) => el && seek(el.currentTime + d)
export function setRate(r: number) {
  if (el) el.playbackRate = r
  set({ rate: r })
}
function step(dir: 1 | -1) {
  for (let i = state.index + dir; i >= 0 && i < state.queue.length; i += dir) {
    if (isPlayable(state.queue[i].url)) return i
  }
  return -1
}
export function next() {
  const i = step(1)
  if (i >= 0) void play(state.queue, i, { owner: state.owner, playlistId: state.playlistId })
  else {
    el?.pause()
    set({ playing: false })
  }
}
export function prev() {
  if (el && el.currentTime > 3) return seek(0)
  const i = step(-1)
  if (i >= 0) void play(state.queue, i, { owner: state.owner, playlistId: state.playlistId })
}
export function stop() {
  if (!el) return
  el.pause()
  el.removeAttribute('src')
  el.load()
  set({ ...initial, rate: state.rate })
}

function updateSession() {
  const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession
  if (!ms) return
  try {
    ms.metadata = new MediaMetadata({
      title: state.queue[state.index]?.title ?? 'Worldbook',
      artist: 'Worldbook',
    })
    ms.setActionHandler('play', toggle)
    ms.setActionHandler('pause', toggle)
    ms.setActionHandler('nexttrack', next)
    ms.setActionHandler('previoustrack', prev)
  } catch {
    /* media session is optional */
  }
}

const sub = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export const useAudio = () => useSyncExternalStore(sub, () => state)
/** Subscribe to a primitive derived from the audio state (avoids re-rendering on every tick). */
export const useAudioSel = <T extends string | number | boolean | null>(f: (s: AudioState) => T) =>
  useSyncExternalStore(sub, () => f(state))
