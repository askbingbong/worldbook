import { useRef, useState } from 'react'
import { UploadError, ingestFile, isVideoUrl, youtubeId } from '../../lib/media'
import { connectedPlaylist, tagLabel } from '../../model/tags'
import { tracksOfBlock } from '../../store/audio'
import { useTagIndex } from '../hooks'
import { Lightbox } from './Lightbox'
import Slideshow, { FRAME_DEFAULTS, FrameControls, frameStyle, settingsOf } from './Slideshow'
import type { Block } from '../../model/types'
import { setContent, showToast } from '../../store/store'
import { useResolvedUrl } from '../hooks'

function OwnMedia({ block }: { block: Block }) {
  const url = String(block.content.url ?? '')
  const mime = String(block.content.mime ?? '')
  const src = useResolvedUrl(url)
  const [broken, setBroken] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const yt = youtubeId(url)
  const isVideo = mime.startsWith('video/') || isVideoUrl(url)
  const fs = settingsOf(block.content, { ...FRAME_DEFAULTS, ratio: 'auto' })
  const imgStyle = { objectFit: fs.fit } as const

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
      <video
        className="media-img"
        style={imgStyle}
        src={src}
        controls
        playsInline
        onError={() => setBroken(url)}
      />
    )
  else
    view = (
      <button
        className="media-btn"
        aria-label={`Open ${block.title} full screen`}
        onClick={() => setOpen(true)}
      >
        <img
          className="media-img"
          style={imgStyle}
          src={src}
          alt={block.title}
          onError={() => setBroken(url)}
        />
      </button>
    )
  return (
    <div className="stack">
      <div
        className={`slide-frame single${fs.ratio === 'auto' ? ' auto' : ''}`}
        style={frameStyle(fs)}
      >
        {view}
      </div>
      <details>
        <summary className="btn ghost">Replace</summary>
        {picker}
      </details>
      <details>
        <summary className="btn ghost">Size &amp; shape</summary>
        <FrameControls holderId={block.id} s={fs} />
      </details>
      {open && src && <Lightbox src={src} alt={block.title} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** A Media block tagged like a Playlist becomes its "screen": an autoplaying slideshow of its pictures, videos and YouTube links. */
function PlaylistViewer({ block, pl, tag }: { block: Block; pl: Block; tag: string }) {
  const tracks = tracksOfBlock(pl)
  return (
    <div className="stack">
      <p className="source-line">
        From: {tagLabel(tag)} playlist · {pl.title}
      </p>
      <Slideshow
        tracks={tracks}
        playlistId={pl.id}
        holderId={block.id}
        settings={settingsOf(block.content, FRAME_DEFAULTS)}
        label={`${block.title} slideshow`}
      />
    </div>
  )
}

export default function MediaBody({ block }: { block: Block }) {
  const idx = useTagIndex()
  const link = connectedPlaylist(idx, block)
  return link ? (
    <PlaylistViewer block={block} pl={link.other} tag={link.tag} />
  ) : (
    <OwnMedia block={block} />
  )
}
