import type { Block, ID, Look } from '../../model/types'
import { DARK_BASE, fixContrast, LIGHT_BASE, PRESETS } from '../../model/appearance'
import { DEFAULT_LOOK } from '../../model/defaults'
import { setBlockStyle, setWorldLook } from '../../store/appearance'
import { useStore } from '../../store/store'
import Sheet from '../Sheet'
import MiniWorld from './MiniWorld'
import PatchEditor from './PatchEditor'

/** World ⋯ → Theme: quick light/dark switch and built-in presets for the whole world. */
export function ThemeSheet({
  worldId,
  look,
  onClose,
}: {
  worldId: ID
  look: Look
  onClose: () => void
}) {
  const apply = (next: Look, msg: string) => {
    setWorldLook(worldId, next, null, msg)
    onClose()
  }
  return (
    <Sheet title="Theme" onClose={onClose} tall>
      <div className="stack">
        <div className="row">
          <button
            className="btn secondary grow"
            onClick={() =>
              apply(fixContrast({ ...look, ...DARK_BASE } as Look), 'Dark base applied.')
            }
          >
            🌙 Dark
          </button>
          <button
            className="btn secondary grow"
            onClick={() =>
              apply(fixContrast({ ...look, ...LIGHT_BASE } as Look), 'Light base applied.')
            }
          >
            ☀️ Light
          </button>
        </div>
        <h3 className="section">Built-in presets</h3>
        {PRESETS.map((l) => (
          <button
            key={l.name}
            className="look-row"
            onClick={() => apply({ ...l }, `${l.name} applied.`)}
          >
            <MiniWorld look={l} view="tiny" />
            <span>{l.name}</span>
          </button>
        ))}
        <button
          className="btn danger"
          onClick={() => apply({ ...DEFAULT_LOOK }, 'Reset to Default.')}
        >
          Reset to Default
        </button>
        <p className="dim small">
          Presets are copied into this world. For full control open ⋯ → Appearance.
        </p>
      </div>
    </Sheet>
  )
}

/** Block ⋯ → Style: overrides for this single block. Most specific level, so it wins over everything else. */
export function StyleSheet({
  block: initial,
  base,
  onClose,
}: {
  block: Block
  base: Look
  onClose: () => void
}) {
  const { snap } = useStore()
  const block = snap.blocks.find((b) => b.id === initial.id) ?? initial
  return (
    <Sheet title={`Style · ${block.title}`} onClose={onClose} tall>
      <div className="stack">
        <p className="dim small">
          Overrides here apply to this block only (and beat family, type, frame and space styles).
        </p>
        <PatchEditor patch={block.style} base={base} onChange={(s) => setBlockStyle(block.id, s)} />
        <button
          className="btn danger"
          disabled={!Object.keys(block.style).length}
          onClick={() => setBlockStyle(block.id, {}, 'Block style reset.')}
        >
          Reset block style
        </button>
      </div>
    </Sheet>
  )
}
