import { useSyncExternalStore } from 'react'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export const useCanInstall = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    () => !!deferred,
  )

export async function installApp() {
  if (!deferred) return
  await deferred.prompt()
  await deferred.userChoice.catch(() => undefined)
  deferred = null
  notify()
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Ask the browser not to evict our data when storage runs low (best effort). */
export async function protectStorage() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* not supported */
  }
}
export async function storageInfo(): Promise<{
  used: number
  quota: number
  persisted: boolean
} | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    if (!e) return null
    return {
      used: e.usage ?? 0,
      quota: e.quota ?? 0,
      persisted: !!(await navigator.storage.persisted?.()),
    }
  } catch {
    return null
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}
