import { useSyncExternalStore } from 'react'
import { kindOf, type MediaKind } from '../lib/media'
import { resolveUrl } from './files'

export interface Track {
  title: string
  url: string
  /** MIME type for uploads (links are guessed from the URL) */
  mime?: string
}
export type Loop = 'off' | 'all' | 'one'
/** 'av' = only audio/video entries (Player blocks); 'all' = also images and YouTube (Media / Playlist views) */
export type Filter = 'av' | 'all'

export interface AudioState {
  /** block that started this playback (null when started from a playlist itself) */
  owner: string | null
  playlistId: string | null
  queue: Track[]
  index: number
  kind: MediaKind | null
  filter: Filter
  loop: Loop
  playing: boolean
  loading: boolean
  time: number
  duration: number
  rate: number
  error: string | null
}

const LOOP_KEY = 'wb.loop'
function savedLoop(): Loop {
  try {
    const v = localStorage.getItem(LOOP_KEY)
    return v === 'all' || v === 'one' ? v : 'off'
  } catch {
    return 'off'
  }
}

const initial: AudioState = {
  owner: null,
  playlistId: null,
  queue: [],
  index: 0,
  kind: null,
  filter: 'av',
  loop: savedLoop(),
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

/** One shared element so playback survives navigation. It's a <video> so it can play audio too;
 *  Media blocks attach it to the page to show video, otherwise it plays detached (audio only). */
export const mediaEl: HTMLVideoElement | null =
  typeof document !== 'undefined' ? document.createElement('video') : null
const isAV = () => state.kind === 'audio' || state.kind === 'video'
export const SLIDE_SECONDS = 5
let slide: number | undefined
const clearSlide = () => {
  window.clearTimeout(slide)
  slide = undefined
}
function startSlide() {
  clearSlide()
  slide = window.setTimeout(
    () => (state.loop === 'one' ? startSlide() : next()),
    SLIDE_SECONDS * 1000,
  )
}

if (mediaEl) {
  const el = mediaEl
  el.preload = 'auto'
  el.playsInline = true
  el.setAttribute('playsinline', '')
  el.addEventListener('play', () => isAV() && set({ playing: true }))
  el.addEventListener('playing', () => isAV() && set({ playing: true, loading: false }))
  el.addEventListener('pause', () => isAV() && set({ playing: false }))
  el.addEventListener('waiting', () => isAV() && set({ loading: true }))
  el.addEventListener('timeupdate', () => {
    if (isAV() && Math.abs(el.currentTime - state.time) >= 0.25) set({ time: el.currentTime })
  })
  el.addEventListener(
    'durationchange',
    () => isAV() && set({ duration: Number.isFinite(el.duration) ? el.duration : 0 }),
  )
  el.addEventListener('ended', () => isAV() && next())
  el.addEventListener('error', () => {
    if (!el.getAttribute('src') || !isAV()) return
    set({
      playing: false,
      loading: false,
      error: 'This file could not be played. Check the file or link.',
    })
  })
}

const dropSource = () => {
  if (!mediaEl) return
  mediaEl.pause()
  mediaEl.removeAttribute('src')
  mediaEl.load()
}

export async function play(
  queue: Track[],
  index: number,
  meta: { owner: string | null; playlistId: string | null; filter?: Filter },
) {
  const t = queue[index]
  if (!mediaEl || !t) return
  const kind = kindOf(t)
  clearSlide()
  set({
    queue,
    index,
    kind,
    owner: meta.owner,
    playlistId: meta.playlistId,
    filter: meta.filter ?? state.filter,
    error: null,
    loading: kind === 'audio' || kind === 'video',
    time: 0,
    duration: kind === 'image' ? SLIDE_SECONDS : 0,
  })
  if (kind === 'image' || kind === 'youtube') {
    dropSource()
    set({ playing: kind === 'image', loading: false })
    if (kind === 'image') startSlide()
    updateSession()
    return
  }
  try {
    mediaEl.loop = state.loop === 'one'
    mediaEl.src = await resolveUrl(t.url)
    mediaEl.playbackRate = state.rate
    await mediaEl.play()
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
  if (!mediaEl) return
  if (state.kind === 'image') {
    if (state.playing) {
      clearSlide()
      set({ playing: false })
    } else {
      set({ playing: true })
      startSlide()
    }
  } else if (isAV() && mediaEl.getAttribute('src')) {
    if (mediaEl.paused) mediaEl.play().catch(() => set({ error: 'Could not start playback.' }))
    else mediaEl.pause()
  }
}
export const seek = (t: number) => {
  if (mediaEl && isAV() && mediaEl.getAttribute('src'))
    mediaEl.currentTime = Math.max(0, Math.min(t, mediaEl.duration || t))
}
export const skip = (d: number) => mediaEl && isAV() && seek(mediaEl.currentTime + d)
export function setRate(r: number) {
  if (mediaEl) mediaEl.playbackRate = r
  set({ rate: r })
}

/** Cycle Off → Loop all → Loop current. */
export function setLoop(l: Loop) {
  set({ loop: l })
  if (mediaEl) mediaEl.loop = l === 'one' && isAV()
  try {
    localStorage.setItem(LOOP_KEY, l)
  } catch {
    /* optional convenience */
  }
}
export const nextLoop = (l: Loop): Loop => (l === 'off' ? 'all' : l === 'all' ? 'one' : 'off')

const matches = (t: Track) => {
  const k = kindOf(t)
  return state.filter === 'all' || k === 'audio' || k === 'video'
}
/** Next index in the given direction, wrapping when looping the whole list. -1 = nothing to play. */
function step(dir: 1 | -1): number {
  const n = state.queue.length
  for (let c = 1; c <= n; c++) {
    let i = state.index + dir * c
    if (i < 0 || i >= n) {
      if (state.loop !== 'all') return -1
      i = ((i % n) + n) % n
    }
    if (matches(state.queue[i])) return i
  }
  return -1
}
export function next() {
  const i = step(1)
  if (i >= 0) void play(state.queue, i, { owner: state.owner, playlistId: state.playlistId })
  else {
    clearSlide()
    if (mediaEl && isAV()) mediaEl.pause()
    set({ playing: false })
  }
}
export function prev() {
  if (mediaEl && isAV() && mediaEl.currentTime > 3) return seek(0)
  const i = step(-1)
  if (i >= 0) void play(state.queue, i, { owner: state.owner, playlistId: state.playlistId })
}
export function stop() {
  clearSlide()
  state = { ...state, kind: null }
  dropSource()
  set({ ...initial, rate: state.rate, loop: state.loop })
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

/** Tracks of a Playlist block. */
export const tracksOfBlock = (b: { content: Record<string, unknown> }): Track[] =>
  ((b.content.items as { title: string; url: string; mime?: string }[]) ?? []).map((i) => ({
    title: i.title,
    url: i.url,
    mime: i.mime,
  }))
export const isAvTrack = (t: Track) => {
  const k = kindOf(t)
  return k === 'audio' || k === 'video'
}

const sub = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useAudio = () => useSyncExternalStore(sub, () => state)
/** Subscribe to a primitive derived from the audio state (avoids re-rendering on every tick). */
export const useAudioSel = <T extends string | number | boolean | null>(f: (s: AudioState) => T) =>
  useSyncExternalStore(sub, () => f(state))
