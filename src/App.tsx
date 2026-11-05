import { useEffect } from 'react'
import { init, useStore } from './store/store'
import WorldView from './ui/world/WorldView'
import Library from './ui/Library'
import NewWorldFlow from './ui/NewWorldFlow'
import Toasts from './ui/Toasts'
import { useRoute } from './ui/router'

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
        <WorldView worldId={route.split('/')[2]} spaceId={route.split('/')[3]} />
      ) : (
        <Library />
      )}
      <Toasts />
    </>
  )
}
