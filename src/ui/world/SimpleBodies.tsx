import type { Block } from '../../model/types'
import { metaOf } from '../../model/blockTypes'

export function SoonBody({ block }: { block: Block }) {
  return <p className="dim">{metaOf(block.type).label} arrives in a later stage.</p>
}
