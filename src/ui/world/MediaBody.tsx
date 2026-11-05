import { useEffect, useRef, useState } from 'react'
import { UploadError, ingestFile, isVideoUrl, youtubeId } from '../../lib/media'
import type { Block } from '../../model/types'
import { setContent, showToast } from '../../store/store'
import { useResolvedUrl } from '../hooks'

/** Full-screen image viewer: pinch / wheel / buttons to zoom, drag to pan when zoomed. */
export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [t, setT] = useState({ k: 1, x: 0, y: 0 })
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const last = useRef({ d: 0, x: 0, y: 0 })
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  const zoom = (f: number) =>
    setT((v) => ({
      ...v,
      k: Math.min(6, Math.max(1, v.k * f)),
      ...(v.k * f <= 1 ? { x: 0, y: 0 } : {}),
    }))
  const dist = () => {
    const [a, b] = [...pts.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Image: ${alt}`}>
      <div className="lb-bar">
        <button className="btn secondary icon" aria-label="Zoom out" onClick={() => zoom(0.8)}>
          −
        </button>
        <button
          className="btn secondary icon"
          aria-label="Reset zoom"
          onClick={() => setT({ k: 1, x: 0, y: 0 })}
        >
          1×
        </button>
        <button className="btn secondary icon" aria-label="Zoom in" onClick={() => zoom(1.25)}>
          ＋
        </button>
        <button className="btn primary icon" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div
        className="lb-stage"
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
        onPointerDown={(e) => {
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          last.current = { d: pts.current.size === 2 ? dist() : 0, x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          if (!pts.current.has(e.pointerId)) return
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          if (pts.current.size === 2) {
            const d = dist()
            if (last.current.d) zoom(d / last.current.d)
            last.current.d = d
          } else if (t.k > 1) {
            const dx = e.clientX - last.current.x
            const dy = e.clientY - last.current.y
            last.current.x = e.clientX
            last.current.y = e.clientY
            setT((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
          }
        }}
        onPointerUp={(e) => pts.current.delete(e.pointerId)}
        onPointerCancel={(e) => pts.current.delete(e.pointerId)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}
        />
      </div>
    </div>
  )
}

export default function MediaBody({ block }: { block: Block }) {
  const url = String(block.content.url ?? '')
  const mime = String(block.content.mime ?? '')
  const src = useResolvedUrl(url)
  const [broken, setBroken] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const yt = youtubeId(url)
  const isVideo = mime.startsWith('video/') || isVideoUrl(url)

  const picker = (
    <div className="stack">
      <input
        ref={file}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const r = await ingestFile(f, 'media')
            setContent(block.id, { url: r.ref, mime: r.mime })
            setBroken('')
          } catch (err) {
            showToast(err instanceof UploadError ? err.message : 'Could not save that file.')
          }
        }}
      />
      <button className="btn secondary" onClick={() => file.current?.click()}>
        ⬆ Upload image, GIF or video
      </button>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (link.trim()) {
            setContent(block.id, { url: link.trim(), mime: '' })
            setBroken('')
            setLink('')
          }
        }}
      >
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="…or paste an image, video or YouTube link"
          aria-label="Media link"
        />
        <button className="btn secondary">Use</button>
      </form>
    </div>
  )

  if (!url) return picker
  let view
  if (yt)
    view = (
      <div className="embed">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title={block.title}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  else if (broken === url)
    view = (
      <div className="media-broken" role="img" aria-label="Media failed to load">
        ⚠ Couldn’t load this media. Check the link.
      </div>
    )
  else if (!src) view = <div className="media-broken">Loading…</div>
  else if (isVideo)
    view = (
      <video className="media-img" src={src} controls playsInline onError={() => setBroken(url)} />
    )
  else
    view = (
      <button
        className="media-btn"
        aria-label={`Open ${block.title} full screen`}
        onClick={() => setOpen(true)}
      >
        <img className="media-img" src={src} alt={block.title} onError={() => setBroken(url)} />
      </button>
    )
  return (
    <div className="stack">
      {view}
      <details>
        <summary className="btn ghost">Replace</summary>
        {picker}
      </details>
      {open && src && <Lightbox src={src} alt={block.title} onClose={() => setOpen(false)} />}
    </div>
  )
}
