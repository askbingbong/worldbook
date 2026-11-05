import { createContext, useContext } from 'react'
import type { Block, ID, Look, Space, World } from '../../model/types'

export interface WorldCtx {
  world: World
  /** effective look of the current space */
  look: Look
  openStyle: (b: Block) => void
  space: Space
  selectedId: ID | null
  setSelectedId: (id: ID | null) => void
  selectMode: boolean
  picked: Set<ID>
  togglePick: (id: ID) => void
  startSelect: (id?: ID) => void
  openMenu: (b: Block) => void
  openPicker: (parentId: ID | null) => void
  enterSpace: (id: ID) => void
  /** scope key of the highlighted tag, if any */
  highlight: string | null
  setHighlight: (k: string | null) => void
  /** blocks that stay bright while highlighting (matches + their frames); null = no highlight */
  lit: Set<ID> | null
  openTags: (ids: ID[]) => void
  openInspector: (b: Block) => void
  openEdit: (b: Block) => void
  /** hidden by a button / tag-group toggle / switch that is off */
  isHidden: (b: Block) => boolean
  showHidden: boolean
  /** blocks dimmed because a connected switch is off */
  switchDim: Set<ID>
}
export const Ctx = createContext<WorldCtx | null>(null)
export const useWorld = (): WorldCtx => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWorld outside WorldView')
  return c
}
