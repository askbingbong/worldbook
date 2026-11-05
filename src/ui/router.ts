import { useSyncExternalStore } from 'react'

const sub = (l: () => void) => {
  window.addEventListener('hashchange', l)
  return () => window.removeEventListener('hashchange', l)
}
export const useRoute = (): string =>
  useSyncExternalStore(sub, () => window.location.hash.slice(1) || '/')
export const go = (path: string) => {
  window.location.hash = path
}
