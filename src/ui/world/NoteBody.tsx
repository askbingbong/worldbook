import { useEffect, useRef, useState } from 'react'
import type { Block } from '../../model/types'
import { setContent } from '../../store/store'
import { Markdown } from '../markdown'

export default function NoteBody({ block }: { block: Block }) {
  const saved = String(block.content.text ?? '')
  const [text, setText] = useState(saved)
  const [editing, setEditing] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<number>(undefined)

  // Pick up external changes (undo, duplicate) while not typing.
  useEffect(() => {
    if (!editing) setText(saved)
  }, [saved, editing])
  useEffect(() => {
    if (editing) ta.current?.focus()
  }, [editing])

  const commit = (t: string) => {
    window.clearTimeout(timer.current)
    if (t !== saved) setContent(block.id, { text: t })
  }
  const edit = (t: string) => {
    setText(t)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => commit(t), 500)
  }

  /** Wrap selection or insert a line prefix, then restore focus. */
  const apply = (kind: 'bold' | 'list' | 'check' | 'link') => {
    const el = ta.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    let next: string
    let caret: number
    if (kind === 'bold') {
      const sel = value.slice(a, b) || 'bold'
      next = value.slice(0, a) + `**${sel}**` + value.slice(b)
      caret = a + sel.length + 4
    } else if (kind === 'link') {
      const sel = value.slice(a, b) || 'link'
      next = value.slice(0, a) + `[${sel}](https://)` + value.slice(b)
      caret = a + sel.length + 10
    } else {
      const prefix = kind === 'list' ? '- ' : '- [ ] '
      const ls = value.lastIndexOf('\n', a - 1) + 1
      next = value.slice(0, ls) + prefix + value.slice(ls)
      caret = b + prefix.length
    }
    edit(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  const toggleLine = (i: number) => {
    const lines = text.split('\n')
    lines[i] = /\[ \]/.test(lines[i])
      ? lines[i].replace('[ ]', '[x]')
      : lines[i].replace(/\[[xX]\]/, '[ ]')
    const t = lines.join('\n')
    setText(t)
    commit(t)
  }

  if (!editing)
    return (
      <div
        className="note-view"
        role="button"
        tabIndex={0}
        aria-label="Edit note"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('a,button')) setEditing(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) setEditing(true)
        }}
      >
        {text.trim() ? (
          <Markdown text={text} onToggleLine={toggleLine} />
        ) : (
          <p className="dim">Tap to write…</p>
        )}
      </div>
    )

  return (
    <div className="note-edit">
      <div className="toolbar" onMouseDown={(e) => e.preventDefault()}>
        <button className="btn secondary" aria-label="Bold" onClick={() => apply('bold')}>
          <b>B</b>
        </button>
        <button className="btn secondary" aria-label="Bulleted list" onClick={() => apply('list')}>
          •
        </button>
        <button className="btn secondary" aria-label="Checklist" onClick={() => apply('check')}>
          ☑
        </button>
        <button className="btn secondary" aria-label="Link" onClick={() => apply('link')}>
          🔗
        </button>
        <button
          className="btn primary"
          onClick={() => {
            commit(text)
            setEditing(false)
          }}
        >
          Done
        </button>
      </div>
      <textarea
        ref={ta}
        value={text}
        aria-label="Note text"
        placeholder="Write something. **bold**, - lists, - [ ] checklists"
        onChange={(e) => edit(e.target.value)}
        onBlur={() => commit(text)}
      />
    </div>
  )
}
