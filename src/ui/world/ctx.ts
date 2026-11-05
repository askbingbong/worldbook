import { createContext, useContext } from 'react'
import type { Block, ID, Space, World } from '../../model/types'

export interface WorldCtx {
  world: World
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
}
export const Ctx = createContext<WorldCtx | null>(null)
export const useWorld = (): WorldCtx => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWorld outside WorldView')
  return c
}
