import { useMemo } from 'react'
import type { Block, BlockType, Look } from '../../model/types'
import { metaOf } from '../../model/blockTypes'
import { BackdropLayer, themeProps, useBlockSkin } from './theme'

let n = 0
const fake = (
  type: BlockType,
  title: string,
  parentId: string | null = null,
  tags: Block['tags'] = [],
): Block => ({
  id: `p${n++}`,
  worldId: 'preview',
  spaceId: 'preview',
  parentId,
  order: 0,
  type,
  title,
  content: {},
  tags,
  style: {},
  collapsed: false,
})

function PBlock({
  block,
  blocks,
  look,
  children,
}: {
  block: Block
  blocks: Block[]
  look: Look
  children?: React.ReactNode
}) {
  const skin = useBlockSkin(blocks, block, look)
  const meta = metaOf(block.type)
  return (
    <section className={`block hdr-${skin.header}`} style={skin.style}>
      <div className="block-head">
        <span className="chev-fake" aria-hidden>
          ▾
        </span>
        <span className="type-icon" aria-hidden>
          {meta.icon}
        </span>
        <span className="block-title fake">{block.title}</span>
        {block.tags.map((t) => (
          <span key={t.name} className="tag-chip static" style={{ ['--tag' as string]: '#FFA94D' }}>
            <i aria-hidden />#{t.name}
            <b aria-hidden>⇄</b>
          </span>
        ))}
      </div>
      <div className="block-body">{children}</div>
    </section>
  )
}

/** Compact sample used in pickers and My Customs: a note, a button, a tag chip and a portal. */
function Tiny({ look }: { look: Look }) {
  const blocks = useMemo(() => [fake('note', 'Note')], [])
  return (
    <div className="mini tiny themed" {...themeProps(look)}>
      <BackdropLayer look={look} contained />
      <div className="mini-inner">
        <PBlock block={blocks[0]} blocks={blocks} look={look}>
          <span>Hello, world</span>
        </PBlock>
        <div className="mini-row">
          <span className="btn primary mini-btn">Button</span>
          <span className="tag-chip static" style={{ ['--tag' as string]: '#4DABF7' }}>
            <i aria-hidden />
            #tag<b aria-hidden>⇄</b>
          </span>
          <span className="portal portal-button mini-portal">
            <span className="portal-orb">🌀</span> Portal
          </span>
        </div>
      </div>
    </div>
  )
}

export default function MiniWorld({
  look,
  view = 'world',
}: {
  look: Look
  view?: 'world' | 'card' | 'tiny'
}) {
  const set = useMemo(() => {
    const frame = fake('frame', 'Frame')
    return {
      note: fake('note', 'Note'),
      player: fake('player', 'Player', null, [{ name: 'mango', dir: 'both' }]),
      frame,
      inner: fake('note', 'Nested note', frame.id),
      list: fake('list', 'List'),
    }
  }, [])
  const blocks = useMemo(() => Object.values(set), [set])

  if (view === 'tiny') return <Tiny look={look} />
  if (view === 'card')
    return (
      <div
        className="mini themed"
        {...themeProps(look)}
        aria-label="Library card preview"
        role="img"
      >
        <BackdropLayer look={look} contained />
        <div className="mini-inner cards">
          {['🥭 Mango World', '🌙 Night notes'].map((t, i) => (
            <div className="world-card" key={t}>
              <div className="world-card-main">
                <span className="emoji">{t.split(' ')[0]}</span>
                <span className="wc-title">{t.slice(3)}</span>
                <span className="wc-sub">{i ? '2 days ago' : 'just now'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  return (
    <div
      className="mini themed"
      {...themeProps(look)}
      role="img"
      aria-label="Live preview of this look"
    >
      <BackdropLayer look={look} contained />
      <div className="mini-inner">
        <PBlock block={set.note} blocks={blocks} look={look}>
          <p>
            Ataulfo mangoes are the sweetest. <strong>Ripe = slight give.</strong>
          </p>
        </PBlock>
        <PBlock block={set.player} blocks={blocks} look={look}>
          <div className="t-row">
            <span className="btn primary icon big">▶</span>
            <span className="source-line">From: #mango playlist</span>
          </div>
        </PBlock>
        <div className="mini-row">
          <span className="btn primary">Button</span>
          <span className="btn secondary">Secondary</span>
          <span className="tag-chip static" style={{ ['--tag' as string]: '#FFA94D' }}>
            <i aria-hidden />
            #mango<b aria-hidden>⇄</b>
          </span>
        </div>
        <PBlock block={set.frame} blocks={blocks} look={look}>
          <div className="frame-kids">
            <PBlock block={set.inner} blocks={blocks} look={look}>
              <span>Inside a frame</span>
            </PBlock>
          </div>
        </PBlock>
        <PBlock block={set.list} blocks={blocks} look={look}>
          <ul className="plain-list">
            <li>☑ Apples</li>
            <li>☐ Bananas</li>
          </ul>
        </PBlock>
        <div className="portal portal-card">
          <span className="portal-orb">🌀</span>
          <span className="portal-name">Beach</span>
          <span className="portal-go">Step through →</span>
        </div>
      </div>
    </div>
  )
}
