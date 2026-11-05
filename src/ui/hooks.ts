import { useEffect, useMemo, useState } from 'react'
import { tagIndex } from '../model/tags'
import { resolveUrl } from '../store/files'
import { useStore } from '../store/store'

/** Resolve "file:<id>" (or any URL) to something usable in src=. Null while loading or on failure. */
export function useResolvedUrl(url: string | undefined | null): string | null {
  const [state, setState] = useState<{ for: string; url: string | null }>({ for: '', url: null })
  useEffect(() => {
    let live = true
    if (!url) return
    resolveUrl(url)
      .then((u) => live && setState({ for: url, url: u }))
      .catch(() => live && setState({ for: url, url: null }))
    return () => {
      live = false
    }
  }, [url])
  return url && state.for === url ? state.url : null
}

export function useTagIndex() {
  const { snap } = useStore()
  return useMemo(() => tagIndex(snap), [snap])
}
