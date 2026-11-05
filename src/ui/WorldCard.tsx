import { lookVars } from '../model/defaults'
import type { World } from '../model/types'
import { useLongPress } from './useLongPress'

export function ago(t: number): string {
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

interface Props {
  world: World
  onOpen: () => void
  onMenu: () => void
}

export default function WorldCard({ world, onOpen, onMenu }: Props) {
  const press = useLongPress(onOpen, onMenu)
  return (
    <div className="world-card" style={lookVars(world.look) as React.CSSProperties}>
      <button
        className="world-card-main"
        {...press}
        aria-label={`${world.title}, visited ${ago(world.lastVisited)}. Long-press for options.`}
      >
        <span className="emoji" aria-hidden>
          {world.emoji}
        </span>
        <span className="wc-title">{world.title}</span>
        <span className="wc-sub">{ago(world.lastVisited)}</span>
        {world.pinned && (
          <span className="pin" aria-label="Pinned">
            📌
          </span>
        )}
      </button>
      <button
        className="btn ghost icon wc-menu"
        aria-label={`Options for ${world.title}`}
        onClick={onMenu}
      >
        ⋯
      </button>
    </div>
  )
}
