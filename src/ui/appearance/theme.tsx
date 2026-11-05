import { useEffect, useRef, useState } from 'react'
import { lookVars } from '../../model/defaults'
import { isVideoUrl } from '../../lib/media'
import type { Look } from '../../model/types'
import { useResolvedUrl } from '../hooks'

/** Props that apply a look to a container: CSS variables + motion / icon-style hooks. */
export function themeProps(look: Look) {
  return {
    style: lookVars(look) as React.CSSProperties,
    'data-motion': look.motion,
    'data-icons': look.iconStyle,
    'data-density': look.density,
  } as const
}

/** True after `ms` without interaction, or while the tab is hidden. */
export function useIdle(enabled: boolean, ms = 30000) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let t = window.setTimeout(() => setIdle(true), ms)
    const wake = () => {
      setIdle(document.hidden)
      window.clearTimeout(t)
      t = window.setTimeout(() => setIdle(true), ms)
    }
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'] as const
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    document.addEventListener('visibilitychange', wake)
    return () => {
      window.clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, wake))
      document.removeEventListener('visibilitychange', wake)
    }
  }, [enabled, ms])
  return enabled && idle
}

function FrozenFrame({ src, className }: { src: string; className?: string }) {
  const c = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const cv = c.current
      if (!cv) return
      cv.width = img.naturalWidth
      cv.height = img.naturalHeight
      cv.getContext('2d')?.drawImage(img, 0, 0)
    }
    img.src = src
  }, [src])
  return <canvas ref={c} className={className} />
}

/**
 * Background layer: none / solid / gradient / image (GIF, video too).
 * An automatic scrim keeps text readable over images. Broken links fall back to a solid color with ⚠.
 */
export function BackdropLayer({ look, contained }: { look: Look; contained?: boolean }) {
  const b = look.backdrop
  const resolved = useResolvedUrl(b.mode === 'image' ? b.url : null)
  const [broken, setBroken] = useState('')
  const video = b.mode === 'image' && (b.mime.startsWith('video/') || isVideoUrl(b.url))
  const gif = b.mode === 'image' && (b.mime === 'image/gif' || /\.gif(\?|$)/i.test(b.url))
  const idle = useIdle(b.pauseIdle && (video || gif))
  const vid = useRef<HTMLVideoElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = host.current
    if (!el || !video || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [video])
  useEffect(() => {
    const v = vid.current
    if (!v) return
    if (idle || !visible) v.pause()
    else v.play().catch(() => undefined)
  }, [idle, visible, resolved])

  if (b.mode === 'none') return null
  const pos = contained ? 'absolute' : b.fixed ? 'fixed' : 'absolute'
  const base: React.CSSProperties = {
    position: pos,
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  }
  const failed =
    b.mode === 'image' && !video && (broken === b.url || (!resolved && !!b.url && broken === b.url))
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: b.blur ? -b.blur * 2 : 0,
    backgroundImage: resolved ? `url("${resolved}")` : undefined,
    backgroundSize: b.fit === 'contain' ? 'contain' : b.fit === 'tile' ? 'auto' : 'cover',
    backgroundRepeat: b.fit === 'tile' ? 'repeat' : 'no-repeat',
    backgroundPosition: b.position,
    filter: b.blur ? `blur(${b.blur}px)` : undefined,
  }
  // Auto scrim: images always get at least a light scrim so text stays readable.
  const scrim = b.mode === 'image' ? Math.max(b.dim / 100, 0.3) : 0

  return (
    <div ref={host} aria-hidden style={base} className="backdrop">
      {b.mode === 'solid' && (
        <div style={{ position: 'absolute', inset: 0, background: b.color }} />
      )}
      {b.mode === 'gradient' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(${b.angle}deg, ${b.color}, ${b.color2})`,
          }}
        />
      )}
      {b.mode === 'image' && !failed && resolved && !video && !(gif && idle) && (
        <div style={imgStyle} />
      )}
      {b.mode === 'image' && !failed && resolved && gif && idle && (
        <FrozenFrame src={resolved} className="backdrop-frozen" />
      )}
      {video && resolved && (
        <video
          ref={vid}
          src={resolved}
          muted
          loop
          playsInline
          autoPlay
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: b.fit === 'contain' ? 'contain' : 'cover',
            filter: b.blur ? `blur(${b.blur}px)` : undefined,
          }}
          onError={() => setBroken(b.url)}
        />
      )}
      {b.mode === 'image' && (failed || (!resolved && !!b.url && broken === b.url) || !b.url) && (
        <div style={{ position: 'absolute', inset: 0, background: look.bg }} />
      )}
      {scrim > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: look.bg, opacity: scrim }} />
      )}
      {b.mode === 'image' && b.url && !video && (
        <img src={resolved ?? undefined} alt="" hidden onError={() => setBroken(b.url)} />
      )}
      {failed && (
        <div className="backdrop-warn" role="status" style={{ pointerEvents: 'auto' }}>
          ⚠ Background image couldn’t load
        </div>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { blockStyle, diffVars, fillCss } from '../../model/appearance'
import type { Block } from '../../model/types'

/** Per-block inline style: only the variables that differ from the space, plus its fill background. */
export function useBlockSkin(blocks: Block[], block: Block, base: Look) {
  const st = useMemo(() => blockStyle({ blocks }, block, base), [blocks, block, base])
  const imgUrl = useResolvedUrl(st.fill?.mode === 'image' ? st.fill.url : null)
  return useMemo(() => {
    const vars = diffVars(st.look, base)
    const bg = fillCss(st.fill, imgUrl)
    const style = { ...vars, ...(bg ? { background: bg } : {}) } as React.CSSProperties
    return { style, header: st.look.header, custom: st.custom }
  }, [st, base, imgUrl])
}
