import { useState } from 'react'
import { DEFAULT_LOOK, lookVars } from '../model/defaults'
import { createFolder, createWorld, useStore } from '../store/store'
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

export default function NewWorldFlow() {
  const { snap } = useStore()
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🌍')
  const [folderId, setFolderId] = useState<string>('')
  const [newFolder, setNewFolder] = useState('')

  const look = DEFAULT_LOOK // Stage 5 adds preset/custom/random choices
  const back = () => (step === 1 ? go('/') : setStep(step - 1))

  const create = () => {
    const w = createWorld({ title, emoji, folderId: folderId || null, look })
    go(`/w/${w.id}`)
  }
  const addFolder = () => {
    const f = createFolder(newFolder)
    if (f) {
      setFolderId(f.id)
      setNewFolder('')
    }
  }

  return (
    <div className="page flow">
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
          <button className="option on" aria-pressed="true">
            <strong>Default</strong>
            <span className="dim">Standard calm dark look.</span>
          </button>
          {['Random preset', 'Custom', 'Random custom'].map((n) => (
            <button key={n} className="option" disabled>
              <strong>{n}</strong>
              <span className="dim">Arrives with the Appearance system.</span>
            </button>
          ))}
          <button className="btn primary" onClick={() => setStep(3)}>
            Next
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <h1>Ready?</h1>
          <div className="world-card preview" style={lookVars(look) as React.CSSProperties}>
            <div className="world-card-main">
              <span className="emoji" aria-hidden>
                {emoji}
              </span>
              <span className="wc-title">{title.trim() || 'Untitled world'}</span>
              <span className="wc-sub">{look.name} look</span>
            </div>
          </div>
          <button className="btn primary" onClick={create}>
            Create world
          </button>
        </div>
      )}
    </div>
  )
}
