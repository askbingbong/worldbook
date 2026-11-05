import { useMemo, useState } from 'react'
import {
  applyPatch,
  contrastIssues,
  DARK_BASE,
  fixContrast,
  LIGHT_BASE,
  PRESETS,
  RADIUS_STOPS,
  randomizeAll,
  randomizeKey,
  stopName,
  type SettingKey,
} from '../../model/appearance'
import { metaOf, BLOCK_TYPES, GROUPS } from '../../model/blockTypes'
import { DEFAULT_LOOK, lookVars } from '../../model/defaults'
import type { BlockPatch, Look, Patch } from '../../model/types'
import { useStore } from '../../store/store'
import Sheet from '../Sheet'
import { BackdropFields, ColorField, FontSelect, Seg } from './controls'
import MiniWorld from './MiniWorld'
import PatchEditor from './PatchEditor'

export type EditorMode = 'world' | 'space' | 'custom-new' | 'custom-edit'
const TABS = ['Colors', 'Font', 'Shape', 'Background', 'Motion', 'Adv'] as const
type Tab = (typeof TABS)[number]

export interface EditorProps {
  mode: EditorMode
  title: string
  /** starting effective look (world look / custom look / space effective look) */
  initial: Look
  /** space mode: what this space inherits */
  parent?: Look
  parentName?: string
  initialPatch?: Patch
  /** the custom this look came from (world/space) or is (custom-edit) */
  customName?: string
  onCancel: () => void
  /** world/space: "Done (this world only)" */
  onDone?: (r: { look: Look; patch: Patch }) => void
  /** Save to Custom / Save as new / custom-new Save. Returns nothing; caller handles selection. */
  onSaveNew: (name: string, look: Look, patch: Patch) => void
  /** custom-edit "Save changes", or world/space "Update “name”" */
  onUpdateCustom?: (look: Look, patch: Patch) => void
  onApplyAll?: (patch: Patch) => void
}

const LOOK_KEYS: (keyof Look)[] = [
  'base',
  'accent',
  'bg',
  'surface',
  'surface2',
  'line',
  'text',
  'textDim',
  'radius',
  'border',
  'shadow',
  'density',
  'iconStyle',
  'fontTitle',
  'fontBody',
  'fontScale',
  'titleWeight',
  'motion',
  'header',
]
/** Keep only what differs from the inherited look. */
function diffPatch(parent: Look, next: Look): Patch {
  const out: Patch = {}
  for (const k of LOOK_KEYS)
    if (next[k] !== parent[k]) (out as Record<string, unknown>)[k] = next[k]
  const bd: Partial<Look['backdrop']> = {}
  for (const k of Object.keys(next.backdrop) as (keyof Look['backdrop'])[])
    if (next.backdrop[k] !== parent.backdrop[k])
      (bd as Record<string, unknown>)[k] = next.backdrop[k]
  if (Object.keys(bd).length) out.backdrop = bd
  if (JSON.stringify(next.rules ?? {}) !== JSON.stringify(parent.rules ?? {}))
    out.rules = next.rules ?? {}
  return out
}

const FAMILY_KEYS = GROUPS.map((g) => ({ key: `family:${g}`, label: `${g} family` }))
const TYPE_KEYS = BLOCK_TYPES.map((t) => ({ key: `type:${t.type}`, label: `${t.icon} ${t.label}` }))

/** A labelled setting: inherited/custom badge, dice and lock. Top-level so controls keep focus between renders. */
function SettingRow({
  k,
  label,
  children,
  isSpace,
  isCustom,
  locked,
  onReset,
  onCustomize,
  onDice,
  onLock,
}: {
  k: SettingKey
  label: string
  children: React.ReactNode
  isSpace: boolean
  isCustom: boolean
  locked: boolean
  onReset: () => void
  onCustomize: () => void
  onDice: () => void
  onLock: () => void
}) {
  return (
    <div className="setting">
      <div className="setting-head">
        <span className="setting-label">{label}</span>
        {isSpace &&
          (isCustom ? (
            <button
              className="badge on"
              onClick={onReset}
              aria-label={`${label}: custom. Reset to inherited.`}
            >
              • Custom ✕
            </button>
          ) : (
            <button
              className="badge"
              onClick={onCustomize}
              aria-label={`${label}: inherited. Customize for this space.`}
            >
              ↑ Inherited
            </button>
          ))}
        <button
          className="btn ghost icon sm"
          aria-label={`Randomize ${label}`}
          disabled={locked}
          onClick={onDice}
        >
          🎲
        </button>
        <button
          className="btn ghost icon sm"
          aria-label={`${locked ? 'Unlock' : 'Lock'} ${label}`}
          aria-pressed={locked}
          onClick={onLock}
        >
          {locked ? '🔒' : '🔓'}
        </button>
      </div>
      <div data-setting={k}>{children}</div>
    </div>
  )
}

export default function LookEditor(p: EditorProps) {
  const { snap } = useStore()
  const isSpace = p.mode === 'space'
  const [look, setLook] = useState<Look>(p.initial)
  const [patch, setPatch] = useState<Patch>(p.initialPatch ?? {})
  const eff = useMemo(
    () => (isSpace ? applyPatch(p.parent!, patch) : look),
    [isSpace, p.parent, patch, look],
  )
  const [tab, setTab] = useState<Tab>('Colors')
  const [view, setView] = useState<'world' | 'card'>('world')
  const [locked, setLocked] = useState<Set<string>>(new Set())
  const [sheet, setSheet] = useState<null | 'name' | 'load' | 'more'>(null)
  const [name, setName] = useState('')
  const [advMode, setAdvMode] = useState<'family' | 'type'>('family')
  const [advKey, setAdvKey] = useState(FAMILY_KEYS[0].key)

  const apply = (next: Look) => (isSpace ? setPatch(diffPatch(p.parent!, next)) : setLook(next))
  const set = <K extends keyof Look>(k: K, v: Look[K]) =>
    isSpace ? setPatch((x) => ({ ...x, [k]: v })) : setLook((x) => ({ ...x, [k]: v }))
  const setBackdrop = (part: Partial<Look['backdrop']>) =>
    isSpace
      ? setPatch((x) => ({ ...x, backdrop: { ...(x.backdrop ?? {}), ...part } }))
      : setLook((x) => ({ ...x, backdrop: { ...x.backdrop, ...part } }))

  const custom = (k: keyof Look | 'backdrop') =>
    isSpace && (k === 'backdrop' ? Object.keys(patch.backdrop ?? {}).length > 0 : k in patch)
  const resetKey = (k: keyof Look | 'backdrop') =>
    setPatch((x) => {
      const n = { ...x }
      delete n[k as keyof Patch]
      return n
    })
  const customize = (k: keyof Look | 'backdrop') =>
    setPatch((x) =>
      k === 'backdrop'
        ? { ...x, backdrop: { ...eff.backdrop } }
        : { ...x, [k]: eff[k as keyof Look] },
    )

  const issues = contrastIssues(eff)
  const toggleLock = (k: string) =>
    setLocked((s) => {
      const n = new Set(s)
      if (!n.delete(k)) n.add(k)
      return n
    })
  const dice = (k: SettingKey) => apply(fixContrast(randomizeKey(eff, k), locked))

  /** Plain function (not a component) so inputs keep focus across renders. */
  const setting = (k: SettingKey, label: string, children: React.ReactNode) => (
    <SettingRow
      key={k}
      k={k}
      label={label}
      isSpace={isSpace}
      isCustom={custom(k as keyof Look | 'backdrop')}
      locked={locked.has(k)}
      onReset={() => resetKey(k as keyof Look | 'backdrop')}
      onCustomize={() => customize(k as keyof Look | 'backdrop')}
      onDice={() => dice(k)}
      onLock={() => toggleLock(k)}
    >
      {children}
    </SettingRow>
  )

  const rulesNow = (isSpace ? patch.rules : look.rules) ?? {}
  const setRule = (key: string, r: BlockPatch) => {
    const rules = { ...rulesNow }
    if (Object.keys(r).length) rules[key] = r
    else delete rules[key]
    if (isSpace) setPatch((x) => ({ ...x, rules }))
    else setLook((x) => ({ ...x, rules }))
  }

  const colorRows: [SettingKey, string][] = [
    ['accent', 'Accent'],
    ['bg', 'Background'],
    ['surface', 'Surface'],
    ['surface2', 'Nested surface'],
    ['text', 'Text'],
    ['textDim', 'Dim text'],
  ]
  const commit = () => p.onDone?.({ look: eff, patch })
  const editorVars = lookVars(DEFAULT_LOOK) as React.CSSProperties

  return (
    <div
      className="editor themed"
      style={editorVars}
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
    >
      <header className="editor-head">
        <button
          className="btn ghost icon"
          aria-label="Close editor without saving"
          onClick={p.onCancel}
        >
          ✕
        </button>
        <h2>{p.title}</h2>
        <button
          className="btn secondary"
          aria-label="Randomize everything that isn't locked"
          onClick={() => apply(randomizeAll(eff, locked))}
        >
          🎲 Randomize
        </button>
      </header>

      <div className="editor-body">
        <div className="editor-preview">
          <div className="seg" role="group" aria-label="Preview type">
            <button
              className={view === 'world' ? 'on' : ''}
              aria-pressed={view === 'world'}
              onClick={() => setView('world')}
            >
              Inside a world
            </button>
            <button
              className={view === 'card' ? 'on' : ''}
              aria-pressed={view === 'card'}
              onClick={() => setView('card')}
            >
              Library card
            </button>
          </div>
          <MiniWorld look={eff} view={view} />
        </div>

        <div className="editor-panel">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'on' : ''}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="panel-body stack">
            {isSpace && (
              <div className="inherit-bar">
                <p className="dim small">
                  ↑ Inheriting from <strong>{p.parentName ?? 'the parent space'}</strong>. Change a
                  setting to customize it here.
                </p>
                <div className="row wrap">
                  <button
                    className="btn secondary small"
                    onClick={() =>
                      setPatch({
                        ...(Object.fromEntries(LOOK_KEYS.map((k) => [k, eff[k]])) as Patch),
                        backdrop: { ...eff.backdrop },
                      })
                    }
                  >
                    Customize everything
                  </button>
                  <button className="btn secondary small" onClick={() => setPatch({})}>
                    Reset all to inherited
                  </button>
                  {p.onApplyAll && (
                    <button className="btn secondary small" onClick={() => p.onApplyAll?.(patch)}>
                      Apply to all subspaces
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === 'Colors' && (
              <>
                <Seg
                  label="Base"
                  value={eff.base}
                  options={[
                    { value: 'dark', label: 'Dark base' },
                    { value: 'light', label: 'Light base' },
                  ]}
                  onChange={(b) =>
                    apply(
                      fixContrast(
                        { ...eff, ...(b === 'light' ? LIGHT_BASE : DARK_BASE) } as Look,
                        locked,
                      ),
                    )
                  }
                />
                {issues.length > 0 ? (
                  <div className="insp-warn" role="alert">
                    ⚠ Some text is hard to read:
                    <ul>
                      {issues.map((i) => (
                        <li key={i.label}>
                          {i.label}: {i.ratio.toFixed(1)}:1 (needs {i.min}:1)
                        </li>
                      ))}
                    </ul>
                    <button
                      className="btn primary small"
                      onClick={() => apply(fixContrast(eff, locked))}
                    >
                      Auto-fix
                    </button>
                  </div>
                ) : (
                  <p className="ok-line">✓ All text passes 4.5:1 contrast.</p>
                )}
                {colorRows.map(([k, label]) =>
                  setting(
                    k,
                    label,
                    <>
                      <ColorField
                        label={label}
                        value={eff[k as keyof Look] as string}
                        onChange={(v) => set(k as keyof Look, v as never)}
                      />
                    </>,
                  ),
                )}
              </>
            )}

            {tab === 'Font' && (
              <>
                {setting(
                  'fontTitle',
                  'Title font',
                  <>
                    <FontSelect
                      label="Title font"
                      value={eff.fontTitle}
                      onChange={(v) => set('fontTitle', v)}
                    />
                  </>,
                )}
                {setting(
                  'fontBody',
                  'Body font',
                  <>
                    <FontSelect
                      label="Body font"
                      value={eff.fontBody}
                      onChange={(v) => set('fontBody', v)}
                    />
                  </>,
                )}
                {setting(
                  'fontScale',
                  'Text size',
                  <>
                    <Seg
                      label="Text size"
                      value={eff.fontScale}
                      options={[
                        { value: 0.9, label: 'S' },
                        { value: 1, label: 'M' },
                        { value: 1.1, label: 'L' },
                        { value: 1.25, label: 'XL' },
                      ]}
                      onChange={(v) => set('fontScale', v)}
                    />
                  </>,
                )}
                {setting(
                  'titleWeight',
                  'Title weight',
                  <>
                    <Seg
                      label="Title weight"
                      value={eff.titleWeight}
                      options={[500, 600, 700, 800].map((w) => ({ value: w, label: String(w) }))}
                      onChange={(v) => set('titleWeight', v)}
                    />
                  </>,
                )}
              </>
            )}

            {tab === 'Shape' && (
              <>
                {setting(
                  'radius',
                  `Roundness · ${stopName(eff.radius)}`,
                  <>
                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={eff.radius}
                      aria-label="Roundness"
                      onChange={(e) => set('radius', Number(e.target.value))}
                    />
                    <Seg
                      label="Roundness stops"
                      value={stopName(eff.radius)}
                      options={RADIUS_STOPS.map((s) => ({ value: s.label, label: s.label }))}
                      onChange={(l) =>
                        set('radius', RADIUS_STOPS.find((s) => s.label === l)!.value)
                      }
                    />
                  </>,
                )}
                {setting(
                  'border',
                  'Border',
                  <>
                    <Seg
                      label="Border"
                      value={eff.border}
                      options={[
                        { value: 'none', label: 'None' },
                        { value: 'thin', label: 'Thin' },
                        { value: 'thick', label: 'Thick' },
                      ]}
                      onChange={(v) => set('border', v)}
                    />
                  </>,
                )}
                {setting(
                  'shadow',
                  'Shadow',
                  <>
                    <Seg
                      label="Shadow"
                      value={eff.shadow}
                      options={[
                        { value: 'none', label: 'None' },
                        { value: 'soft', label: 'Soft' },
                        { value: 'hard', label: 'Hard offset' },
                      ]}
                      onChange={(v) => set('shadow', v)}
                    />
                  </>,
                )}
                {setting(
                  'density',
                  'Density',
                  <>
                    <Seg
                      label="Density"
                      value={eff.density}
                      options={[
                        { value: 'compact', label: 'Compact' },
                        { value: 'comfortable', label: 'Comfortable' },
                        { value: 'airy', label: 'Airy' },
                      ]}
                      onChange={(v) => set('density', v)}
                    />
                  </>,
                )}
                {setting(
                  'iconStyle',
                  'Icon style',
                  <>
                    <Seg
                      label="Icon style"
                      value={eff.iconStyle}
                      options={[
                        { value: 'outline', label: 'Outline' },
                        { value: 'filled', label: 'Filled' },
                        { value: 'duotone', label: 'Duotone' },
                      ]}
                      onChange={(v) => set('iconStyle', v)}
                    />
                  </>,
                )}
              </>
            )}

            {tab === 'Background' &&
              setting(
                'backdrop',
                'Background',
                <>
                  <BackdropFields value={eff.backdrop} bgColor={eff.bg} onChange={setBackdrop} />
                </>,
              )}

            {tab === 'Motion' &&
              setting(
                'motion',
                'Animation level',
                <>
                  <Seg
                    label="Animation level"
                    value={eff.motion}
                    options={[
                      { value: 'full', label: 'Full' },
                      { value: 'calm', label: 'Calm' },
                      { value: 'none', label: 'None' },
                    ]}
                    onChange={(v) => set('motion', v)}
                  />
                  <p className="dim small">
                    Full: zoom portals and slide sheets. Calm: gentle fades only. None: no
                    animation. Your device’s “reduce motion” setting always wins.
                  </p>
                </>,
              )}

            {tab === 'Adv' && (
              <>
                <p className="dim small">
                  Style a whole family or one block type. For a single block, use its ⋯ → Style.
                  Most specific wins: Block → Type → Family → Frame → Space → World.
                </p>
                <Seg
                  label="Style by"
                  value={advMode}
                  options={[
                    { value: 'family', label: 'Family' },
                    { value: 'type', label: 'Block type' },
                  ]}
                  onChange={(m) => {
                    setAdvMode(m)
                    setAdvKey((m === 'family' ? FAMILY_KEYS : TYPE_KEYS)[0].key)
                  }}
                />
                <select
                  aria-label="Style target"
                  value={advKey}
                  onChange={(e) => setAdvKey(e.target.value)}
                >
                  {(advMode === 'family' ? FAMILY_KEYS : TYPE_KEYS).map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                      {rulesNow[o.key] ? ' •' : ''}
                    </option>
                  ))}
                </select>
                <PatchEditor
                  patch={rulesNow[advKey] ?? {}}
                  base={eff}
                  onChange={(r) => setRule(advKey, r)}
                />
                {rulesNow[advKey] && (
                  <button className="btn ghost" onClick={() => setRule(advKey, {})}>
                    Clear this rule
                  </button>
                )}
                <p className="dim small">
                  {Object.keys(rulesNow).length} advanced rule
                  {Object.keys(rulesNow).length === 1 ? '' : 's'} set
                  {advKey.startsWith('type:')
                    ? ` · ${metaOf(advKey.slice(5) as never)?.label ?? ''}`
                    : ''}
                  .
                </p>
              </>
            )}
          </div>

          <div className="editor-foot">
            {p.mode === 'world' || p.mode === 'space' ? (
              <button className="btn primary" onClick={commit}>
                Done (this world only)
              </button>
            ) : p.mode === 'custom-edit' ? (
              <button className="btn primary" onClick={() => p.onUpdateCustom?.(eff, patch)}>
                Save changes
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => {
                  setName('')
                  setSheet('name')
                }}
              >
                Save to My Customs
              </button>
            )}
            <button className="btn secondary" onClick={() => setSheet('more')}>
              More…
            </button>
          </div>
        </div>
      </div>

      {sheet === 'more' && (
        <Sheet title="Save, reset, load" onClose={() => setSheet(null)}>
          <div className="stack">
            {(p.mode === 'world' || p.mode === 'space') && p.customName && p.onUpdateCustom && (
              <button
                className="btn secondary"
                onClick={() => {
                  p.onUpdateCustom?.(eff, patch)
                  setSheet(null)
                }}
              >
                Update “{p.customName}”
              </button>
            )}
            {p.mode === 'custom-edit' && (
              <button
                className="btn secondary"
                onClick={() => {
                  setName(`${p.customName ?? 'My look'} copy`)
                  setSheet('name')
                }}
              >
                Save as new
              </button>
            )}
            {p.mode !== 'custom-edit' && p.mode !== 'custom-new' && (
              <button
                className="btn secondary"
                onClick={() => {
                  setName(p.customName ? `${p.customName} copy` : '')
                  setSheet('name')
                }}
              >
                {p.customName ? 'Save as new custom' : 'Save to Custom'}
              </button>
            )}
            <button className="btn secondary" onClick={() => setSheet('load')}>
              Load custom…
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (isSpace) setPatch({})
                else setLook(DEFAULT_LOOK)
                setSheet(null)
              }}
            >
              {isSpace ? 'Reset to inherited' : 'Reset to Default'}
            </button>
            <p className="dim small">
              Saving to My Customs is always your tap. Editing a world never changes a custom unless
              you save here.
            </p>
          </div>
        </Sheet>
      )}
      {sheet === 'name' && (
        <Sheet title="Name this look" onClose={() => setSheet(null)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              p.onSaveNew(name.trim() || 'My look', eff, patch)
              setSheet(null)
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunset diary"
              aria-label="Look name"
            />
            <button className="btn primary">Save</button>
          </form>
        </Sheet>
      )}
      {sheet === 'load' && (
        <Sheet title="Load a look" onClose={() => setSheet(null)} tall>
          <div className="stack">
            <h3 className="section">My Customs</h3>
            {!snap.customs.length && <p className="dim">No customs yet. Save one first.</p>}
            {[...snap.customs]
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <button
                  key={c.id}
                  className="look-row"
                  onClick={() => {
                    apply({ ...c.look })
                    setSheet(null)
                  }}
                >
                  <MiniWorld look={c.look} view="tiny" />
                  <span>{c.name}</span>
                </button>
              ))}
            <h3 className="section">Built-in presets</h3>
            {PRESETS.map((l) => (
              <button
                key={l.name}
                className="look-row"
                onClick={() => {
                  apply({ ...l })
                  setSheet(null)
                }}
              >
                <MiniWorld look={l} view="tiny" />
                <span>{l.name}</span>
              </button>
            ))}
            <p className="dim small">
              Loading changes this draft only. Nothing is saved until you tap Done.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  )
}
