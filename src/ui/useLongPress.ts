import { useRef } from 'react'

const INTERACTIVE = 'input,textarea,select,button,a,[contenteditable]'

/** True when the event came from a control nested inside the element that owns the handlers. */
const nested = (e: React.SyntheticEvent, selector = INTERACTIVE) => {
  const t = (e.target as HTMLElement).closest(selector)
  return !!t && t !== e.currentTarget && e.currentTarget.contains(t)
}

/**
 * Long-press (500ms) without drag. A tap fires onTap; a long press fires onLong instead.
 * Presses starting on nested controls are ignored (`pressIgnores`); a plain tap on any nested
 * control never fires onTap.
 */
export function useLongPress(
  onTap: () => void,
  onLong: () => void,
  opts: { ms?: number; pressIgnores?: string } = {},
) {
  const { ms = 500, pressIgnores = INTERACTIVE } = opts
  const timer = useRef<number>(undefined)
  const fired = useRef(false)
  const start = useRef<[number, number]>([0, 0])
  const cancel = () => window.clearTimeout(timer.current)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false
      if (nested(e, pressIgnores)) return
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
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      if (nested(e, pressIgnores)) return
      e.preventDefault()
      cancel()
      if (!fired.current) onLong()
      fired.current = true
    },
    onClick: (e: React.MouseEvent) => {
      if (nested(e)) return
      if (fired.current) fired.current = false
      else onTap()
    },
  }
}
