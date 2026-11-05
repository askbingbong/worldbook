import { useMemo, useState } from 'react'
import { BLOCK_TYPES, GROUPS, metaOf } from '../../model/blockTypes'
import { addBlock, createSubspace } from '../../model/ops'
import type { Block, BlockType, ID, Space } from '../../model/types'
import { change, useStore } from '../../store/store'
import Sheet from '../Sheet'

const RECENT_KEY = 'wb.recentTypes'
function readRecent(): BlockType[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}
export function rememberType(t: BlockType) {
  try {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([t, ...readRecent().filter((x) => x !== t)].slice(0, 5)),
    )
  } catch {
    /* storage unavailable: recents are a convenience only */
  }
}

export function BlockPicker({
  onPick,
  onClose,
}: {
  onPick: (t: BlockType) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const recent = useMemo(readRecent, [])
  const match = (t: (typeof BLOCK_TYPES)[number]) =>
    t.label.toLowerCase().includes(q.trim().toLowerCase())
  const tile = (t: (typeof BLOCK_TYPES)[number]) => (
    <button key={t.type} className="tile" disabled={!t.ready} onClick={() => onPick(t.type)}>
      <span className="tile-icon" aria-hidden>
        {t.icon}
      </span>
      <span>{t.label}</span>
      {!t.ready && <small className="dim">Soon</small>}
    </button>
  )
  return (
    <Sheet title="Add a block" onClose={onClose} tall>
      <div className="stack">
        <input
          type="search"
          autoFocus
          placeholder="Search block types"
          aria-label="Search block types"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!q && recent.length > 0 && (
          <section>
            <h3 className="section">Recently used</h3>
            <div className="tiles">{recent.map((r) => tile(metaOf(r)))}</div>
          </section>
        )}
        {GROUPS.map((g) => {
          const list = BLOCK_TYPES.filter((t) => t.group === g && match(t))
          return list.length ? (
            <section key={g}>
              <h3 className="section">{g}</h3>
              <div className="tiles">{list.map(tile)}</div>
            </section>
          ) : null
        })}
      </div>
    </Sheet>
  )
}

export interface InsertTarget {
  parentId: ID | null
  afterId: ID | null
}

/** Portal setup: new subspace / link existing / two-way (auto-creates a return portal). */
export function PortalSetup({
  space,
  target,
  onClose,
  onDone,
}: {
  space: Space
  target: InsertTarget
  onClose: () => void
  onDone: (b: Block) => void
}) {
  const { snap } = useStore()
  const others = snap.spaces.filter((s) => s.worldId === space.worldId && s.id !== space.id)
  const [mode, setMode] = useState<'new' | 'link'>('new')
  const [name, setName] = useState('')
  const [linkId, setLinkId] = useState(others[0]?.id ?? '')
  const [twoWay, setTwoWay] = useState(true)
  const [style, setStyle] = useState('card')
  const canCreate = mode === 'new' || !!linkId

  const create = () => {
    let created: Block | null = null
    change((s) => {
      let cur = s
      let destId = linkId
      let destTitle = others.find((o) => o.id === linkId)?.title ?? ''
      if (mode === 'new') {
        const made = createSubspace(cur, space.id, name.trim() || 'New space')
        cur = made.snap
        destId = made.space.id
        destTitle = made.space.title
      }
      const added = addBlock(cur, space.id, 'portal', {
        ...target,
        title: destTitle,
        content: { style, targetSpaceId: destId, twoWay },
      })
      cur = added.snap
      created = added.block
      if (twoWay)
        cur = addBlock(cur, destId, 'portal', {
          title: `Back to ${space.title}`,
          content: { style: 'button', targetSpaceId: space.id, twoWay: true },
        }).snap
      return cur
    }, 'Portal added.')
    if (created) onDone(created)
  }

  return (
    <Sheet title="New portal" onClose={onClose}>
      <div className="stack">
        <div className="seg" role="group" aria-label="Destination">
          <button
            className={mode === 'new' ? 'on' : ''}
            aria-pressed={mode === 'new'}
            onClick={() => setMode('new')}
          >
            New subspace
          </button>
          <button
            className={mode === 'link' ? 'on' : ''}
            aria-pressed={mode === 'link'}
            onClick={() => setMode('link')}
            disabled={!others.length}
          >
            Link existing
          </button>
        </div>
        {mode === 'new' ? (
          <label>
            Subspace name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beach"
            />
          </label>
        ) : (
          <label>
            Link to
            <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Style
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            {['card', 'button', 'icon', 'banner'].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={twoWay} onChange={(e) => setTwoWay(e.target.checked)} />
          <span>Two-way: also add a return portal on the other side</span>
        </label>
        <button className="btn primary" disabled={!canCreate} onClick={create}>
          Create portal
        </button>
      </div>
    </Sheet>
  )
}
