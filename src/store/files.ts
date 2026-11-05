import { db, type FileRec } from './db'
import { uid } from '../model/defaults'

/** Uploaded media lives in IndexedDB; content refers to it as "file:<id>". */
export const FILE_PREFIX = 'file:'
export const isFileRef = (u: unknown): u is string =>
  typeof u === 'string' && u.startsWith(FILE_PREFIX)

export async function putFile(blob: Blob, name: string): Promise<string> {
  const id = uid()
  const rec: FileRec = { id, name, type: blob.type, size: blob.size, blob }
  await (await db()).put('files', rec)
  return FILE_PREFIX + id
}
export async function getFile(ref: string): Promise<FileRec | undefined> {
  return (await db()).get('files', ref.slice(FILE_PREFIX.length))
}

const urlCache = new Map<string, string>()
/** Turn "file:<id>" into a playable object URL; pass other URLs through. */
export async function resolveUrl(url: string): Promise<string> {
  if (!isFileRef(url)) return url
  const hit = urlCache.get(url)
  if (hit) return hit
  const rec = await getFile(url)
  if (!rec) throw new Error('This file is missing from the browser storage.')
  const o = URL.createObjectURL(rec.blob)
  urlCache.set(url, o)
  return o
}
