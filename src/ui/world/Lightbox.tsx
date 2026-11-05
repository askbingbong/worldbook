import { useEffect, useRef, useState } from 'react'

/** Full-screen image viewer: pinch / wheel / buttons to zoom, drag to pan when zoomed. */
export function Lightbox({
  src,
  alt,
  onClose,
  onPrev,
  onNext,
  caption,
}: {
  src: string
  alt: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  caption?: string
}) {
  const [t, setT] = useState({ k: 1, x: 0, y: 0 })
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const last = useRef({ d: 0, x: 0, y: 0 })
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onNext?.()
      else if (e.key === 'ArrowLeft') onPrev?.()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose, onNext, onPrev])
  useEffect(() => setT({ k: 1, x: 0, y: 0 }), [src])
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
        {onPrev && (
          <button className="btn secondary icon" aria-label="Previous picture" onClick={onPrev}>
            ⏮
          </button>
        )}
        {onNext && (
          <button className="btn secondary icon" aria-label="Next picture" onClick={onNext}>
            ⏭
          </button>
        )}
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
      {caption && <div className="lb-caption">{caption}</div>}
    </div>
  )
}
