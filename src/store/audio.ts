import { useSyncExternalStore } from 'react'
import { kindOf } from '../lib/media'
import { resolveUrl } from './files'

/** Audio only. Images, video and YouTube are handled by slideshows (see Slideshow.tsx). */
export interface Track {
  title: string
  url: string
  /** MIME type for uploads (links are guessed from the URL) */
  mime?: string
}
export type Loop = 'off' | 'all' | 'one'

export interface AudioState {
  /** block that started this playback (null when started from a playlist itself) */
  owner: string | null
  playlistId: string | null
  queue: Track[]
  index: number
  loop: Loop
  shuffle: boolean
  playing: boolean
  loading: boolean
  time: number
  duration: number
  rate: number
  error: string | null
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* optional convenience */
  }
}

const initial: AudioState = {
  owner: null,
  playlistId: null,
  queue: [],
  index: 0,
  loop: read('wb.loop') === 'all' ? 'all' : read('wb.loop') === 'one' ? 'one' : 'off',
  shuffle: read('wb.shuffle') === '1',
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

/** Shared-shuffle bookkeeping: a "bag" of indices not yet played, and a history for Previous. */
let bag: number[] = []
let history: number[] = []
const refill = (except: number) => {
  bag = state.queue.map((_, i) => i).filter((i) => i !== except)
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
}

/** One shared element so playback survives navigation. A <video> element can play audio from video files too. */
const el: HTMLMediaElement | null =
  typeof document !== 'undefined' ? document.createElement('video') : null
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
  el.addEventListener('error', () => {
    if (!el.getAttribute('src')) return
    set({
      playing: false,
      loading: false,
      error: 'This audio could not be played. Check the file or link.',
    })
  })
}

export const isAvTrack = (t: Track) => {
  const k = kindOf(t)
  return k === 'audio' || k === 'video'
}

export async function play(
  queue: Track[],
  index: number,
  meta: { owner: string | null; playlistId: string | null },
) {
  const t = queue[index]
  if (!el || !t) return
  const fresh = state.queue !== queue
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
  if (fresh) {
    history = []
    refill(index)
  }
  try {
    el.loop = state.loop === 'one'
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
  if (!el || !el.getAttribute('src')) return
  if (el.paused) el.play().catch(() => set({ error: 'Could not start playback.' }))
  else el.pause()
}
export const seek = (t: number) => {
  if (el && el.getAttribute('src')) el.currentTime = Math.max(0, Math.min(t, el.duration || t))
}
export const skip = (d: number) => el && seek(el.currentTime + d)
export function setRate(r: number) {
  if (el) el.playbackRate = r
  set({ rate: r })
}

/** Off → Loop all → Loop current. */
export function setLoop(l: Loop) {
  set({ loop: l })
  if (el) el.loop = l === 'one'
  write('wb.loop', l)
}
export const nextLoop = (l: Loop): Loop => (l === 'off' ? 'all' : l === 'all' ? 'one' : 'off')
export function setShuffle(on: boolean) {
  set({ shuffle: on })
  if (on) refill(state.index)
  write('wb.shuffle', on ? '1' : '0')
}

function go(i: number, pushHistory: boolean) {
  if (pushHistory) history.push(state.index)
  void play(state.queue, i, { owner: state.owner, playlistId: state.playlistId })
}
export function next() {
  const n = state.queue.length
  if (!n) return
  if (state.shuffle && n > 1) {
    if (!bag.length && state.loop === 'all') refill(state.index)
    const i = bag.shift()
    if (i !== undefined) return go(i, true)
  } else {
    const i = state.index + 1
    if (i < n) return go(i, true)
    if (state.loop === 'all') return go(0, true)
  }
  if (state.loop === 'all' && n === 1) return go(0, false)
  el?.pause()
  set({ playing: false })
}
export function prev() {
  if (el && el.currentTime > 3) return seek(0)
  if (state.shuffle && history.length) return go(history.pop()!, false)
  const i = state.index - 1
  if (i >= 0) return go(i, false)
  if (state.loop === 'all' && state.queue.length) return go(state.queue.length - 1, false)
}
export function stop() {
  if (!el) return
  el.pause()
  el.removeAttribute('src')
  el.load()
  history = []
  bag = []
  set({ ...initial, rate: state.rate, loop: state.loop, shuffle: state.shuffle })
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

export const getAudio = () => state

/** Playable (audio/video-sound) tracks of a Playlist block. Images and YouTube are not part of audio playback. */
export const tracksOfBlock = (b: { content: Record<string, unknown> }): Track[] =>
  ((b.content.items as { title: string; url: string; mime?: string }[]) ?? []).map((i) => ({
    title: i.title,
    url: i.url,
    mime: i.mime,
  }))
export const avTracksOf = (b: { content: Record<string, unknown> }): Track[] =>
  tracksOfBlock(b).filter(isAvTrack)

const sub = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useAudio = () => useSyncExternalStore(sub, () => state)
/** Subscribe to a primitive derived from the audio state (avoids re-rendering on every tick). */
export const useAudioSel = <T extends string | number | boolean | null>(f: (s: AudioState) => T) =>
  useSyncExternalStore(sub, () => f(state))
