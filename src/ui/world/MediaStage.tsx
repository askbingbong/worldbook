import { useEffect, useRef, useState } from 'react'
import { KIND_ICON, kindOf, youtubeId } from '../../lib/media'
import { mediaEl, useAudio, type Track } from '../../store/audio'
import { useResolvedUrl } from '../hooks'
import { Lightbox } from './Lightbox'

/** Attaches the shared player element to the page so video is visible. Audio keeps playing if it unmounts. */
function VideoHost() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host || !mediaEl) return
    mediaEl.className = 'stage-video'
    host.appendChild(mediaEl)
    return () => {
      if (mediaEl.parentElement === host) host.removeChild(mediaEl)
    }
  }, [])
  const full = () => {
    const v = mediaEl as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!v) return
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => undefined)
    else v.webkitEnterFullscreen?.()
  }
  return (
    <div>
      <div ref={ref} className="video-host" />
      <button className="btn ghost small" onClick={full}>
        ⛶ Full screen
      </button>
    </div>
  )
}

/**
 * Shows one playlist entry: an image (tap for full screen), a video (the live player element),
 * a YouTube embed, or an audio card. `showVideo` is false when another block is already showing the video.
 */
export default function Stage({
  track,
  active,
  showVideo = true,
}: {
  track?: Track
  active: boolean
  showVideo?: boolean
}) {
  const a = useAudio()
  const [open, setOpen] = useState(false)
  const src = useResolvedUrl(track ? track.url : null)
  if (!track) return null
  const kind = kindOf(track)
  const yt = youtubeId(track.url)
  if (kind === 'youtube' && yt)
    return (
      <div className="embed">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title={track.title}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  if (kind === 'image')
    return src ? (
      <>
        <button
          className="media-btn"
          aria-label={`Open ${track.title} full screen`}
          onClick={() => setOpen(true)}
        >
          <img className="media-img" src={src} alt={track.title} />
        </button>
        {open && <Lightbox src={src} alt={track.title} onClose={() => setOpen(false)} />}
      </>
    ) : (
      <div className="media-broken">Loading…</div>
    )
  if (kind === 'video')
    return active && showVideo ? (
      <VideoHost />
    ) : (
      <div className="media-broken">
        {KIND_ICON.video}{' '}
        {active ? 'Video is showing in another block.' : `Press play to start “${track.title}”.`}
      </div>
    )
  return (
    <div className="audio-card" aria-hidden={!active}>
      <span className="audio-art">{KIND_ICON.audio}</span>
      <span>{track.title}</span>
      {active && a.loading && <small className="dim">Loading…</small>}
    </div>
  )
}
