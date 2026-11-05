import type { BlockPatch, Look } from '../../model/types'
import { RADIUS_STOPS, stopName } from '../../model/appearance'
import { BackdropFields, ColorField, FontSelect, Seg } from './controls'

type Field =
  | { key: 'surface' | 'accent' | 'text' | 'textDim'; label: string; kind: 'color' }
  | { key: 'radius'; label: string; kind: 'radius' }
  | {
      key: 'border' | 'shadow' | 'header' | 'titleWeight'
      label: string
      kind: 'seg'
      options: { value: string | number; label: string }[]
    }
  | { key: 'fontTitle' | 'fontBody'; label: string; kind: 'font' }

const FIELDS: Field[] = [
  { key: 'surface', label: 'Block color', kind: 'color' },
  { key: 'accent', label: 'Accent', kind: 'color' },
  { key: 'text', label: 'Text color', kind: 'color' },
  { key: 'textDim', label: 'Dim text color', kind: 'color' },
  { key: 'radius', label: 'Roundness', kind: 'radius' },
  {
    key: 'border',
    label: 'Border',
    kind: 'seg',
    options: [
      { value: 'none', label: 'None' },
      { value: 'thin', label: 'Thin' },
      { value: 'thick', label: 'Thick' },
    ],
  },
  {
    key: 'shadow',
    label: 'Shadow',
    kind: 'seg',
    options: [
      { value: 'none', label: 'None' },
      { value: 'soft', label: 'Soft' },
      { value: 'hard', label: 'Hard' },
    ],
  },
  { key: 'fontTitle', label: 'Title font', kind: 'font' },
  { key: 'fontBody', label: 'Body font', kind: 'font' },
  {
    key: 'titleWeight',
    label: 'Title weight',
    kind: 'seg',
    options: [500, 600, 700, 800].map((w) => ({ value: w, label: String(w) })),
  },
  {
    key: 'header',
    label: 'Header style',
    kind: 'seg',
    options: [
      { value: 'plain', label: 'Plain' },
      { value: 'filled', label: 'Filled' },
      { value: 'underline', label: 'Underline' },
    ],
  },
]

/**
 * Overrides for one level (a family, a block type, or a single block).
 * Each setting has an "Override" switch; when off it inherits.
 */
export default function PatchEditor({
  patch,
  onChange,
  base,
}: {
  patch: BlockPatch
  onChange: (p: BlockPatch) => void
  base: Look
}) {
  const set = <K extends keyof BlockPatch>(k: K, v: BlockPatch[K] | undefined) => {
    const next = { ...patch }
    if (v === undefined) delete next[k]
    else next[k] = v
    onChange(next)
  }
  const on = (k: keyof BlockPatch) => patch[k] !== undefined
  return (
    <div className="stack patch-editor">
      {FIELDS.map((f) => {
        const k = f.key as keyof BlockPatch
        const cur = (patch[k] ?? base[f.key as keyof Look]) as never
        return (
          <div key={f.key} className="adv-row">
            <label className="check-row">
              <input
                type="checkbox"
                checked={on(k)}
                onChange={(e) =>
                  set(k, e.target.checked ? (base[f.key as keyof Look] as never) : undefined)
                }
              />
              <span>{f.label}</span>
              {!on(k) && <small className="dim">Inherited ↑</small>}
            </label>
            {on(k) && f.kind === 'color' && (
              <ColorField label={f.label} value={cur} onChange={(v) => set(k, v as never)} />
            )}
            {on(k) && f.kind === 'radius' && (
              <div className="stack">
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={cur as number}
                  aria-label="Roundness"
                  onChange={(e) => set('radius', Number(e.target.value))}
                />
                <Seg
                  label="Roundness stops"
                  value={stopName(cur as number)}
                  options={RADIUS_STOPS.map((s) => ({ value: s.label, label: s.label }))}
                  onChange={(l) => set('radius', RADIUS_STOPS.find((s) => s.label === l)!.value)}
                />
              </div>
            )}
            {on(k) && f.kind === 'seg' && (
              <Seg
                label={f.label}
                value={cur as string | number}
                options={f.options}
                onChange={(v) => set(k, v as never)}
              />
            )}
            {on(k) && f.kind === 'font' && (
              <FontSelect
                label={f.label}
                value={cur as string}
                onChange={(v) => set(k, v as never)}
              />
            )}
          </div>
        )
      })}
      <div className="adv-row">
        <label className="check-row">
          <input
            type="checkbox"
            checked={!!patch.fill}
            onChange={(e) =>
              set('fill', e.target.checked ? { mode: 'solid', color: base.surface } : undefined)
            }
          />
          <span>Block background (color, gradient or image)</span>
          {!patch.fill && <small className="dim">Inherited ↑</small>}
        </label>
        {patch.fill && (
          <BackdropFields
            value={patch.fill}
            bgColor={base.surface}
            onChange={(p) => set('fill', { ...patch.fill, ...p })}
          />
        )}
      </div>
    </div>
  )
}
