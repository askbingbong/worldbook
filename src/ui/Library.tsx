import { useMemo, useRef, useState } from 'react'
import { exportAll, importFile } from '../lib/exportImport'
import { searchWorlds } from '../model/search'
import type { World } from '../model/types'
import { useStore, visitWorld } from '../store/store'
import Sheet from './Sheet'
import WorldActions from './WorldActions'
import WorldCard, { ago } from './WorldCard'
import { go } from './router'

export default function Library() {
  const { snap } = useStore()
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<World | null>(null)
  const [libMenu, setLibMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const worlds = useMemo(() => searchWorlds(snap, query), [snap, query])
  const searching = query.trim() !== ''
  const pinned = worlds.filter((w) => w.pinned)
  const rest = worlds.filter((w) => !w.pinned)
  const sorted = (l: World[]) => [...l].sort((a, b) => b.lastVisited - a.lastVisited)

  const open = (w: World) => {
    visitWorld(w.id)
    go(`/w/${w.id}`)
  }
  const grid = (l: World[]) => (
    <div className="grid">
      {sorted(l).map((w) => (
        <WorldCard key={w.id} world={w} onOpen={() => open(w)} onMenu={() => setMenuFor(w)} />
      ))}
    </div>
  )

  const recents = [...snap.recents].sort((a, b) => b.at - a.at).slice(0, 8)

  return (
    <main id="main" tabIndex={-1} className="page">
      <header className="lib-head">
        <h1>Worldbook</h1>
        <button
          className="btn ghost icon"
          aria-label="Library menu"
          onClick={() => setLibMenu(true)}
        >
          ⋯
        </button>
      </header>
      <input
        type="search"
        className="search"
        placeholder="Search worlds, notes, tags…"
        aria-label="Search library"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {snap.worlds.length === 0 && (
        <div className="empty">
          <p>Your universe is empty. Make a world.</p>
        </div>
      )}
      {snap.worlds.length > 0 && worlds.length === 0 && (
        <div className="empty">
          <p>No worlds match “{query}”.</p>
        </div>
      )}

      {!searching && recents.length > 0 && (
        <section>
          <h2 className="section">Recent portals</h2>
          <div className="chips-row">
            {recents.map((r) => (
              <button
                key={r.id}
                className="chip"
                onClick={() => go(`/w/${r.worldId}/${r.spaceId}`)}
              >
                🌀 {r.title} <small>{ago(r.at)}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {pinned.length > 0 && (
        <section>
          <h2 className="section">Pinned</h2>
          {grid(pinned)}
        </section>
      )}

      {snap.folders.map((f) => {
        const inF = rest.filter((w) => w.folderId === f.id)
        if (!inF.length) return null
        return (
          <section key={f.id}>
            <h2 className="section">📁 {f.name}</h2>
            {grid(inF)}
          </section>
        )
      })}

      {rest.some((w) => !snap.folders.some((f) => f.id === w.folderId)) && (
        <section>
          <h2 className="section">
            {pinned.length || snap.folders.length ? 'Worlds' : 'All worlds'}
          </h2>
          {grid(rest.filter((w) => !snap.folders.some((f) => f.id === w.folderId)))}
        </section>
      )}

      <button className="fab btn primary" onClick={() => go('/new')}>
        + New World
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) {
            setLibMenu(false)
            await importFile(f)
          }
        }}
      />
      {menuFor && <WorldActions world={menuFor} onClose={() => setMenuFor(null)} />}
      {libMenu && (
        <Sheet title="Library" onClose={() => setLibMenu(false)}>
          <div className="stack">
            <button className="btn secondary" onClick={() => go('/customs')}>
              My Customs
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setLibMenu(false)
                void exportAll()
              }}
            >
              Export everything
            </button>
            <button className="btn secondary" onClick={() => fileRef.current?.click()}>
              Import from a file…
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}
