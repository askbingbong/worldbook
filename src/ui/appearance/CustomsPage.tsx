import { useMemo, useState } from 'react'
import { DEFAULT_LOOK } from '../../model/defaults'
import type { Custom } from '../../model/types'
import {
  deleteCustom,
  duplicateCustom,
  moveCustom,
  renameCustom,
  saveCustom,
  setIncludeInRandom,
  updateCustom,
} from '../../store/appearance'
import { useStore } from '../../store/store'
import Sheet from '../Sheet'
import { go } from '../router'
import { ago } from '../WorldCard'
import LookEditor from './LookEditor'
import MiniWorld from './MiniWorld'

type Sort = 'manual' | 'recent' | 'name' | 'used'

/** Library ⋯ → My Customs: rename, duplicate, delete, reorder, include-in-random, sort. */
export default function CustomsPage() {
  const { snap } = useStore()
  const [sort, setSort] = useState<Sort>('manual')
  const [editing, setEditing] = useState<Custom | 'new' | null>(null)
  const [renaming, setRenaming] = useState<Custom | null>(null)
  const [name, setName] = useState('')

  const list = useMemo(() => {
    const l = [...snap.customs]
    if (sort === 'manual') l.sort((a, b) => a.order - b.order)
    if (sort === 'recent') l.sort((a, b) => b.lastUsed - a.lastUsed)
    if (sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'used') l.sort((a, b) => b.uses - a.uses)
    return l
  }, [snap.customs, sort])

  if (editing) {
    const c = editing === 'new' ? null : (snap.customs.find((x) => x.id === editing.id) ?? editing)
    return (
      <LookEditor
        mode={c ? 'custom-edit' : 'custom-new'}
        title={c ? `Edit “${c.name}”` : 'Create a custom look'}
        initial={c ? c.look : DEFAULT_LOOK}
        customName={c?.name}
        onCancel={() => setEditing(null)}
        onSaveNew={(n, look) => {
          saveCustom(n, look)
          setEditing(null)
        }}
        onUpdateCustom={
          c
            ? (look) => {
                updateCustom(c.id, look)
                setEditing(null)
              }
            : undefined
        }
      />
    )
  }

  return (
    <div className="page">
      <header className="flow-head">
        <button className="btn ghost" onClick={() => go('/')}>
          ← Library
        </button>
        <button className="btn primary" onClick={() => setEditing('new')}>
          ＋ New look
        </button>
      </header>
      <h1>My Customs</h1>
      <p className="dim">
        Saved looks you can reuse. Worlds keep their own copy, so editing a custom never changes a
        world.
      </p>
      <label>
        Sort
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="manual">My order</option>
          <option value="recent">Recently used</option>
          <option value="name">Name</option>
          <option value="used">Most used</option>
        </select>
      </label>
      {!list.length && (
        <div className="empty">
          <p>No custom looks yet. Make one, then use it for any world.</p>
        </div>
      )}
      <ul className="custom-list">
        {list.map((c, i) => (
          <li key={c.id} className="custom-item">
            <MiniWorld look={c.look} view="tiny" />
            <div className="custom-meta">
              <strong>{c.name}</strong>
              <small className="dim">
                Used {c.uses}× · last {ago(c.lastUsed)}
              </small>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={c.includeInRandom}
                  onChange={(e) => setIncludeInRandom(c.id, e.target.checked)}
                />
                <span>Include in random</span>
              </label>
              <div className="row wrap">
                <button className="btn secondary small" onClick={() => setEditing(c)}>
                  Edit
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => {
                    setName(c.name)
                    setRenaming(c)
                  }}
                >
                  Rename
                </button>
                <button className="btn secondary small" onClick={() => duplicateCustom(c.id)}>
                  Duplicate
                </button>
                <button className="btn danger small" onClick={() => deleteCustom(c.id)}>
                  Delete
                </button>
                {sort === 'manual' && (
                  <>
                    <button
                      className="btn ghost icon"
                      aria-label={`Move ${c.name} up`}
                      disabled={i === 0}
                      onClick={() => moveCustom(c.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="btn ghost icon"
                      aria-label={`Move ${c.name} down`}
                      disabled={i === list.length - 1}
                      onClick={() => moveCustom(c.id, 1)}
                    >
                      ↓
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {sort !== 'manual' && list.length > 1 && (
        <p className="dim small">Switch to “My order” to reorder with the arrows.</p>
      )}
      {renaming && (
        <Sheet title="Rename look" onClose={() => setRenaming(null)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              renameCustom(renaming.id, name)
              setRenaming(null)
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Look name"
            />
            <button className="btn primary">Save</button>
          </form>
        </Sheet>
      )}
    </div>
  )
}
