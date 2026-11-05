import type { Block } from '../../model/types'
import { useStore } from '../../store/store'
import { useWorld } from './ctx'

export default function PortalBody({ block }: { block: Block }) {
  const { snap } = useStore()
  const { enterSpace } = useWorld()
  const style = String(block.content.style ?? 'card')
  const target = snap.spaces.find((s) => s.id === block.content.targetSpaceId)
  if (!target)
    return (
      <p className="dim">⚠ This portal leads nowhere yet. Open ⋯ → Edit to pick a destination.</p>
    )
  const label = `Portal to ${target.title}. Step through.`
  return (
    <button
      className={`portal portal-${style}`}
      aria-label={label}
      onClick={() => enterSpace(target.id)}
    >
      <span className="portal-orb" aria-hidden>
        🌀
      </span>
      {style !== 'icon' && <span className="portal-name">{target.title}</span>}
      {style === 'icon' && <span className="portal-cap">{target.title}</span>}
      {(style === 'card' || style === 'banner') && (
        <span className="portal-go">Step through →</span>
      )}
    </button>
  )
}
