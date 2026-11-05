import { useRef, useState } from 'react'
import { KIND_ICON, UploadError, ingestFile, kindOf, type MediaKind } from '../../lib/media'
import { uid } from '../../model/defaults'
import { updateBlock } from '../../model/ops'
import { connectedPlaylist, tagLabel, targetsOf } from '../../model/tags'
import type { Block } from '../../model/types'
import {
  avTracksOf,
  isAvTrack,
  next,
  nextLoop,
  play,
  prev,
  seek,
  setLoop,
  setRate,
  setShuffle,
  skip,
  stop,
  toggle,
  tracksOfBlock,
  useAudio,
  type Track,
} from '../../store/audio'
import { jumpTo } from '../../store/slides'
import { change, setContent, showToast } from '../../store/store'
import { useTagIndex } from '../hooks'
import Slideshow, { FRAME_DEFAULTS, settingsOf } from './Slideshow'

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  return `${m}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}
const RATES = [0.75, 1, 1.25, 1.5, 2]
const LOOP_TEXT = { off: 'Off', all: 'All', one: 'One' } as const
const LOOP_HELP = { off: 'off', all: 'whole list', one: 'current item only' } as const

interface Item {
  id: string
  title: string
  url: string
  mime?: string
}
export const tracksOf = tracksOfBlock

/** Loop button: Off → Loop all → Loop current. */
export function LoopButton({ compact }: { compact?: boolean }) {
  const a = useAudio()
  return (
    <button
      className={`btn ghost speed${a.loop !== 'off' ? ' on' : ''}`}
      aria-label={`Loop: ${LOOP_HELP[a.loop]}. Tap to change.`}
      aria-pressed={a.loop !== 'off'}
      title="Loop: off → whole list → current item"
      onClick={() => setLoop(nextLoop(a.loop))}
    >
      {a.loop === 'one' ? '🔂' : '🔁'}
      {!compact && <span> {LOOP_TEXT[a.loop]}</span>}
    </button>
  )
}
export function ShuffleButton({ compact }: { compact?: boolean }) {
  const a = useAudio()
  return (
    <button
      className={`btn ghost speed${a.shuffle ? ' on' : ''}`}
      aria-label={`Shuffle: ${a.shuffle ? 'on' : 'off'}. Tap to change.`}
      aria-pressed={a.shuffle}
      onClick={() => setShuffle(!a.shuffle)}
    >
      🔀{!compact && <span> {a.shuffle ? 'On' : 'Off'}</span>}
    </button>
  )
}

/** Shared transport: play/pause, ±10s, scrub, speed, loop, shuffle (+ prev/next for lists). */
export function Transport({
  active,
  queueLen,
  onStart,
}: {
  active: boolean
  queueLen: number
  onStart: () => void
}) {
  const a = useAudio()
  const live = active && !!a.queue.length
  const rate = a.rate
  return (
    <div className="transport">
      <div className="t-row">
        {queueLen > 1 && (
          <button
            className="btn ghost icon"
            aria-label="Previous track"
            disabled={!live}
            onClick={prev}
          >
            ⏮
          </button>
        )}
        <button
          className="btn ghost icon"
          aria-label="Back 10 seconds"
          disabled={!live}
          onClick={() => skip(-10)}
        >
          ↺10
        </button>
        <button
          className="btn primary icon big"
          aria-label={live && a.playing ? 'Pause' : 'Play'}
          disabled={!queueLen}
          onClick={() => (live ? toggle() : onStart())}
        >
          {live && a.playing ? '⏸' : '▶'}
        </button>
        <button
          className="btn ghost icon"
          aria-label="Forward 10 seconds"
          disabled={!live}
          onClick={() => skip(10)}
        >
          10↻
        </button>
        {queueLen > 1 && (
          <button
            className="btn ghost icon"
            aria-label="Next track"
            disabled={!live}
            onClick={next}
          >
            ⏭
          </button>
        )}
      </div>
      <div className="t-row">
        <button
          className="btn ghost speed"
          aria-label={`Speed ${rate} times. Tap to change.`}
          onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
        >
          {rate}×
        </button>
        <LoopButton />
        {queueLen > 1 && <ShuffleButton />}
      </div>
      <div className="t-row scrub">
        <span className="dim small">{fmt(live ? a.time : 0)}</span>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={Math.max(1, Math.floor(live ? a.duration : 0))}
          step={1}
          value={live ? Math.min(a.time, a.duration || a.time) : 0}
          disabled={!live}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span className="dim small">{fmt(live ? a.duration : 0)}</span>
      </div>
      {live && a.error && <p className="insp-warn">⚠ {a.error}</p>}
    </div>
  )
}

function SourcePicker({
  onFile,
  onLink,
}: {
  onFile: (f: File) => void
  onLink: (u: string) => void
}) {
  const [url, setUrl] = useState('')
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="stack">
      <input
        ref={input}
        type="file"
        accept="audio/*,video/*"
        hidden
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <button className="btn secondary" onClick={() => input.current?.click()}>
        ⬆ Choose an audio file
      </button>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (url.trim()) onLink(url.trim())
          setUrl('')
        }}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste an audio link"
          aria-label="Audio link"
        />
        <button className="btn secondary">Use</button>
      </form>
    </div>
  )
}

async function upload(f: File, kind: 'audio' | 'any' = 'audio') {
  try {
    return await ingestFile(f, kind)
  } catch (e) {
    showToast(e instanceof UploadError ? e.message : 'Could not save that file.')
    return null
  }
}

export function PlayerBody({ block }: { block: Block }) {
  const idx = useTagIndex()
  const a = useAudio()
  const link = connectedPlaylist(idx, block)
  const own = String(block.content.url ?? '')
  const ownName = String(block.content.name ?? 'Audio')
  const queue: Track[] = link
    ? avTracksOf(link.other)
    : own
      ? [{ title: ownName, url: own, mime: String(block.content.mime ?? '') }]
      : []
  const active = a.owner === block.id || (!!link && a.playlistId === link.other.id)

  let source = 'From: own file'
  if (link) source = `From: ${tagLabel(link.tag)} playlist · ${link.other.title}`
  else if (own && !own.startsWith('file:')) source = 'From: own link'
  else if (block.tags.length && !own) source = 'From: own file (no matching playlist yet)'

  const shown = active ? a.queue[a.index] : queue[0]
  return (
    <div className="stack">
      <p className="source-line">{source}</p>
      {shown && <p className="now">♪ {shown.title}</p>}
      <Transport
        active={active}
        queueLen={queue.length}
        onStart={() =>
          void play(queue, 0, { owner: block.id, playlistId: link ? link.other.id : null })
        }
      />
      {link && queue.length === 0 && (
        <p className="dim small">
          That playlist has no audio yet. Pictures and videos show in a Media block.
        </p>
      )}
      {!link && (
        <details>
          <summary className="btn ghost">{own ? 'Change source' : 'Set source'}</summary>
          <SourcePicker
            onFile={async (f) => {
              const r = await upload(f)
              if (r) {
                setContent(block.id, { url: r.ref, name: f.name, mime: r.mime })
                if (active) stop()
              }
            }}
            onLink={(u) => {
              setContent(block.id, { url: u, name: u.split('/').pop() || 'Audio link' })
              if (active) stop()
            }}
          />
        </details>
      )}
    </div>
  )
}

const kindWord: Record<MediaKind, string> = {
  audio: 'audio',
  video: 'video',
  image: 'picture',
  youtube: 'YouTube',
}

/**
 * A playlist holds anything: audio plays through the player (and the mini-player); pictures, videos and
 * YouTube links play as an autoplaying slideshow that never shows in the mini-player.
 */
export function PlaylistBody({ block }: { block: Block }) {
  const idx = useTagIndex()
  const a = useAudio()
  const items = (block.content.items as Item[]) ?? []
  const [reorder, setReorder] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const tracks = tracksOf(block)
  const av = avTracksOf(block)
  const here = a.playlistId === block.id
  const curUrl = here ? a.queue[a.index]?.url : undefined
  const hasVisual = tracks.some((t) => kindOf(t) !== 'audio')

  // A connected Media block (same space) is the "screen"; otherwise this playlist shows the slideshow itself.
  const viewers = targetsOf(idx, block)
    .filter((l) => l.other.type === 'media' && l.other.spaceId === block.spaceId)
    .map((l) => l.other)

  const save = (n: Item[]) => setContent(block.id, { items: n })
  const addLink = () => {
    const u = url.trim()
    if (!u) return
    save([...items, { id: uid(), title: title.trim() || u.split('/').pop() || 'Item', url: u }])
    setTitle('')
    setUrl('')
  }
  const step = (i: number, d: -1 | 1) => {
    const n = [...items]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    save(n)
  }
  const open = (i: number) => {
    const t = tracks[i]
    if (isAvTrack(t) && kindOf(t) === 'audio')
      void play(
        av,
        av.findIndex((x) => x.url === t.url),
        { owner: null, playlistId: block.id },
      )
    else jumpTo(block.id, i)
  }

  return (
    <div className="stack">
      {viewers.length > 0 && (
        <p className="source-line">
          Pictures and videos show on: {viewers.map((v) => v.title).join(', ')}
        </p>
      )}
      {viewers.length === 0 && hasVisual && (
        <Slideshow
          tracks={tracks}
          playlistId={block.id}
          holderId={block.id}
          settings={settingsOf(block.content, FRAME_DEFAULTS)}
          label={`${block.title} slideshow`}
        />
      )}
      {av.length > 0 && (
        <Transport
          active={here}
          queueLen={av.length}
          onStart={() => void play(av, 0, { owner: null, playlistId: block.id })}
        />
      )}
      {items.length > 1 && (
        <button
          className="btn ghost small"
          aria-pressed={reorder}
          onClick={() => setReorder(!reorder)}
        >
          {reorder ? 'Done reordering' : '↕ Reorder'}
        </button>
      )}
      <ol className="playlist">
        {items.map((it, i) => {
          const kind = kindOf(it)
          const now = here && curUrl === it.url && kind !== 'image' && kind !== 'youtube'
          return (
            <li key={it.id} className={now ? 'now-playing' : ''}>
              <span
                className="np"
                aria-label={now ? (a.playing ? 'Now playing' : 'Current track') : undefined}
              >
                {now ? (a.playing ? '▶' : '⏸') : i + 1}
              </span>
              <button className="track" onClick={() => (now ? toggle() : open(i))}>
                <span aria-hidden className="kind-icon">
                  {KIND_ICON[kind]}
                </span>
                <span>
                  {it.title} <small className="dim">{kindWord[kind]}</small>
                </span>
              </button>
              {reorder ? (
                <>
                  <button
                    className="btn ghost icon"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => step(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="btn ghost icon"
                    aria-label="Move down"
                    disabled={i === items.length - 1}
                    onClick={() => step(i, 1)}
                  >
                    ↓
                  </button>
                </>
              ) : (
                <button
                  className="btn ghost icon"
                  aria-label={`Remove ${it.title}`}
                  onClick={() =>
                    change(
                      (s) =>
                        updateBlock(s, block.id, {
                          content: { ...block.content, items: items.filter((x) => x.id !== it.id) },
                        }),
                      'Item removed.',
                    )
                  }
                >
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ol>
      {!items.length && (
        <p className="dim">Nothing here yet. Add audio, pictures, videos or links (YouTube too).</p>
      )}
      <input
        ref={file}
        type="file"
        accept="audio/*,video/*,image/*"
        multiple
        hidden
        onChange={async (e) => {
          const fs = Array.from(e.target.files ?? [])
          e.target.value = ''
          const added: Item[] = []
          for (const f of fs) {
            const r = await upload(f, 'any')
            if (r)
              added.push({
                id: uid(),
                title: f.name.replace(/\.[^.]+$/, ''),
                url: r.ref,
                mime: r.mime,
              })
          }
          if (added.length) save([...items, ...added])
        }}
      />
      <button className="btn secondary" onClick={() => file.current?.click()}>
        ⬆ Add files (audio, pictures, video)
      </button>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          addLink()
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title or caption (optional)"
          aria-label="Item title"
        />
        <div className="row">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link: audio, picture, video or YouTube"
            aria-label="Item link"
          />
          <button className="btn secondary">Add</button>
        </div>
      </form>
      {here && a.error && <p className="insp-warn">⚠ {a.error}</p>}
    </div>
  )
}

/** Docks above the bottom bar while audio is loaded; keeps playing across portals and the Library. Audio only. */
export function MiniPlayer() {
  const a = useAudio()
  if (!a.queue.length) return null
  const t = a.queue[a.index]
  return (
    <div className="mini-player" role="region" aria-label="Audio player">
      <button className="btn ghost icon" aria-label={a.playing ? 'Pause' : 'Play'} onClick={toggle}>
        {a.playing ? '⏸' : '▶'}
      </button>
      <div className="mini-title">
        <span>♪ {t?.title}</span>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={Math.max(1, Math.floor(a.duration))}
          step={1}
          value={Math.min(a.time, a.duration || a.time)}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </div>
      <LoopButton compact />
      {a.queue.length > 1 && <ShuffleButton compact />}
      {a.queue.length > 1 && (
        <button className="btn ghost icon" aria-label="Next track" onClick={next}>
          ⏭
        </button>
      )}
      <button className="btn ghost icon" aria-label="Close player" onClick={stop}>
        ✕
      </button>
    </div>
  )
}
