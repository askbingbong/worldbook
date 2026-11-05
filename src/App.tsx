import { useEffect } from 'react'
import { init, useStore } from './store/store'
import WorldView from './ui/world/WorldView'
import Library from './ui/Library'
import NewWorldFlow from './ui/NewWorldFlow'
import Toasts from './ui/Toasts'
import { MiniPlayer } from './ui/world/AudioBlocks'
import { useAudioSel } from './store/audio'
import { useRoute } from './ui/router'

export default function App() {
  const { ready } = useStore()
  const route = useRoute()
  useEffect(() => {
    init()
  }, [])
  const hasAudio = useAudioSel((a) => a.queue.length > 0)
  const inWorld = route.startsWith('/w/')
  useEffect(() => {
    document.body.classList.toggle('in-world', inWorld)
    document.body.classList.toggle('has-mini', hasAudio)
  }, [inWorld, hasAudio])
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
      <MiniPlayer />
      <Toasts />
    </>
  )
}
