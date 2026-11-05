import { useRef, useState } from 'react'
import { KIND_ICON, UploadError, ingestFile, isVideoUrl, kindOf, youtubeId } from '../../lib/media'
import { connectedPlaylist, tagLabel, targetsOf } from '../../model/tags'
import { play, tracksOfBlock, useAudio } from '../../store/audio'
import { useTagIndex } from '../hooks'
import { Lightbox } from './Lightbox'
import Stage from './MediaStage'
import { Transport } from './AudioBlocks'
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

/** A Media block tagged like a Playlist becomes its "screen": it shows the current image, video or YouTube item. */
function PlaylistViewer({ block, pl, tag }: { block: Block; pl: Block; tag: string }) {
  const idx = useTagIndex()
  const a = useAudio()
  const tracks = tracksOfBlock(pl)
  const active = a.playlistId === pl.id
  const viewers = targetsOf(idx, pl)
    .filter((l) => l.other.type === 'media' && l.other.spaceId === pl.spaceId)
    .map((l) => l.other.id)
    .sort()
  const primary = !viewers.length || viewers[0] === block.id
  const cur = active ? a.queue[a.index] : tracks[0]
  const start = (i: number) =>
    void play(tracks, i, { owner: block.id, playlistId: pl.id, filter: 'all' })
  return (
    <div className="stack">
      <p className="source-line">
        From: {tagLabel(tag)} playlist · {pl.title}
      </p>
      <Stage track={cur} active={active} showVideo={primary} />
      {cur && (
        <p className="now">
          {KIND_ICON[kindOf(cur)]} {cur.title}
        </p>
      )}
      <Transport active={active} queueLen={tracks.length} onStart={() => start(0)} />
      {!tracks.length && <p className="dim">That playlist is empty. Add items to it.</p>}
      {tracks.length > 1 && (
        <details>
          <summary className="btn ghost">Items ({tracks.length})</summary>
          <ol className="playlist">
            {tracks.map((t, i) => (
              <li key={i} className={active && a.index === i ? 'now-playing' : ''}>
                <span className="np">{active && a.index === i ? '▶' : i + 1}</span>
                <button className="track" onClick={() => start(i)}>
                  <span aria-hidden className="kind-icon">
                    {KIND_ICON[kindOf(t)]}
                  </span>
                  {t.title}
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
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
