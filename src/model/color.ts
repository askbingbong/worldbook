// Small color toolkit: hex <-> HSL, WCAG contrast, and a contrast "auto-fix".

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n) || h.length < 6) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const isHex = (s: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim())
export const normHex = (s: string) => {
  let h = s.trim().replace('#', '').toLowerCase()
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return `#${h}`
}
export function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
  )
}
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l * 100]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return [h, s * 100, l * 100]
}
export function hslToHex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 100) / 100
  l = clamp(l, 0, 100) / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** Dark or white text for a solid background (used for text on the accent color). */
export const onColor = (bg: string) =>
  contrast(bg, '#0f1115') >= contrast(bg, '#ffffff') ? '#0f1115' : '#ffffff'

/** Nudge a foreground color's lightness (keeping hue/saturation) until it passes against every background. */
export function fixFg(fg: string, bgs: string[], min = 4.5): string {
  const worst = (c: string) => Math.min(...bgs.map((b) => contrast(c, b)))
  if (worst(fg) >= min) return fg
  const [h, s, l] = hexToHsl(fg)
  let best = fg
  let bestScore = worst(fg)
  for (const dir of [1, -1]) {
    for (let step = 1; step <= 100; step++) {
      const c = hslToHex(h, s, clamp(l + dir * step, 0, 100))
      const w = worst(c)
      if (w > bestScore) {
        best = c
        bestScore = w
      }
      if (w >= min) return c
    }
  }
  // Hue/saturation can't do it (mid-gray backgrounds): fall back to black or white.
  for (const c of ['#ffffff', '#000000']) {
    if (worst(c) > bestScore) {
      best = c
      bestScore = worst(c)
    }
  }
  return best
}
