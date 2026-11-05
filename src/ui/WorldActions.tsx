import { useState } from 'react'
import type { World } from '../model/types'
import {
  createFolder,
  deleteWorld,
  duplicateWorld,
  moveToFolder,
  renameWorld,
  togglePin,
  useStore,
} from '../store/store'
import Sheet from './Sheet'

type Mode = 'menu' | 'rename' | 'folder'

/** Long-press / ⋯ actions for a world card. */
export default function WorldActions({ world, onClose }: { world: World; onClose: () => void }) {
  const { snap } = useStore()
  const [mode, setMode] = useState<Mode>('menu')
  const [name, setName] = useState(world.title)
  const [folderName, setFolderName] = useState('')
  const done = (fn: () => void) => () => {
    fn()
    onClose()
  }

  if (mode === 'rename')
    return (
      <Sheet title="Rename world" onClose={onClose}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            renameWorld(world.id, name)
            onClose()
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="World name"
          />
          <button className="btn primary">Save</button>
        </form>
      </Sheet>
    )

  if (mode === 'folder')
    return (
      <Sheet title="Move to folder" onClose={onClose}>
        <div className="stack">
          <button className="btn secondary" onClick={done(() => moveToFolder(world.id, null))}>
            {world.folderId === null ? '✓ ' : ''}No folder
          </button>
          {snap.folders.map((f) => (
            <button
              key={f.id}
              className="btn secondary"
              onClick={done(() => moveToFolder(world.id, f.id))}
            >
              {world.folderId === f.id ? '✓ ' : ''}📁 {f.name}
            </button>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              const f = createFolder(folderName)
              if (f) {
                moveToFolder(world.id, f.id)
                onClose()
              }
            }}
          >
            <input
              placeholder="New folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              aria-label="New folder name"
            />
            <button className="btn primary">Add</button>
          </form>
        </div>
      </Sheet>
    )

  return (
    <Sheet title={`${world.emoji} ${world.title}`} onClose={onClose}>
      <div className="stack">
        <button className="btn secondary" onClick={done(() => togglePin(world.id))}>
          {world.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button className="btn secondary" onClick={() => setMode('rename')}>
          Rename
        </button>
        <button className="btn secondary" onClick={done(() => duplicateWorld(world.id))}>
          Duplicate
        </button>
        <button className="btn secondary" onClick={() => setMode('folder')}>
          Move to folder
        </button>
        <button className="btn danger" onClick={done(() => deleteWorld(world.id))}>
          Delete
        </button>
      </div>
    </Sheet>
  )
}
