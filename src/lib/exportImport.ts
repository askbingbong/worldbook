// Export / import as JSON: everything, a single world, or customs. Uploaded files travel inside as data URLs.
import { normalizeLook, uid } from '../model/defaults'
import type { Custom, Folder, Snapshot, TagColor, World, Block, Space } from '../model/types'
import { db, type FileRec } from '../store/db'
import { FILE_PREFIX, getFile } from '../store/files'
import { change, getSnap, showToast } from '../store/store'
import { normalizeSnapshotLooks } from '../store/appearance'

export interface Bundle {
  format: 'worldbook'
  version: 1
  kind: 'all' | 'world' | 'customs'
  exportedAt: string
  worlds: World[]
  spaces: Space[]
  blocks: Block[]
  folders: Folder[]
  customs: Custom[]
  tagColors: TagColor[]
  files: { id: string; name: string; type: string; dataUrl: string }[]
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })

const fileIdsIn = (o: unknown): string[] => [
  ...new Set(
    [...JSON.stringify(o).matchAll(new RegExp(`${FILE_PREFIX}([0-9a-fA-F-]{8,})`, 'g'))].map(
      (m) => m[1],
    ),
  ),
]

async function withFiles(b: Omit<Bundle, 'files'>): Promise<Bundle> {
  const files: Bundle['files'] = []
  for (const id of fileIdsIn(b)) {
    const rec = await getFile(FILE_PREFIX + id)
    if (rec) files.push({ id, name: rec.name, type: rec.type, dataUrl: await toDataUrl(rec.blob) })
  }
  return { ...b, files }
}

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
const stamp = () => new Date().toISOString().slice(0, 10)
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'worldbook'
const base = (kind: Bundle['kind']) => ({
  format: 'worldbook' as const,
  version: 1 as const,
  kind,
  exportedAt: new Date().toISOString(),
})

export async function exportAll() {
  const s = getSnap()
  const b = await withFiles({
    ...base('all'),
    worlds: s.worlds,
    spaces: s.spaces,
    blocks: s.blocks,
    folders: s.folders,
    customs: s.customs,
    tagColors: s.tagColors,
  })
  download(`worldbook-everything-${stamp()}.json`, b)
  showToast(
    `Exported ${s.worlds.length} world${s.worlds.length === 1 ? '' : 's'} and ${s.customs.length} custom${s.customs.length === 1 ? '' : 's'}.`,
  )
}

export async function exportWorld(worldId: string) {
  const s = getSnap()
  const w = s.worlds.find((x) => x.id === worldId)
  if (!w) return
  const blocks = s.blocks.filter((b) => b.worldId === worldId)
  const names = new Set(blocks.flatMap((b) => b.tags.map((t) => t.name)))
  const b = await withFiles({
    ...base('world'),
    worlds: [w],
    spaces: s.spaces.filter((x) => x.worldId === worldId),
    blocks,
    folders: [],
    customs: [],
    tagColors: s.tagColors.filter((c) => names.has(c.id)),
  })
  download(`worldbook-${slug(w.title)}-${stamp()}.json`, b)
  showToast(`Exported “${w.title}”.`)
}

export async function exportCustoms() {
  const s = getSnap()
  const b = await withFiles({
    ...base('customs'),
    worlds: [],
    spaces: [],
    blocks: [],
    folders: [],
    customs: s.customs,
    tagColors: [],
  })
  download(`worldbook-customs-${stamp()}.json`, b)
  showToast(`Exported ${s.customs.length} custom${s.customs.length === 1 ? '' : 's'}.`)
}

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : [])

/** Validate and import a bundle. Everything gets fresh ids, so importing never overwrites anything. */
export async function importText(text: string): Promise<boolean> {
  let raw: Partial<Bundle>
  try {
    raw = JSON.parse(text)
  } catch {
    showToast('That file isn’t valid JSON.')
    return false
  }
  if (!raw || raw.format !== 'worldbook' || raw.version !== 1) {
    showToast('That file isn’t a Worldbook export.')
    return false
  }
  const worlds = arr<World>(raw.worlds)
  const spaces = arr<Space>(raw.spaces)
  const blocks = arr<Block>(raw.blocks)
  const folders = arr<Folder>(raw.folders)
  const customs = arr<Custom>(raw.customs)
  const files = arr<Bundle['files'][number]>(raw.files)
  const tagColors = arr<TagColor>(raw.tagColors)
  if (
    worlds.some((w) => !w || typeof w.id !== 'string' || !w.rootSpaceId) ||
    blocks.some((b) => !b || typeof b.id !== 'string' || !b.spaceId)
  ) {
    showToast('That export looks damaged, so nothing was imported.')
    return false
  }

  // Fresh ids everywhere (ids are UUIDs, so a global string replace is safe, and it also fixes file: refs).
  const ids = [...worlds, ...spaces, ...blocks, ...folders, ...customs, ...files].map((x) => x.id)
  const map = new Map(ids.map((id) => [id, uid()]))
  let json = JSON.stringify({
    worlds,
    spaces,
    blocks,
    folders,
    customs,
    files: files.map((f) => ({ ...f, dataUrl: '' })),
  })
  for (const [o, n] of map) json = json.split(o).join(n)
  const fresh = JSON.parse(json) as {
    worlds: World[]
    spaces: Space[]
    blocks: Block[]
    folders: Folder[]
    customs: Custom[]
    files: { id: string; name: string; type: string }[]
  }

  // Restore uploaded files first.
  const d = await db()
  for (let i = 0; i < files.length; i++) {
    try {
      const blob = await (await fetch(files[i].dataUrl)).blob()
      const rec: FileRec = {
        id: fresh.files[i].id,
        name: fresh.files[i].name,
        type: blob.type || fresh.files[i].type,
        size: blob.size,
        blob,
      }
      await d.put('files', rec)
    } catch {
      /* a damaged attachment shouldn't block the rest */
    }
  }

  const now = Date.now()
  const cur = getSnap()
  // Reuse folders that already exist by name.
  const folderMap = new Map<string, string>()
  const addFolders: Folder[] = []
  fresh.folders.forEach((f, i) => {
    const same = cur.folders.find((x) => x.name === f.name)
    if (same) folderMap.set(f.id, same.id)
    else addFolders.push({ ...f, order: cur.folders.length + i })
  })
  const newWorlds = fresh.worlds.map((w) => ({
    ...w,
    lastVisited: now,
    createdAt: now,
    pinned: !!w.pinned,
    folderId: w.folderId
      ? (folderMap.get(w.folderId) ??
        (addFolders.some((f) => f.id === w.folderId) ? w.folderId : null))
      : null,
    look: normalizeLook(w.look),
  }))
  const start = Math.max(-1, ...cur.customs.map((c) => c.order)) + 1
  const newCustoms = fresh.customs.map((c, i) => ({
    ...c,
    order: start + i,
    look: normalizeLook(c.look),
  }))
  const colors = tagColors.filter((c) => !cur.tagColors.some((x) => x.id === c.id))

  change(
    (s) =>
      normalizeSnapshotLooks({
        ...s,
        worlds: [...newWorlds, ...s.worlds],
        spaces: [...s.spaces, ...fresh.spaces],
        blocks: [...s.blocks, ...fresh.blocks],
        folders: [...s.folders, ...addFolders],
        customs: [...s.customs, ...newCustoms],
        tagColors: [...s.tagColors, ...colors],
      } as Snapshot),
    `Imported ${newWorlds.length} world${newWorlds.length === 1 ? '' : 's'}, ${newCustoms.length} custom${newCustoms.length === 1 ? '' : 's'}.`,
  )
  return true
}

export async function importFile(file: File) {
  if (file.size > 200 * 1024 * 1024)
    return showToast('That file is too large to import (200 MB max).')
  await importText(await file.text())
}
