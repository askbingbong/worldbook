import { useEffect, useRef, useState } from 'react'
import { sourcesOf } from '../../model/tags'
import type { Block } from '../../model/types'
import { describe, runButton, cfgOf } from '../../store/actions'
import { setContent, useStore } from '../../store/store'
import { useTagIndex } from '../hooks'
import { useWorld } from './ctx'

/* ---------- Button ---------- */
export function ButtonBody({ block }: { block: Block }) {
  const { snap } = useStore()
  const { enterSpace, openEdit } = useWorld()
  const set = !!cfgOf(block).action
  return (
    <div className="stack">
      <button
        className="btn primary big-btn"
        onClick={() => (set ? runButton(block, enterSpace) : openEdit(block))}
      >
        {String(block.content.label || block.title || 'Button')}
      </button>
      <p className="dim small">{describe(snap, block)}</p>
    </div>
  )
}

/* ---------- Toggle ---------- */
export function ToggleBody({ block }: { block: Block }) {
  const on = !!block.content.on
  const effect = String(block.content.effect ?? 'dim')
  return (
    <div className="stack">
      <button
        className={`switch${on ? ' on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={block.title || 'Switch'}
        onClick={() => setContent(block.id, { on: !on })}
      >
        <span className="knob" />
        <span className="switch-label">{on ? 'On' : 'Off'}</span>
      </button>
      <p className="dim small">
        {effect === 'none'
          ? 'Other blocks can read this switch (buttons can flip it).'
          : `When off, blocks sharing its tag are ${effect === 'hide' ? 'hidden' : 'dimmed'}.`}
      </p>
    </div>
  )
}

/* ---------- Random picker ---------- */
interface ListItem {
  text?: string
  title?: string
}
export function PickerBody({ block }: { block: Block }) {
  const idx = useTagIndex()
  const sources = sourcesOf(idx, block).filter(
    (l) => l.other.type === 'list' || l.other.type === 'playlist',
  )
  const fromTags: string[] = sources.flatMap((l) =>
    ((l.other.content.items as ListItem[]) ?? [])
      .map((i) => String(i.text ?? i.title ?? ''))
      .filter(Boolean),
  )
  const own = String(block.content.own ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  const pool = fromTags.length ? fromTags : own
  const result = String(block.content.result ?? '')
  const pick = () => {
    if (!pool.length) return
    const choices = pool.length > 1 ? pool.filter((x) => x !== result) : pool
    setContent(block.id, { result: choices[Math.floor(Math.random() * choices.length)] })
  }
  return (
    <div className="stack">
      <p className="picked-result" aria-live="polite">
        {result || <span className="dim">Nothing picked yet</span>}
      </p>
      <button className="btn primary" disabled={!pool.length} onClick={pick}>
        🎲 {result ? 'Pick again' : 'Pick one'}
      </button>
      <p className="dim small">
        {fromTags.length
          ? `Picking from ${sources.map((s) => s.other.title).join(', ')} (${fromTags.length} items).`
          : own.length
            ? `Picking from this block’s own list (${own.length} items).`
            : 'Tag this picker and a List with the same tag, or type your own items in ⋯ → Edit.'}
      </p>
    </div>
  )
}

/* ---------- Counter ---------- */
export function CounterBody({ block }: { block: Block }) {
  const v = Number(block.content.value ?? 0)
  const step = Number(block.content.step ?? 1) || 1
  return (
    <div className="counter">
      <button
        className="btn secondary icon big"
        aria-label={`Subtract ${step}`}
        onClick={() => setContent(block.id, { value: v - step })}
      >
        −
      </button>
      <output className="count-num" aria-live="polite">
        {v}
      </output>
      <button
        className="btn secondary icon big"
        aria-label={`Add ${step}`}
        onClick={() => setContent(block.id, { value: v + step })}
      >
        ＋
      </button>
      <button
        className="btn ghost"
        disabled={v === 0}
        onClick={() => setContent(block.id, { value: 0 })}
      >
        Reset
      </button>
    </div>
  )
}

/* ---------- Timer (countdown; running state is local and not saved) ---------- */
const pad = (n: number) => String(n).padStart(2, '0')
const mmss = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
export function TimerBody({ block }: { block: Block }) {
  const total = Number(block.content.seconds ?? 300)
  const [left, setLeft] = useState(total)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const end = useRef(0)
  useEffect(() => {
    if (!running) setLeft(total)
  }, [total, running])
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => {
      const r = Math.max(0, (end.current - Date.now()) / 1000)
      setLeft(r)
      if (r <= 0) {
        setRunning(false)
        setDone(true)
        try {
          navigator.vibrate?.([200, 100, 200])
        } catch {
          /* vibration is optional */
        }
      }
    }, 200)
    return () => window.clearInterval(t)
  }, [running])
  return (
    <div className="stack">
      <output className="count-num" aria-live="off">
        {mmss(Math.ceil(left))}
      </output>
      <p className="dim small" aria-live="polite">
        {done ? '⏰ Time’s up!' : running ? 'Counting down…' : 'Ready'}
      </p>
      {!running && !done && (
        <div className="row">
          <label className="grow">
            Minutes
            <input
              type="number"
              min={0}
              max={999}
              value={Math.floor(total / 60)}
              onChange={(e) =>
                setContent(block.id, {
                  seconds: Math.max(0, Number(e.target.value)) * 60 + (total % 60),
                })
              }
            />
          </label>
          <label className="grow">
            Seconds
            <input
              type="number"
              min={0}
              max={59}
              value={total % 60}
              onChange={(e) =>
                setContent(block.id, {
                  seconds:
                    Math.floor(total / 60) * 60 + Math.min(59, Math.max(0, Number(e.target.value))),
                })
              }
            />
          </label>
        </div>
      )}
      <div className="row">
        <button
          className="btn primary grow"
          disabled={total <= 0 && !running}
          onClick={() => {
            if (running) setRunning(false)
            else {
              end.current = Date.now() + (done ? total : left) * 1000
              setLeft(done ? total : left)
              setDone(false)
              setRunning(true)
            }
          }}
        >
          {running ? 'Pause' : done ? 'Restart' : left < total ? 'Resume' : 'Start'}
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            setRunning(false)
            setDone(false)
            setLeft(total)
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

/* ---------- Clock ---------- */
export function ClockBody({ block }: { block: Block }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const h24 = !!block.content.h24
  return (
    <div className="stack">
      <time className="count-num" dateTime={now.toISOString()}>
        {now.toLocaleTimeString([], { hour12: !h24 })}
      </time>
      <p className="dim small">
        {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
      <button className="btn ghost small" onClick={() => setContent(block.id, { h24: !h24 })}>
        {h24 ? 'Use 12-hour' : 'Use 24-hour'}
      </button>
    </div>
  )
}

/* ---------- Link card (no network preview: domain + your own description) ---------- */
export function LinkBody({ block }: { block: Block }) {
  const url = String(block.content.url ?? '')
  const [draft, setDraft] = useState('')
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    host = ''
  }
  if (!url || !host)
    return (
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          const u = /^https?:\/\//.test(draft.trim()) ? draft.trim() : `https://${draft.trim()}`
          if (draft.trim()) setContent(block.id, { url: u })
        }}
      >
        <input
          type="text"
          inputMode="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste a link"
          aria-label="Link URL"
        />
        <button className="btn secondary">Save</button>
      </form>
    )
  return (
    <a className="link-card" href={url} target="_blank" rel="noopener noreferrer">
      <span className="lc-icon" aria-hidden>
        {host[0]?.toUpperCase()}
      </span>
      <span className="lc-text">
        <strong>{block.title || host}</strong>
        <small className="dim">{String(block.content.desc || host)}</small>
      </span>
      <span aria-hidden>↗</span>
    </a>
  )
}
