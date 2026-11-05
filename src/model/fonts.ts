export interface FontDef {
  key: string
  label: string
  group: 'sans' | 'rounded' | 'serif' | 'mono' | 'handwritten' | 'display'
  stack: string
}
/** System font stacks only: the app is offline-first, so no web fonts are downloaded. */
export const FONTS: FontDef[] = [
  {
    key: 'sans',
    label: 'Clean sans',
    group: 'sans',
    stack: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  {
    key: 'geometric',
    label: 'Geometric sans',
    group: 'sans',
    stack: "'Avenir Next', Futura, 'Century Gothic', 'Trebuchet MS', sans-serif",
  },
  {
    key: 'rounded',
    label: 'Rounded',
    group: 'rounded',
    stack:
      "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Nunito, Quicksand, 'Varela Round', system-ui, sans-serif",
  },
  {
    key: 'serif',
    label: 'Classic serif',
    group: 'serif',
    stack: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  },
  {
    key: 'book',
    label: 'Book serif',
    group: 'serif',
    stack: "Charter, 'Bitstream Charter', Cambria, Georgia, serif",
  },
  {
    key: 'mono',
    label: 'Monospace',
    group: 'mono',
    stack: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  {
    key: 'hand',
    label: 'Handwritten',
    group: 'handwritten',
    stack: "'Bradley Hand', 'Segoe Print', 'Marker Felt', 'Comic Sans MS', 'Comic Neue', cursive",
  },
  {
    key: 'display',
    label: 'Display',
    group: 'display',
    stack:
      "Impact, 'Arial Narrow Bold', 'Avenir Next Condensed', Haettenschweiler, 'Trebuchet MS', sans-serif",
  },
]
export const fontStack = (key: string) => (FONTS.find((f) => f.key === key) ?? FONTS[0]).stack
