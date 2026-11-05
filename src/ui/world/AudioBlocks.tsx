import { useRef, useState } from 'react'
import { UploadError, ingestFile, isVideoUrl, youtubeId } from '../../lib/media'
import { connectedPlaylist, tagLabel } from '../../model/tags'
import type { Block } from '../../model/types'
import {
  isPlayable,
  next,
  play,
  prev,
  seek,
  setRate,
  skip,
  stop,
  toggle,
  useAudio,
  tracksOfBlock,
  type Track,
} from '../../store/audio'
import { change, setContent, showToast } from '../../store/store'
import { useTagIndex } from '../hooks'
import { updateBlock } from '../../model/ops'
import { uid } from '../../model/defaults'

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  return `${m}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}
const RATES = [0.75, 1, 1.25, 1.5, 2]

interface Item {
  id: string
  title: string
  url: string
}
export const tracksOf = tracksOfBlock

/** Shared transport: play/pause, ±10s, scrub, speed (+ prev/next for queues). */
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
        <button
          className="btn ghost speed"
          aria-label={`Speed ${rate} times. Tap to change.`}
          onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
        >
          {rate}×
        </button>
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

async function upload(f: File) {
  try {
    return (await ingestFile(f, 'audio')).ref
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
  const ownTracks: Track[] = own ? [{ title: ownName, url: own }] : []
  const queue = link ? tracksOf(link.other) : ownTracks
  const active = a.owner === block.id || (!!link && a.playlistId === link.other.id)

  let source = 'From: own file'
  if (link) source = `From: ${tagLabel(link.tag)} playlist · ${link.other.title}`
  else if (own && !own.startsWith('file:')) source = 'From: own link'
  else if (block.tags.length && !own) source = 'From: own file (no matching playlist yet)'

  const startFrom = (i = 0) =>
    void play(queue, i, { owner: block.id, playlistId: link ? link.other.id : null })

  return (
    <div className="stack">
      <p className="source-line">{source}</p>
      {(active ? a.queue[a.index]?.title : queue[0]?.title) && (
        <p className="now">♪ {active ? a.queue[a.index]?.title : queue[0]?.title}</p>
      )}
      <Transport active={active} queueLen={queue.length} onStart={() => startFrom(0)} />
      {!link && (
        <details>
          <summary className="btn ghost">{own ? 'Change source' : 'Set source'}</summary>
          <SourcePicker
            onFile={async (f) => {
              const ref = await upload(f)
              if (ref) {
                setContent(block.id, { url: ref, name: f.name })
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

export function PlaylistBody({ block }: { block: Block }) {
  const a = useAudio()
  const items = (block.content.items as Item[]) ?? []
  const [reorder, setReorder] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const tracks = tracksOf(block)
  const here = a.playlistId === block.id

  const save = (next: Item[]) => setContent(block.id, { items: next })
  const addLink = () => {
    const u = url.trim()
    if (!u) return
    save([...items, { id: uid(), title: title.trim() || u.split('/').pop() || 'Track', url: u }])
    setTitle('')
    setUrl('')
  }
  const step = (i: number, d: -1 | 1) => {
    const n = [...items]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    save(n)
  }
  return (
    <div className="stack">
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
          const now = here && a.index === i && !!a.queue.length
          const playable = isPlayable(it.url)
          return (
            <li key={it.id} className={now ? 'now-playing' : ''}>
              <span
                className="np"
                aria-label={now ? (a.playing ? 'Now playing' : 'Paused here') : undefined}
              >
                {now ? (a.playing ? '▶' : '⏸') : i + 1}
              </span>
              {playable ? (
                <button
                  className="track"
                  onClick={() =>
                    now ? toggle() : void play(tracks, i, { owner: null, playlistId: block.id })
                  }
                >
                  {it.title}
                </button>
              ) : (
                <a className="track" href={it.url} target="_blank" rel="noopener noreferrer">
                  {it.title} ↗{' '}
                  <small className="dim">
                    {youtubeId(it.url) ? 'YouTube opens in a new tab' : ''}
                  </small>
                </a>
              )}
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
                      'Track removed.',
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
      {!items.length && <p className="dim">No tracks yet. Add a file or a link.</p>}
      <input
        ref={file}
        type="file"
        accept="audio/*,video/*"
        multiple
        hidden
        onChange={async (e) => {
          const fs = Array.from(e.target.files ?? [])
          e.target.value = ''
          const added: Item[] = []
          for (const f of fs) {
            const ref = await upload(f)
            if (ref) added.push({ id: uid(), title: f.name.replace(/\.[^.]+$/, ''), url: ref })
          }
          if (added.length) save([...items, ...added])
        }}
      />
      <button className="btn secondary" onClick={() => file.current?.click()}>
        ⬆ Add files
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
          placeholder="Title (optional)"
          aria-label="Track title"
        />
        <div className="row">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste an audio or video link"
            aria-label="Track link"
          />
          <button className="btn secondary">Add</button>
        </div>
      </form>
      {here && a.error && <p className="insp-warn">⚠ {a.error}</p>}
      {items.some((i) => isVideoUrl(i.url)) && (
        <p className="dim small">Video links play as audio only.</p>
      )}
    </div>
  )
}

/** Docks above the bottom bar while something is loaded; keeps playing across portals and the Library. */
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
      <button className="btn ghost icon" aria-label="Back 10 seconds" onClick={() => skip(-10)}>
        ↺
      </button>
      <button className="btn ghost icon" aria-label="Forward 10 seconds" onClick={() => skip(10)}>
        ↻
      </button>
      <button className="btn ghost icon" aria-label="Close player" onClick={stop}>
        ✕
      </button>
    </div>
  )
}
