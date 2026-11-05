import { useRef } from 'react'

/** Long-press (500ms) without drag. A tap fires onTap; a long press fires onLong instead. */
export function useLongPress(onTap: () => void, onLong: () => void, ms = 500) {
  const timer = useRef<number>(undefined)
  const fired = useRef(false)
  const start = useRef<[number, number]>([0, 0])
  const cancel = () => window.clearTimeout(timer.current)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      start.current = [e.clientX, e.clientY]
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLong()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const [x, y] = start.current
      if (Math.abs(e.clientX - x) > 8 || Math.abs(e.clientY - y) > 8) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      cancel()
      if (!fired.current) onLong()
      fired.current = true
    },
    onClick: () => {
      if (fired.current) fired.current = false
      else onTap()
    },
  }
}
