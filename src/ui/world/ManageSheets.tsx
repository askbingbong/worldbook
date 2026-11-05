import { useMemo, useState } from 'react'
import { metaOf } from '../../model/blockTypes'
import {
  canMoveInto,
  childrenOf,
  deleteBlocks,
  duplicateBlocks,
  moveInto,
  moveStep,
  updateBlock,
  type Dest,
} from '../../model/ops'
import type { Block, ID, Space } from '../../model/types'
import { change, setBlock, setContent, showToast, useStore } from '../../store/store'
import Sheet from '../Sheet'
import ButtonConfig from './ButtonConfig'

/* ---------- ⋯ block menu ---------- */

export function BlockMenu({
  block: initial,
  onClose,
  onEdit,
  onMove,
  onTags,
  onConnections,
}: {
  block: Block
  onClose: () => void
  onEdit: () => void
  onMove: () => void
  onTags: () => void
  onConnections: () => void
}) {
  const { snap } = useStore()
  const block = snap.blocks.find((b) => b.id === initial.id) ?? initial
  const sibs = childrenOf(snap.blocks, block.spaceId, block.parentId)
  const i = sibs.findIndex((b) => b.id === block.id)
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const soon = (what: string, stage: number) =>
    run(() => showToast(`${what} arrives in Stage ${stage}.`))
  return (
    <Sheet
      title={`${metaOf(block.type).icon} ${block.title || metaOf(block.type).label}`}
      onClose={onClose}
    >
      <div className="stack">
        <button className="btn secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="btn secondary" onClick={onTags}>
          Tags
        </button>
        <button className="btn secondary" onClick={onConnections}>
          Connections
        </button>
        <div className="row">
          <button
            className="btn secondary grow"
            disabled={i <= 0}
            onClick={run(() => change((s) => moveStep(s, block.id, -1)))}
          >
            ↑ Move up
          </button>
          <button
            className="btn secondary grow"
            disabled={i < 0 || i >= sibs.length - 1}
            onClick={run(() => change((s) => moveStep(s, block.id, 1)))}
          >
            ↓ Move down
          </button>
        </div>
        <button className="btn secondary" onClick={onMove}>
          Move into…
        </button>
        <button
          className="btn secondary"
          onClick={run(() => change((s) => duplicateBlocks(s, [block.id]), 'Block duplicated.'))}
        >
          Duplicate
        </button>
        <button
          className="btn secondary"
          onClick={run(() => setBlock(block.id, { collapsed: !block.collapsed }))}
        >
          {block.collapsed ? 'Expand' : 'Collapse'}
        </button>
        <button
          className="btn secondary"
          onClick={run(() =>
            change(
              (st) => updateBlock(st, block.id, { hidden: !block.hidden }),
              block.hidden ? 'Block shown.' : 'Block hidden.',
            ),
          )}
        >
          {block.hidden ? 'Show' : 'Hide'}
        </button>
        <button className="btn secondary" onClick={soon('Block styling', 5)}>
          Style
        </button>
        <button
          className="btn danger"
          onClick={run(() => change((s) => deleteBlocks(s, [block.id]), 'Block deleted.'))}
        >
          Delete
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- Edit ---------- */

export function EditSheet({ block: initial, onClose }: { block: Block; onClose: () => void }) {
  const { snap } = useStore()
  const block = snap.blocks.find((b) => b.id === initial.id) ?? initial
  const [title, setTitle] = useState(block.title)
  const c = block.content
  const spaces = snap.spaces.filter((s) => s.worldId === block.worldId)
  const save = () => {
    if (title !== block.title) setBlock(block.id, { title })
    onClose()
  }
  return (
    <Sheet title={`Edit ${metaOf(block.type).label.toLowerCase()}`} onClose={save}>
      <div className="stack">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {block.type === 'note' && (
          <label>
            Text
            <textarea
              defaultValue={String(c.text ?? '')}
              rows={6}
              onBlur={(e) => setContent(block.id, { text: e.target.value })}
            />
          </label>
        )}
        {block.type === 'list' && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={c.checkable !== false}
              onChange={(e) => setContent(block.id, { checkable: e.target.checked })}
            />
            <span>Checkable items</span>
          </label>
        )}
        {block.type === 'frame' && (
          <label>
            Layout
            <select
              value={String(c.layout ?? 'stack')}
              onChange={(e) => setContent(block.id, { layout: e.target.value })}
            >
              {['stack', 'row', 'grid', 'tabs'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        )}
        {block.type === 'portal' && (
          <>
            <label>
              Style
              <select
                value={String(c.style ?? 'card')}
                onChange={(e) => setContent(block.id, { style: e.target.value })}
              >
                {['card', 'button', 'icon', 'banner'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Destination
              <select
                value={String(c.targetSpaceId ?? '')}
                onChange={(e) => setContent(block.id, { targetSpaceId: e.target.value })}
              >
                <option value="">— none —</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {block.type === 'button' && <ButtonConfig block={block} />}
        {block.type === 'toggle' && (
          <label>
            When switched off
            <select
              value={String(c.effect ?? 'dim')}
              onChange={(e) => setContent(block.id, { effect: e.target.value })}
            >
              <option value="dim">Dim blocks sharing its tag</option>
              <option value="hide">Hide blocks sharing its tag</option>
              <option value="none">Do nothing (just a switch)</option>
            </select>
          </label>
        )}
        {block.type === 'picker' && (
          <label>
            Own items (one per line, used when no tagged list is connected)
            <textarea
              rows={5}
              defaultValue={String(c.own ?? '')}
              onBlur={(e) => setContent(block.id, { own: e.target.value })}
            />
          </label>
        )}
        {block.type === 'counter' && (
          <label>
            Step
            <input
              type="number"
              min={1}
              defaultValue={Number(c.step ?? 1)}
              onBlur={(e) =>
                setContent(block.id, { step: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
        )}
        {block.type === 'link' && (
          <>
            <label>
              Link
              <input
                type="url"
                defaultValue={String(c.url ?? '')}
                onBlur={(e) => setContent(block.id, { url: e.target.value })}
              />
            </label>
            <label>
              Description
              <input
                defaultValue={String(c.desc ?? '')}
                onBlur={(e) => setContent(block.id, { desc: e.target.value })}
              />
            </label>
          </>
        )}
        {block.type === 'label' && (
          <label>
            Text
            <input
              defaultValue={String(c.text ?? '')}
              onBlur={(e) => setContent(block.id, { text: e.target.value })}
            />
          </label>
        )}
        {block.type === 'spacer' && (
          <label>
            Height ({String(c.height ?? 24)}px)
            <input
              type="range"
              min={8}
              max={160}
              step={4}
              value={Number(c.height ?? 24)}
              onChange={(e) => setContent(block.id, { height: Number(e.target.value) })}
            />
          </label>
        )}
        <button className="btn primary" onClick={save}>
          Done
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- Move into… ---------- */

interface Node {
  key: string
  label: string
  depth: number
  dest: Dest
  icon: string
}

export function MoveIntoSheet({
  ids,
  worldId,
  currentSpaceId,
  onClose,
  onMoved,
}: {
  ids: ID[]
  worldId: ID
  currentSpaceId: ID
  onClose: () => void
  onMoved: () => void
}) {
  const { snap } = useStore()
  const [dest, setDest] = useState<Dest | null>(null)

  const nodes = useMemo(() => {
    const out: Node[] = []
    const spaces = snap.spaces.filter((s) => s.worldId === worldId)
    const frames = (spaceId: ID, parentId: ID | null, depth: number) => {
      for (const b of childrenOf(snap.blocks, spaceId, parentId))
        if (b.type === 'frame') {
          out.push({
            key: b.id,
            label: b.title || 'Frame',
            depth,
            dest: { spaceId, parentId: b.id },
            icon: '🗂️',
          })
          frames(spaceId, b.id, depth + 1)
        }
    }
    const walk = (s: Space, depth: number) => {
      const isRoot = !s.parentSpaceId
      out.push({
        key: s.id,
        label: isRoot ? `${s.title} (world root)` : s.title,
        depth,
        dest: { spaceId: s.id, parentId: null },
        icon: isRoot ? '🌍' : '🌀',
      })
      frames(s.id, null, depth + 1)
      spaces.filter((x) => x.parentSpaceId === s.id).forEach((x) => walk(x, depth + 1))
    }
    spaces.filter((s) => !s.parentSpaceId).forEach((s) => walk(s, 0))
    return out
  }, [snap.spaces, snap.blocks, worldId])

  const same = (a: Dest | null, b: Dest) =>
    !!a && a.spaceId === b.spaceId && a.parentId === b.parentId
  return (
    <Sheet
      title={`Move ${ids.length > 1 ? `${ids.length} blocks` : 'block'} into…`}
      onClose={onClose}
      tall
    >
      <div className="move-tree" role="listbox" aria-label="Destinations">
        {nodes.map((n) => {
          const ok = canMoveInto(snap, ids, n.dest)
          return (
            <button
              key={n.key}
              role="option"
              aria-selected={same(dest, n.dest)}
              className={`move-row${same(dest, n.dest) ? ' on' : ''}`}
              style={{ paddingLeft: 12 + n.depth * 16 }}
              disabled={!ok}
              onClick={() => setDest(n.dest)}
            >
              <span aria-hidden>{n.icon}</span> {n.label}
              {n.dest.spaceId === currentSpaceId && !n.dest.parentId && (
                <small className="dim"> · here</small>
              )}
            </button>
          )
        })}
      </div>
      <div className="sheet-foot">
        <button
          className="btn primary"
          disabled={!dest}
          onClick={() => {
            if (!dest) return
            change((s) => moveInto(s, ids, dest), 'Moved.')
            onMoved()
          }}
        >
          Move here
        </button>
      </div>
    </Sheet>
  )
}
