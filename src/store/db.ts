import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  Block,
  Custom,
  Folder,
  RecentPortal,
  Snapshot,
  Space,
  TagColor,
  World,
} from '../model/types'

export interface FileRec {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
}
interface WB extends DBSchema {
  worlds: { key: string; value: World }
  spaces: { key: string; value: Space }
  blocks: { key: string; value: Block }
  folders: { key: string; value: Folder }
  recents: { key: string; value: RecentPortal }
  tagColors: { key: string; value: TagColor }
  customs: { key: string; value: Custom }
  files: { key: string; value: FileRec }
  meta: { key: string; value: unknown }
}
export type StoreName =
  'worlds' | 'spaces' | 'blocks' | 'folders' | 'recents' | 'tagColors' | 'customs'

const ALL: (StoreName | 'files')[] = [
  'worlds',
  'spaces',
  'blocks',
  'folders',
  'recents',
  'tagColors',
  'customs',
  'files',
]

let dbp: Promise<IDBPDatabase<WB>> | null = null
export const db = () =>
  (dbp ??= openDB<WB>('worldbook', 2, {
    upgrade(d) {
      for (const n of ALL)
        if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' })
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta')
    },
  }))

export async function loadAll(): Promise<{ snap: Snapshot; seeded: boolean }> {
  const d = await db()
  const [worlds, spaces, blocks, folders, recents, tagColors, customs, seeded] = await Promise.all([
    d.getAll('worlds'),
    d.getAll('spaces'),
    d.getAll('blocks'),
    d.getAll('folders'),
    d.getAll('recents'),
    d.getAll('tagColors'),
    d.getAll('customs'),
    d.get('meta', 'seeded'),
  ])
  return {
    snap: { worlds, spaces, blocks, folders, recents, tagColors, customs },
    seeded: !!seeded,
  }
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key)) as T | undefined
}
export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key)
}
export const markSeeded = () => setMeta('seeded', true)

export type Write = { put?: Partial<Snapshot>; del?: Partial<Record<StoreName, string[]>> }

/** Apply puts/deletes atomically in one transaction. */
export async function write({ put = {}, del = {} }: Write) {
  const d = await db()
  const names = [...new Set([...Object.keys(put), ...Object.keys(del)])] as StoreName[]
  if (!names.length) return
  const tx = (d as unknown as IDBPDatabase).transaction(names, 'readwrite')
  for (const n of names) {
    for (const v of (put[n] ?? []) as { id: string }[]) await tx.objectStore(n).put(v)
    for (const id of del[n] ?? []) await tx.objectStore(n).delete(id)
  }
  await tx.done
}
