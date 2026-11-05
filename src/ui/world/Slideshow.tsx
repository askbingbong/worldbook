import { useEffect, useMemo, useRef, useState } from 'react'
import { KIND_ICON, kindOf, youtubeId, type MediaKind } from '../../lib/media'
import type { Track } from '../../store/audio'
import { useJump } from '../../store/slides'
import { setContent } from '../../store/store'
import { useResolvedUrl } from '../hooks'
import { Lightbox } from './Lightbox'

export interface FrameSettings {
  ratio: 'auto' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16'
  fit: 'contain' | 'cover'
  width: 50 | 75 | 100
  interval: number
  autoplay: boolean
  shuffle: boolean
  repeat: boolean
  captions: boolean
}
export const FRAME_DEFAULTS: FrameSettings = {
  ratio: '16:9',
  fit: 'contain',
  width: 100,
  interval: 5,
  autoplay: true,
  shuffle: false,
  repeat: true,
  captions: true,
}
export const RATIOS: { value: FrameSettings['ratio']; label: string }[] = [
  { value: 'auto', label: 'Auto (follows each picture)' },
  { value: '16:9', label: 'Wide 16:9' },
  { value: '4:3', label: 'Classic 4:3' },
  { value: '1:1', label: 'Square' },
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '9:16', label: 'Tall 9:16' },
]
export const settingsOf = (
  content: Record<string, unknown>,
  defaults = FRAME_DEFAULTS,
): FrameSettings =>
  ({
    ...defaults,
    ...Object.fromEntries(Object.entries(content).filter(([k]) => k in defaults)),
  }) as FrameSettings

export const frameStyle = (s: Pick<FrameSettings, 'ratio' | 'width'>): React.CSSProperties => ({
  width: `${s.width}%`,
  ...(s.ratio === 'auto' ? {} : { aspectRatio: s.ratio.replace(':', ' / ') }),
})

/** Shape / fit / width of the picture frame. A fixed shape means different resolutions never move the page around. */
export function FrameControls({ holderId, s }: { holderId: string; s: FrameSettings }) {
  const set = (p: Partial<FrameSettings>) => setContent(holderId, p)
  return (
    <div className="stack">
      <label>
        Frame shape
        <select
          value={s.ratio}
          onChange={(e) => set({ ratio: e.target.value as FrameSettings['ratio'] })}
        >
          {RATIOS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <div className="seg" role="group" aria-label="Fit">
        {(
          [
            ['contain', 'Fit whole picture'],
            ['cover', 'Fill the frame'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            className={s.fit === v ? 'on' : ''}
            aria-pressed={s.fit === v}
            onClick={() => set({ fit: v })}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Width">
        {(
          [
            [50, 'Small'],
            [75, 'Medium'],
            [100, 'Full width'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            className={s.width === v ? 'on' : ''}
            aria-pressed={s.width === v}
            onClick={() => set({ width: v })}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function Thumb({ track, kind }: { track: Track; kind: MediaKind }) {
  const src = useResolvedUrl(kind === 'image' ? track.url : null)
  if (kind === 'image' && src) return <img src={src} alt="" loading="lazy" />
  return <span aria-hidden>{KIND_ICON[kind]}</span>
}

const shuffled = (n: number) => {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Autoplaying slideshow over a playlist's pictures, videos and YouTube links.
 * It is independent of the audio engine, so it never shows up in the bottom mini-player.
 * `holderId` is the block whose content stores the display settings.
 */
export default function Slideshow({
  tracks,
  playlistId,
  holderId,
  settings,
  label,
}: {
  tracks: Track[]
  playlistId: string
  holderId: string
  settings: FrameSettings
  label: string
}) {
  const visual = useMemo(
    () => tracks.map((t, orig) => ({ t, orig, kind: kindOf(t) })).filter((x) => x.kind !== 'audio'),
    [tracks],
  )
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(settings.autoplay && !reduced)
  const [order, setOrder] = useState<number[]>(() =>
    settings.shuffle ? shuffled(visual.length) : visual.map((_, k) => k),
  )
  const [light, setLight] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const jump = useJump(playlistId)

  // Re-deal the order when the list size or shuffle setting changes.
  useEffect(() => {
    setOrder(settings.shuffle ? shuffled(visual.length) : visual.map((_, k) => k))
    setI(0)
  }, [visual.length, settings.shuffle]) // eslint-disable-line react-hooks/exhaustive-deps

  // A click on an item in the Playlist list jumps here.
  useEffect(() => {
    if (!jump.n) return
    const v = visual.findIndex((x) => x.orig === jump.index)
    if (v >= 0) setI(Math.max(0, order.indexOf(v)))
  }, [jump.n]) // eslint-disable-line react-hooks/exhaustive-deps

  const count = visual.length
  const pos = Math.min(i, Math.max(0, count - 1))
  const cur = count ? visual[order[pos] ?? 0] : undefined
  const src = useResolvedUrl(cur && cur.kind !== 'youtube' ? cur.t.url : null)

  const go = (d: 1 | -1, auto = false) => {
    if (!count) return
    const n = pos + d
    if (n >= count || n < 0) {
      if (auto && !settings.repeat) return setPlaying(false)
      return setI(n < 0 ? count - 1 : 0)
    }
    setI(n)
  }
  // Pictures advance on a timer; videos advance when they finish; YouTube waits for you.
  const goRef = useRef(go)
  goRef.current = go
  useEffect(() => {
    if (!playing || !cur || cur.kind !== 'image' || count < 2) return
    const t = window.setTimeout(() => goRef.current(1, true), settings.interval * 1000)
    return () => window.clearTimeout(t)
  }, [playing, cur?.orig, pos, settings.interval, count]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!count)
    return (
      <p className="dim">Add pictures, videos or YouTube links to the playlist to see them here.</p>
    )
  const fit = settings.fit
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === ' ' && e.target === e.currentTarget) {
      e.preventDefault()
      setPlaying((p) => !p)
    }
  }
  const fullscreen = () => {
    if (cur?.kind === 'image') {
      setPlaying(false)
      setLight(true)
    } else void frame.current?.requestFullscreen?.().catch(() => undefined)
  }

  return (
    <div
      className="slideshow stack"
      role="group"
      aria-roledescription="slideshow"
      aria-label={label}
    >
      <div
        className="slide-frame"
        style={frameStyle(settings)}
        ref={frame}
        tabIndex={0}
        onKeyDown={onKey}
        aria-label="Slideshow. Use left and right arrow keys to change picture."
      >
        {cur?.kind === 'youtube' && youtubeId(cur.t.url) && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId(cur.t.url)}`}
            title={cur.t.title}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        )}
        {cur?.kind === 'image' &&
          (src ? (
            <img
              key={cur.orig}
              src={src}
              alt={cur.t.title}
              style={{ objectFit: fit }}
              className={settings.ratio === 'auto' ? 'auto-img' : ''}
            />
          ) : (
            <span className="dim">Loading…</span>
          ))}
        {cur?.kind === 'video' &&
          (src ? (
            <video
              key={cur.orig}
              src={src}
              controls
              playsInline
              muted
              autoPlay={playing}
              style={{ objectFit: fit }}
              className={settings.ratio === 'auto' ? 'auto-img' : ''}
              onEnded={() => (playing || count > 1) && go(1, true)}
              onPlay={() => setPlaying(true)}
            />
          ) : (
            <span className="dim">Loading…</span>
          ))}
        {settings.captions && cur && <div className="slide-caption">{cur.t.title}</div>}
      </div>
      <div className="slide-bar">
        <button
          className="btn ghost icon"
          aria-label="Previous picture"
          disabled={count < 2}
          onClick={() => go(-1)}
        >
          ⏮
        </button>
        <button
          className="btn ghost icon"
          aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
          aria-pressed={playing}
          disabled={count < 2 && cur?.kind !== 'video'}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          className="btn ghost icon"
          aria-label="Next picture"
          disabled={count < 2}
          onClick={() => go(1)}
        >
          ⏭
        </button>
        <span className="dim small slide-count" aria-live="polite">
          {pos + 1} / {count}
        </span>
        <button className="btn ghost icon" aria-label="Full screen" onClick={fullscreen}>
          ⛶
        </button>
      </div>
      {cur?.kind === 'youtube' && playing && (
        <p className="dim small">
          YouTube items can’t advance by themselves. Tap Next when you’re ready.
        </p>
      )}
      {count > 1 && (
        <div className="thumbs" role="list" aria-label="Pictures">
          {order.map((vi, k) => (
            <button
              key={visual[vi].orig}
              role="listitem"
              className={`thumb${k === pos ? ' on' : ''}`}
              aria-label={`Show ${visual[vi].t.title}`}
              aria-current={k === pos}
              onClick={() => setI(k)}
            >
              <Thumb track={visual[vi].t} kind={visual[vi].kind} />
            </button>
          ))}
        </div>
      )}
      <details>
        <summary className="btn ghost">⚙ Display &amp; slideshow</summary>
        <div className="stack">
          <FrameControls holderId={holderId} s={settings} />
          <label>
            Change picture every
            <select
              value={settings.interval}
              onChange={(e) => setContent(holderId, { interval: Number(e.target.value) })}
            >
              {[3, 5, 8, 10, 15, 30].map((n) => (
                <option key={n} value={n}>
                  {n} seconds
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ['autoplay', 'Start automatically'],
              ['shuffle', 'Shuffle'],
              ['repeat', 'Repeat from the start'],
              ['captions', 'Show captions'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="check-row">
              <input
                type="checkbox"
                checked={settings[k]}
                onChange={(e) => setContent(holderId, { [k]: e.target.checked })}
              />
              <span>{l}</span>
            </label>
          ))}
          {reduced && (
            <p className="dim small">
              Your device asks for reduced motion, so slideshows start paused.
            </p>
          )}
        </div>
      </details>
      {light && cur?.kind === 'image' && src && (
        <Lightbox
          src={src}
          alt={cur.t.title}
          onClose={() => setLight(false)}
          onPrev={count > 1 ? () => go(-1) : undefined}
          onNext={count > 1 ? () => go(1) : undefined}
          caption={`${cur.t.title} · ${pos + 1} / ${count}`}
        />
      )}
    </div>
  )
}
