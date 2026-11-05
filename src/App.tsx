import { useEffect } from 'react'
import { init, useStore } from './store/store'
import Library from './ui/Library'
import NewWorldFlow from './ui/NewWorldFlow'
import Toasts from './ui/Toasts'
import { go, useRoute } from './ui/router'

function WorldPlaceholder({ id }: { id: string }) {
  const { snap } = useStore()
  const w = snap.worlds.find((x) => x.id === id)
  const blocks = snap.blocks.filter((b) => b.worldId === id).length
  return (
    <div className="page">
      <button className="btn ghost" onClick={() => go('/')}>
        ← Library
      </button>
      <h1>{w ? `${w.emoji} ${w.title}` : 'World not found'}</h1>
      <p className="dim">
        The world view arrives in Stage 2. This world has {blocks} block(s) saved.
      </p>
    </div>
  )
}

export default function App() {
  const { ready } = useStore()
  const route = useRoute()
  useEffect(() => {
    init()
  }, [])
  if (!ready) return <div className="page dim">Loading…</div>
  return (
    <>
      {route === '/new' ? (
        <NewWorldFlow />
      ) : route.startsWith('/w/') ? (
        <WorldPlaceholder id={route.slice(3)} />
      ) : (
        <Library />
      )}
      <Toasts />
    </>
  )
}
