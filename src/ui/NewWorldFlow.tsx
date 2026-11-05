import { useMemo, useRef, useState } from 'react'
import { PRESETS } from '../model/appearance'
import { DEFAULT_LOOK } from '../model/defaults'
import type { Custom, ID, Look } from '../model/types'
import { saveCustom, touchCustom } from '../store/appearance'
import { createFolder, createWorld, useStore } from '../store/store'
import LookEditor from './appearance/LookEditor'
import MiniWorld from './appearance/MiniWorld'
import { themeProps } from './appearance/theme'
import { go } from './router'

const EMOJI = [
  '🌍',
  '🥭',
  '🌙',
  '🔥',
  '🌊',
  '🌲',
  '🏰',
  '🚀',
  '🎧',
  '📚',
  '🎨',
  '🐉',
  '🍄',
  '❄️',
  '☀️',
  '🧪',
]
type LookMode = 'default' | 'preset' | 'custom' | 'random-custom'

const pickOther = <T extends { id?: string; name?: string }>(
  pool: T[],
  last: string | null,
  key: (t: T) => string,
): T => {
  const choices = pool.length > 1 ? pool.filter((p) => key(p) !== last) : pool
  return choices[Math.floor(Math.random() * choices.length)]
}

export default function NewWorldFlow() {
  const { snap } = useStore()
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🌍')
  const [folderId, setFolderId] = useState<string>('')
  const [newFolder, setNewFolder] = useState('')

  const [mode, setMode] = useState<LookMode>('default')
  const [look, setLook] = useState<Look>(DEFAULT_LOOK)
  const [customId, setCustomId] = useState<ID | null>(null)
  const lastPreset = useRef<string | null>(null)
  const lastCustom = useRef<string | null>(null)
  const [editing, setEditing] = useState(false)

  const customs = useMemo(() => [...snap.customs].sort((a, b) => a.order - b.order), [snap.customs])
  const pool = customs.filter((c) => c.includeInRandom)

  const selectCustom = (c: Custom) => {
    setCustomId(c.id)
    setLook(c.look)
  }
  const rollPreset = () => {
    const p = pickOther(PRESETS, lastPreset.current, (x) => x.name ?? '')
    lastPreset.current = p.name ?? null
    setLook(p)
    setCustomId(null)
  }
  const rollCustom = () => {
    if (!pool.length) return
    const c = pickOther(pool, lastCustom.current, (x) => x.id)
    lastCustom.current = c.id
    selectCustom(c)
  }
  const choose = (m: LookMode) => {
    setMode(m)
    if (m === 'default') {
      setLook(DEFAULT_LOOK)
      setCustomId(null)
    } else if (m === 'preset') rollPreset()
    else if (m === 'random-custom') {
      if (pool.length) rollCustom()
    } else {
      // Custom: keep a previously chosen custom, otherwise wait for a pick.
      if (!customId) {
        setLook(DEFAULT_LOOK)
      }
    }
  }

  const back = () => (step === 1 ? go('/') : setStep(step - 1))
  const create = () => {
    const w = createWorld({
      title,
      emoji,
      folderId: folderId || null,
      look,
      sourceCustomId:
        (mode === 'custom' || mode === 'random-custom') && customId ? customId : undefined,
    })
    if ((mode === 'custom' || mode === 'random-custom') && customId) touchCustom(customId)
    go(`/w/${w.id}`)
  }
  const addFolder = () => {
    const f = createFolder(newFolder)
    if (f) {
      setFolderId(f.id)
      setNewFolder('')
    }
  }
  const needsPick = mode === 'custom' && !customId
  const needsCustoms = mode === 'random-custom' && !pool.length

  if (editing)
    return (
      <LookEditor
        mode="custom-new"
        title="Create a custom look"
        initial={DEFAULT_LOOK}
        onCancel={() => setEditing(false)}
        onSaveNew={(name, l) => {
          const c = saveCustom(name, l)
          setMode('custom')
          selectCustom(c)
          setEditing(false)
        }}
      />
    )

  return (
    <main id="main" tabIndex={-1} className="page flow">
      <header className="flow-head">
        <button className="btn ghost" onClick={back}>
          ← {step === 1 ? 'Cancel' : 'Back'}
        </button>
        <span className="dim" aria-live="polite">
          Step {step} of 3
        </span>
      </header>

      {step === 1 && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            setStep(2)
          }}
        >
          <h1>Name your world</h1>
          <label>
            Name
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mango World"
            />
          </label>
          <fieldset>
            <legend>Icon</legend>
            <div className="emoji-grid">
              {EMOJI.map((e) => (
                <button
                  type="button"
                  key={e}
                  className={`emoji-btn${e === emoji ? ' on' : ''}`}
                  aria-pressed={e === emoji}
                  aria-label={`Icon ${e}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
            <label>
              Or type your own
              <input
                value={emoji}
                onChange={(e) => setEmoji([...e.target.value].slice(-2).join(''))}
              />
            </label>
          </fieldset>
          <label>
            Folder (optional)
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">No folder</option>
              {snap.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <input
              placeholder="New folder name"
              aria-label="New folder name"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
            />
            <button type="button" className="btn secondary" onClick={addFolder}>
              Add
            </button>
          </div>
          <button className="btn primary">Next</button>
        </form>
      )}

      {step === 2 && (
        <div className="stack">
          <h1>Choose a look</h1>
          <div role="radiogroup" aria-label="Look" className="stack">
            <button
              role="radio"
              aria-checked={mode === 'default'}
              className={`option${mode === 'default' ? ' on' : ''}`}
              onClick={() => choose('default')}
            >
              <strong>Default</strong>
              <span className="dim">Standard calm dark look.</span>
            </button>

            <button
              role="radio"
              aria-checked={mode === 'preset'}
              className={`option${mode === 'preset' ? ' on' : ''}`}
              onClick={() => choose('preset')}
            >
              <strong>Random preset</strong>
              <span className="dim">Cozy, neon, paper, space… we’ll pick one.</span>
            </button>
            {mode === 'preset' && (
              <div className="stack look-pick">
                <MiniWorld look={look} view="tiny" />
                <div className="row">
                  <strong className="grow">{look.name}</strong>
                  <button className="btn secondary" onClick={rollPreset}>
                    🎲 Reroll
                  </button>
                </div>
              </div>
            )}

            <button
              role="radio"
              aria-checked={mode === 'custom'}
              className={`option${mode === 'custom' ? ' on' : ''}`}
              onClick={() => choose('custom')}
            >
              <strong>Custom</strong>
              <span className="dim">Pick one of your saved looks, or make a new one.</span>
            </button>
            {mode === 'custom' && (
              <div className="stack look-pick">
                <button className="look-row create" onClick={() => setEditing(true)}>
                  <span className="plus">＋</span>
                  <span>Create new</span>
                </button>
                {customs.map((c) => (
                  <button
                    key={c.id}
                    className={`look-row${customId === c.id ? ' on' : ''}`}
                    aria-pressed={customId === c.id}
                    onClick={() => selectCustom(c)}
                  >
                    <MiniWorld look={c.look} view="tiny" />
                    <span>{c.name}</span>
                  </button>
                ))}
                {!customs.length && (
                  <p className="dim small">No saved looks yet. Tap “Create new”.</p>
                )}
              </div>
            )}

            <button
              role="radio"
              aria-checked={mode === 'random-custom'}
              className={`option${mode === 'random-custom' ? ' on' : ''}${!pool.length ? ' dimmed-option' : ''}`}
              onClick={() => choose('random-custom')}
            >
              <strong>Random custom</strong>
              <span className="dim">
                {pool.length
                  ? 'Roll one of your saved looks.'
                  : 'Make a custom look first, then I can roll one for you.'}
              </span>
            </button>
            {mode === 'random-custom' && needsCustoms && (
              <div className="stack look-pick">
                <p className="dim">Make a custom look first, then I can roll one for you.</p>
                <button className="btn secondary" onClick={() => setEditing(true)}>
                  ＋ Create new
                </button>
              </div>
            )}
            {mode === 'random-custom' && !needsCustoms && customId && (
              <div className="stack look-pick">
                <MiniWorld look={look} view="tiny" />
                <div className="row">
                  <strong className="grow">{look.name}</strong>
                  <button
                    className="btn secondary"
                    onClick={rollCustom}
                    disabled={pool.length < 2}
                    title={pool.length < 2 ? 'Only one custom is included in random' : undefined}
                  >
                    🎲 Reroll
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            className="btn primary"
            disabled={needsPick || needsCustoms}
            onClick={() => setStep(3)}
          >
            Next
          </button>
          {needsPick && <p className="dim small">Choose a custom look to continue.</p>}
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <h1>Ready?</h1>
          <div className="world-card preview themed" {...themeProps(look)}>
            <div className="world-card-main">
              <span className="emoji" aria-hidden>
                {emoji}
              </span>
              <span className="wc-title">{title.trim() || 'Untitled world'}</span>
              <span className="wc-sub">{look.name ?? 'Custom'} look</span>
            </div>
          </div>
          <MiniWorld look={look} view="world" />
          <button className="btn primary" onClick={create}>
            Create world
          </button>
        </div>
      )}
    </main>
  )
}
