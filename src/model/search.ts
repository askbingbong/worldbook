import type { Snapshot, World } from './types'

/** Search world names, space names, block names, note text and tags. */
export function searchWorlds(s: Snapshot, query: string): World[] {
  const q = query.trim().toLowerCase().replace(/^[#@]/, '')
  if (!q) return s.worlds
  const hit = new Set<string>()
  for (const w of s.worlds) if (w.title.toLowerCase().includes(q)) hit.add(w.id)
  for (const sp of s.spaces) if (sp.title.toLowerCase().includes(q)) hit.add(sp.worldId)
  for (const b of s.blocks) {
    const text = typeof b.content.text === 'string' ? b.content.text : ''
    if (
      b.title.toLowerCase().includes(q) ||
      text.toLowerCase().includes(q) ||
      b.tags.some((t) => t.name.toLowerCase().replace(/^@/, '').includes(q))
    )
      hit.add(b.worldId)
  }
  return s.worlds.filter((w) => hit.has(w.id))
}
