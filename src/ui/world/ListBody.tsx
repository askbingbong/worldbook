import { useRef, useState } from 'react'
import { uid } from '../../model/defaults'
import type { Block } from '../../model/types'
import { change, setContent } from '../../store/store'
import { updateBlock } from '../../model/ops'

interface Item {
  id: string
  text: string
  checked: boolean
}

/** Touch swipe: left = delete, right = check. Buttons always offer the same actions. */
function SwipeRow({
  children,
  onLeft,
  onRight,
  enabled,
}: {
  children: React.ReactNode
  onLeft: () => void
  onRight: () => void
  enabled: boolean
}) {
  const el = useRef<HTMLDivElement>(null)
  const x0 = useRef<number | null>(null)
  const dx = useRef(0)
  const move = (v: number) => {
    dx.current = v
    if (el.current) el.current.style.transform = v ? `translateX(${v}px)` : ''
  }
  return (
    <div
      ref={el}
      className="swipe-row"
      onPointerDown={(e) => {
        if (enabled && e.pointerType !== 'mouse' && !(e.target as HTMLElement).closest('input'))
          x0.current = e.clientX
      }}
      onPointerMove={(e) => {
        if (x0.current !== null) move(Math.max(-120, Math.min(120, e.clientX - x0.current)))
      }}
      onPointerUp={() => {
        if (x0.current === null) return
        const v = dx.current
        x0.current = null
        move(0)
        if (v <= -70) onLeft()
        else if (v >= 70) onRight()
      }}
      onPointerCancel={() => {
        x0.current = null
        move(0)
      }}
    >
      {children}
    </div>
  )
}

export default function ListBody({ block }: { block: Block }) {
  const items = (block.content.items as Item[]) ?? []
  const checkable = block.content.checkable !== false
  const [reorder, setReorder] = useState(false)
  const [draft, setDraft] = useState('')

  const save = (next: Item[]) => setContent(block.id, { items: next })
  const patch = (id: string, p: Partial<Item>) =>
    save(items.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const remove = (id: string) =>
    change(
      (s) =>
        updateBlock(s, block.id, {
          content: { ...block.content, items: items.filter((i) => i.id !== id) },
        }),
      'Item deleted.',
    )
  const step = (i: number, d: -1 | 1) => {
    const next = [...items]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    save(next)
  }
  const add = () => {
    if (!draft.trim()) return
    save([...items, { id: uid(), text: draft.trim(), checked: false }])
    setDraft('')
  }

  return (
    <div className="list-body">
      {items.length > 1 && (
        <button
          className="btn ghost small"
          onClick={() => setReorder(!reorder)}
          aria-pressed={reorder}
        >
          {reorder ? 'Done reordering' : '↕ Reorder'}
        </button>
      )}
      <ul>
        {items.map((it, i) => (
          <li key={it.id}>
            <SwipeRow
              enabled={!reorder}
              onLeft={() => remove(it.id)}
              onRight={() => checkable && patch(it.id, { checked: !it.checked })}
            >
              {checkable && (
                <button
                  className="btn ghost icon"
                  role="checkbox"
                  aria-checked={it.checked}
                  aria-label={`Check ${it.text}`}
                  onClick={() => patch(it.id, { checked: !it.checked })}
                >
                  {it.checked ? '☑' : '☐'}
                </button>
              )}
              <input
                className={it.checked ? 'done' : ''}
                defaultValue={it.text}
                key={it.text}
                aria-label={`Item ${i + 1}`}
                onBlur={(e) => e.target.value !== it.text && patch(it.id, { text: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              {reorder ? (
                <>
                  <button
                    className="btn ghost icon"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => step(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="btn ghost icon"
                    aria-label="Move down"
                    disabled={i === items.length - 1}
                    onClick={() => step(i, 1)}
                  >
                    ↓
                  </button>
                </>
              ) : (
                <button
                  className="btn ghost icon"
                  aria-label={`Delete ${it.text}`}
                  onClick={() => remove(it.id)}
                >
                  ✕
                </button>
              )}
            </SwipeRow>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          placeholder="Add an item"
          aria-label="New item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn secondary">Add</button>
      </form>
    </div>
  )
}
