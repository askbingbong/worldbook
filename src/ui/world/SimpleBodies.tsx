import { useState } from 'react'
import type { Block } from '../../model/types'
import { metaOf } from '../../model/blockTypes'

export function MediaBody({ block }: { block: Block }) {
  const url = String(block.content.url ?? '')
  const [broken, setBroken] = useState(false)
  if (!url) return <p className="dim">Media upload and links arrive in Stage 3.</p>
  if (broken)
    return (
      <div className="media-broken" role="img" aria-label="Image failed to load">
        ⚠ Couldn’t load this image
      </div>
    )
  return <img className="media-img" src={url} alt={block.title} onError={() => setBroken(true)} />
}

export function PlaylistBody({ block }: { block: Block }) {
  const items = (block.content.items as { title: string }[]) ?? []
  return (
    <div>
      <ol className="plain-list">
        {items.map((i, n) => (
          <li key={n}>{i.title}</li>
        ))}
      </ol>
      {!items.length && <p className="dim">No tracks yet.</p>}
      <p className="dim small">Playback arrives in Stage 3.</p>
    </div>
  )
}

export function SoonBody({ block }: { block: Block }) {
  return <p className="dim">{metaOf(block.type).label} arrives in a later stage.</p>
}
