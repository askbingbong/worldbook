import { useState } from 'react'
import { metaOf } from '../../model/blockTypes'
import type { Block, Space, World } from '../../model/types'
import { change, showToast, useStore } from '../../store/store'
import Sheet from '../Sheet'

export function RenameSheet({
  world,
  space,
  onClose,
}: {
  world: World
  space: Space
  onClose: () => void
}) {
  const [v, setV] = useState(space.title)
  const isRoot = space.id === world.rootSpaceId
  const save = () => {
    const t = v.trim()
    if (t)
      change((s) => ({
        ...s,
        spaces: s.spaces.map((x) => (x.id === space.id ? { ...x, title: t } : x)),
        worlds: isRoot
          ? s.worlds.map((w) => (w.id === world.id ? { ...w, title: t } : w))
          : s.worlds,
      }))
    onClose()
  }
  return (
    <Sheet title={isRoot ? 'Rename world' : 'Rename space'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} aria-label="Name" />
        <button className="btn primary">Save</button>
      </form>
    </Sheet>
  )
}

export function WorldMenu({ onClose, onSelect }: { onClose: () => void; onSelect: () => void }) {
  const soon = (what: string, stage: number) => () => {
    showToast(`${what} arrives in Stage ${stage}.`)
    onClose()
  }
  return (
    <Sheet title="World menu" onClose={onClose}>
      <div className="stack">
        <button className="btn secondary" onClick={soon('Appearance', 5)}>
          Appearance
        </button>
        <button className="btn secondary" onClick={soon('Theme', 5)}>
          Theme
        </button>
        <button className="btn secondary" onClick={soon('Export', 6)}>
          Export
        </button>
        <button className="btn secondary" onClick={onSelect}>
          Select mode
        </button>
      </div>
    </Sheet>
  )
}

export function SearchSheet({
  worldId,
  onJump,
  onClose,
}: {
  worldId: string
  onJump: (b: Block) => void
  onClose: () => void
}) {
  const { snap } = useStore()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase().replace(/^[#@]/, '')
  const hits = needle
    ? snap.blocks.filter((b) => {
        if (b.worldId !== worldId) return false
        const text = typeof b.content.text === 'string' ? b.content.text : ''
        return (
          b.title.toLowerCase().includes(needle) ||
          text.toLowerCase().includes(needle) ||
          b.tags.some((t) => t.name.toLowerCase().replace(/^@/, '').includes(needle))
        )
      })
    : []
  return (
    <Sheet title="Search this world" onClose={onClose} tall>
      <div className="stack">
        <input
          type="search"
          autoFocus
          placeholder="Block names, text, tags…"
          aria-label="Search this world"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {needle && !hits.length && <p className="dim">Nothing found.</p>}
        {hits.map((b) => (
          <button key={b.id} className="btn secondary result" onClick={() => onJump(b)}>
            <span aria-hidden>{metaOf(b.type).icon}</span> {b.title || metaOf(b.type).label}
            <small className="dim"> · {snap.spaces.find((s) => s.id === b.spaceId)?.title}</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export function PathSheet({
  world,
  path,
  onGo,
  onLibrary,
  onClose,
}: {
  world: World
  path: Space[]
  onGo: (s: Space) => void
  onLibrary: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="Where you are" onClose={onClose}>
      <div className="stack">
        <button className="btn secondary" onClick={onLibrary}>
          📚 Library
        </button>
        {path.map((s, i) => (
          <button
            key={s.id}
            className="btn secondary"
            style={{ marginLeft: i * 12 }}
            aria-current={i === path.length - 1}
            onClick={() => onGo(s)}
          >
            {i === 0 ? world.emoji : '🌀'} {s.title}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
