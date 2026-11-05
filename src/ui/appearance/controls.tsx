import { useRef, useState } from 'react'
import { UploadError, ingestFile } from '../../lib/media'
import { clamp, hexToHsl, hslToHex, isHex, normHex } from '../../model/color'
import { FONTS } from '../../model/fonts'
import type { Backdrop } from '../../model/types'
import { showToast } from '../../store/store'

export const SWATCHES = [
  '#0F1115',
  '#171A21',
  '#2B1D14',
  '#0A0014',
  '#05070F',
  '#F5F0E6',
  '#FFFFFF',
  '#E8EAF0',
  '#7C9CFF',
  '#00F5D4',
  '#F2A65A',
  '#FF6B6B',
  '#FFD43B',
  '#69DB7C',
  '#DA77F2',
  '#F783AC',
]

/** Segmented control. */
export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={o.value === value ? 'on' : ''}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Swatch palette + hex + hue/saturation/lightness sliders. */
export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value)
  const [h, s, l] = hexToHsl(value)
  const commit = (v: string) => {
    setHex(v)
    onChange(v)
  }
  return (
    <div className="color-field">
      <button
        className="swatch-btn"
        aria-expanded={open}
        aria-label={`${label}: ${value}. Edit color.`}
        onClick={() => setOpen(!open)}
      >
        <span className="swatch" style={{ background: value }} />
        <code>{value.toUpperCase()}</code>
      </button>
      {open && (
        <div className="color-pop stack">
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                className="swatch"
                style={{ background: c }}
                aria-label={`Use ${c}`}
                onClick={() => commit(c)}
              />
            ))}
          </div>
          <label>
            Hex
            <input
              value={hex}
              spellCheck={false}
              onChange={(e) => {
                setHex(e.target.value)
                if (isHex(e.target.value)) onChange(normHex(e.target.value))
              }}
              onBlur={() => setHex(value)}
            />
          </label>
          <label>
            Hue
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(h)}
              className="hue"
              onChange={(e) => commit(hslToHex(Number(e.target.value), s, l))}
            />
          </label>
          <label>
            Saturation
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(s)}
              onChange={(e) => commit(hslToHex(h, Number(e.target.value), l))}
            />
          </label>
          <label>
            Lightness
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(l)}
              onChange={(e) => commit(hslToHex(h, s, Number(e.target.value)))}
            />
          </label>
        </div>
      )}
    </div>
  )
}

export function FontSelect({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {FONTS.map((f) => (
        <option key={f.key} value={f.key}>
          {f.label} ({f.group})
        </option>
      ))}
    </select>
  )
}

const isAnimated = (b: Partial<Backdrop>) =>
  b.mime === 'image/gif' ||
  (b.mime ?? '').startsWith('video/') ||
  /\.(gif|mp4|webm)(\?|$)/i.test(b.url ?? '')

/** Background / fill editor (works for the page backdrop and for a block's fill). */
export function BackdropFields({
  value,
  onChange,
  bgColor,
}: {
  value: Partial<Backdrop>
  onChange: (p: Partial<Backdrop>) => void
  bgColor: string
}) {
  const file = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const mode = value.mode ?? 'none'
  const upload = async (f: File) => {
    try {
      const r = await ingestFile(f, 'media')
      onChange({ url: r.ref, mime: r.mime, mode: 'image' })
    } catch (e) {
      showToast(e instanceof UploadError ? e.message : 'Could not save that file.')
    }
  }
  return (
    <div className="stack">
      <Seg
        label="Background type"
        value={mode}
        options={[
          { value: 'none', label: 'None' },
          { value: 'solid', label: 'Solid' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'image', label: 'Image' },
        ]}
        onChange={(m) =>
          onChange({ mode: m, ...(m !== 'none' && !value.color ? { color: bgColor } : {}) })
        }
      />
      {(mode === 'solid' || mode === 'gradient') && (
        <div className="row">
          <ColorField
            label="Color"
            value={value.color ?? bgColor}
            onChange={(c) => onChange({ color: c })}
          />
          {mode === 'gradient' && (
            <ColorField
              label="Second color"
              value={value.color2 ?? '#1B1040'}
              onChange={(c) => onChange({ color2: c })}
            />
          )}
        </div>
      )}
      {mode === 'gradient' && (
        <label>
          Angle ({value.angle ?? 160}°)
          <input
            type="range"
            min={0}
            max={360}
            value={value.angle ?? 160}
            onChange={(e) => onChange({ angle: Number(e.target.value) })}
          />
        </label>
      )}
      {mode === 'image' && (
        <>
          <input
            ref={file}
            type="file"
            accept="image/*,video/mp4,video/webm"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void upload(f)
            }}
          />
          <button className="btn secondary" onClick={() => file.current?.click()}>
            ⬆ Upload image, GIF or video
          </button>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              if (link.trim()) onChange({ url: link.trim(), mime: '' })
              setLink('')
            }}
          >
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="…or paste an image link"
              aria-label="Image link"
            />
            <button className="btn secondary">Use</button>
          </form>
          {value.url && (
            <p className="dim small">
              Using: {value.url.startsWith('file:') ? 'uploaded file' : value.url}
            </p>
          )}
          <label>
            Fit
            <Seg
              label="Fit"
              value={value.fit ?? 'cover'}
              options={[
                { value: 'cover', label: 'Cover' },
                { value: 'contain', label: 'Contain' },
                { value: 'tile', label: 'Tile' },
              ]}
              onChange={(fit) => onChange({ fit })}
            />
          </label>
          <label>
            Position
            <Seg
              label="Position"
              value={value.position ?? 'center'}
              options={['center', 'top', 'bottom', 'left', 'right'].map((p) => ({
                value: p as Backdrop['position'],
                label: p,
              }))}
              onChange={(position) => onChange({ position })}
            />
          </label>
          <label>
            Dim ({value.dim ?? 30}%)
            <input
              type="range"
              min={0}
              max={80}
              value={value.dim ?? 30}
              onChange={(e) => onChange({ dim: Number(e.target.value) })}
            />
          </label>
          <label>
            Blur ({value.blur ?? 0}px)
            <input
              type="range"
              min={0}
              max={20}
              value={value.blur ?? 0}
              onChange={(e) => onChange({ blur: Number(e.target.value) })}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={value.fixed ?? true}
              onChange={(e) => onChange({ fixed: e.target.checked })}
            />
            <span>Stay fixed while scrolling</span>
          </label>
          {isAnimated(value) && (
            <div className="insp-warn">
              🔋 Animated backgrounds (GIF, video) use more battery.
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={value.pauseIdle ?? true}
                  onChange={(e) => onChange({ pauseIdle: e.target.checked })}
                />
                <span>Pause when idle or off-screen</span>
              </label>
            </div>
          )}
          <p className="dim small">A readability scrim is added automatically over images.</p>
        </>
      )}
    </div>
  )
}

export const clampN = clamp
