import { useMemo, useState } from 'react'
import { metaOf } from '../../model/blockTypes'
import {
  addTags,
  blocksWithTag,
  deleteTag,
  DIR_GLYPH,
  DIR_WORD,
  explain,
  isGlobal,
  nextDir,
  normTag,
  PALETTE,
  removeTag,
  renameTag,
  setTagColor,
  setTagDir,
  summaries,
  tagColor,
  tagLabel,
} from '../../model/tags'
import type { Block, ID, TagRef } from '../../model/types'
import { change, showToast, useStore } from '../../store/store'
import { useLongPress } from '../useLongPress'
import { useTagIndex } from '../hooks'
import Sheet from '../Sheet'

/** A tag chip. Color is decoration only: the name and a direction glyph carry the meaning. */
export function TagChip({
  tag,
  active,
  onTap,
  onLong,
}: {
  tag: TagRef
  active?: boolean
  onTap?: () => void
  onLong?: () => void
}) {
  const { snap } = useStore()
  const color = tagColor(snap, tag.name)
  const press = useLongPress(
    () => onTap?.(),
    () => onLong?.(),
    { pressIgnores: '' },
  )
  return (
    <button
      className={`tag-chip${active ? ' on' : ''}`}
      style={{ ['--tag' as string]: color }}
      aria-pressed={active}
      aria-label={`Tag ${tagLabel(tag.name)}, ${DIR_WORD[tag.dir]}${isGlobal(tag.name) ? ', global' : ''}. Tap to highlight, hold to edit.`}
      {...press}
    >
      <i aria-hidden />
      {tagLabel(tag.name)}
      <b aria-hidden>{DIR_GLYPH[tag.dir]}</b>
    </button>
  )
}

/** Tag adding sheet: text field + suggestions; direction cycles on tap; ✕ removes. */
export function TagsSheet({ blockIds, onClose }: { blockIds: ID[]; onClose: () => void }) {
  const { snap } = useStore()
  const [q, setQ] = useState('')
  const blocks = blockIds
    .map((id) => snap.blocks.find((b) => b.id === id))
    .filter((b): b is Block => !!b)
  const single = blocks.length === 1 ? blocks[0] : null
  const world = blocks[0]?.worldId
  const have = new Set(single ? single.tags.map((t) => t.name) : [])
  const suggestions = useMemo(() => {
    const names = new Set<string>()
    for (const b of snap.blocks)
      for (const t of b.tags) if (isGlobal(t.name) || b.worldId === world) names.add(t.name)
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return [...names]
      .filter((n) => !have.has(n) && (!needle || n.includes(needle)))
      .sort()
      .slice(0, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.blocks, q, world, single?.tags])

  const add = (name: string) => {
    const n = normTag(name)
    if (!n) return
    change((s) => addTags(s, blockIds, [n]), `${tagLabel(n)} added.`)
    setQ('')
  }
  return (
    <Sheet
      title={single ? `Tags for ${single.title}` : `Tag ${blocks.length} blocks`}
      onClose={onClose}
    >
      <div className="stack">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            add(q)
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a tag, e.g. mango"
            aria-label="Tag name"
          />
          <button className="btn primary" disabled={!normTag(q)}>
            Add
          </button>
        </form>
        <p className="dim small">
          Same tag = connected. Start with @ (like @mango) to connect across worlds.
        </p>
        {single && single.tags.length > 0 && (
          <div className="tag-list">
            {single.tags.map((t) => (
              <div className="tag-row" key={t.name}>
                <span
                  className="tag-chip static"
                  style={{ ['--tag' as string]: tagColor(snap, t.name) }}
                >
                  <i aria-hidden />
                  {tagLabel(t.name)}
                </span>
                <button
                  className="btn secondary"
                  aria-label={`Direction for ${tagLabel(t.name)}: ${DIR_WORD[t.dir]}. Tap to change.`}
                  onClick={() => change((s) => setTagDir(s, single.id, t.name, nextDir(t.dir)))}
                >
                  {DIR_GLYPH[t.dir]} {DIR_WORD[t.dir]}
                </button>
                <button
                  className="btn ghost icon"
                  aria-label={`Remove ${tagLabel(t.name)}`}
                  onClick={() => change((s) => removeTag(s, single.id, t.name), 'Tag removed.')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {suggestions.length > 0 && (
          <section>
            <h3 className="section">Suggestions</h3>
            <div className="chips-wrap">
              {suggestions.map((n) => (
                <button key={n} className="chip" onClick={() => add(n)}>
                  <span className="dot" style={{ background: tagColor(snap, n) }} aria-hidden />{' '}
                  {tagLabel(n)}
                </button>
              ))}
            </div>
          </section>
        )}
        <button className="btn secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  )
}

/** Plain-language connections for one block. Used in the sheet and the desktop inspector. */
export function InspectorBody({ block, onTags }: { block: Block; onTags?: () => void }) {
  const idx = useTagIndex()
  const { lines, warnings } = explain(idx, block)
  return (
    <div className="stack">
      {!block.tags.length && (
        <p className="dim">This block is standalone. Add a tag to connect it with other blocks.</p>
      )}
      {lines.map((l, i) => (
        <p key={i} className="insp-line">
          🔗 {l}
        </p>
      ))}
      {warnings.map((w, i) => (
        <p key={i} className="insp-warn">
          ⚠ {w}
        </p>
      ))}
      {onTags && (
        <button className="btn secondary" onClick={onTags}>
          Edit tags
        </button>
      )}
    </div>
  )
}
export function InspectorSheet({
  block,
  onTags,
  onClose,
}: {
  block: Block
  onTags: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={`Connections · ${block.title}`} onClose={onClose}>
      <InspectorBody block={block} onTags={onTags} />
    </Sheet>
  )
}

/** Tag Manager: all tags with color, count, scope; detail with jump, rename, merge, recolor, delete. */
export function TagManager({
  worldId,
  onJump,
  onClose,
}: {
  worldId: ID
  onJump: (b: Block) => void
  onClose: () => void
}) {
  const { snap } = useStore()
  const list = summaries(snap, worldId)
  const [sel, setSel] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'rename' | 'merge'>('view')
  const [name, setName] = useState('')
  const cur = list.find((t) => t.key === sel)

  if (cur) {
    const blocks = blocksWithTag(snap, worldId, cur.name)
    const worlds = [...new Set(blocks.map((b) => b.worldId))]
    const color = tagColor(snap, cur.name)
    return (
      <Sheet title={tagLabel(cur.name)} onClose={onClose} tall>
        <div className="stack">
          <button
            className="btn ghost"
            onClick={() => {
              setSel(null)
              setMode('view')
            }}
          >
            ← All tags
          </button>
          <p className="dim">
            <span className="badge">{cur.global ? 'Global' : 'This world'}</span> {cur.count} block
            {cur.count === 1 ? '' : 's'}
          </p>
          {mode === 'rename' && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                const n = normTag(name)
                if (!n) return
                change((s) => renameTag(s, worldId, cur.name, n), 'Tag renamed.')
                setSel(null)
                setMode('view')
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="New tag name"
              />
              <button className="btn primary">Rename</button>
            </form>
          )}
          {mode === 'merge' && (
            <div className="stack">
              <p className="dim">Merge {tagLabel(cur.name)} into:</p>
              {list
                .filter((t) => t.key !== cur.key)
                .map((t) => (
                  <button
                    key={t.key}
                    className="btn secondary"
                    onClick={() => {
                      change(
                        (s) => renameTag(s, worldId, cur.name, t.name),
                        `Merged into ${tagLabel(t.name)}.`,
                      )
                      setSel(null)
                      setMode('view')
                    }}
                  >
                    {tagLabel(t.name)}
                  </button>
                ))}
              {list.length < 2 && <p className="dim">No other tags to merge with.</p>}
            </div>
          )}
          {mode === 'view' && (
            <>
              <div className="row wrap">
                <button
                  className="btn secondary"
                  onClick={() => {
                    setName(cur.name)
                    setMode('rename')
                  }}
                >
                  Rename
                </button>
                <button className="btn secondary" onClick={() => setMode('merge')}>
                  Merge…
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    change((s) => deleteTag(s, worldId, cur.name), 'Tag removed from blocks.')
                    setSel(null)
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="swatches" role="group" aria-label="Tag color">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    className={`swatch${c === color ? ' on' : ''}`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                    aria-pressed={c === color}
                    onClick={() => change((s) => setTagColor(s, cur.name, c))}
                  />
                ))}
              </div>
              <p className="dim small">Delete only removes the tag from blocks. The blocks stay.</p>
              {worlds.map((w) => {
                const world = snap.worlds.find((x) => x.id === w)
                return (
                  <section key={w}>
                    <h3 className="section">
                      {world ? `${world.emoji} ${world.title}` : 'Unknown world'}
                    </h3>
                    {blocks
                      .filter((b) => b.worldId === w)
                      .map((b) => (
                        <button
                          key={b.id}
                          className="btn secondary result"
                          onClick={() => onJump(b)}
                        >
                          <span aria-hidden>{metaOf(b.type).icon}</span>{' '}
                          {b.title || metaOf(b.type).label}
                          <small className="dim">
                            {' '}
                            · {snap.spaces.find((x) => x.id === b.spaceId)?.title}
                          </small>
                        </button>
                      ))}
                  </section>
                )
              })}
            </>
          )}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Tags" onClose={onClose} tall>
      <div className="stack">
        {!list.length && (
          <p className="dim">No tags yet. Open a block’s ⋯ menu → Tags to add one.</p>
        )}
        {list.map((t) => (
          <button key={t.key} className="btn secondary tag-line" onClick={() => setSel(t.key)}>
            <span className="dot" style={{ background: tagColor(snap, t.name) }} aria-hidden />
            <span className="grow-text">{tagLabel(t.name)}</span>
            <span className="badge">{t.global ? 'Global' : 'Local'}</span>
            <span className="dim">{t.count}</span>
          </button>
        ))}
        <button
          className="btn ghost"
          onClick={() => showToast('Tip: prefix a tag with @ to link blocks across worlds.')}
        >
          What are global tags?
        </button>
      </div>
    </Sheet>
  )
}
