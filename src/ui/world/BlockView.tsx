import { useEffect, useState } from 'react'
import { metaOf } from '../../model/blockTypes'
import { childrenOf } from '../../model/ops'
import type { Block } from '../../model/types'
import { setBlock, setContent, useStore } from '../../store/store'
import { useLongPress } from '../useLongPress'
import { useWorld } from './ctx'
import ListBody from './ListBody'
import NoteBody from './NoteBody'
import PortalBody from './PortalBody'
import { SoonBody } from './SimpleBodies'
import {
  ButtonBody,
  ClockBody,
  CounterBody,
  LinkBody,
  PickerBody,
  TimerBody,
  ToggleBody,
} from './InteractiveBlocks'
import { PlayerBody, PlaylistBody } from './AudioBlocks'
import MediaBody from './MediaBody'
import { TagChip } from './TagUI'
import { activeLinks, connectedPlaylist, scopeKey } from '../../model/tags'
import { useAudioSel } from '../../store/audio'
import { useTagIndex } from '../hooks'
import { useBlockSkin } from '../appearance/theme'

const LAYOUTS = ['stack', 'row', 'grid', 'tabs'] as const

function TitleInput({ block }: { block: Block }) {
  const [v, setV] = useState(block.title)
  useEffect(() => setV(block.title), [block.title])
  return (
    <input
      className="block-title"
      value={v}
      aria-label={`${metaOf(block.type).label} title`}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== block.title && setBlock(block.id, { title: v })}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function FrameBody({ block }: { block: Block }) {
  const { snap } = useStore()
  const { openPicker, isHidden, showHidden } = useWorld()
  const [tab, setTab] = useState(0)
  const kids = childrenOf(snap.blocks, block.spaceId, block.id).filter(
    (k) => showHidden || !isHidden(k),
  )
  const layout = String(block.content.layout ?? 'stack')
  const active = Math.min(tab, Math.max(0, kids.length - 1))
  return (
    <div>
      <div className="seg" role="group" aria-label="Frame layout">
        {LAYOUTS.map((l) => (
          <button
            key={l}
            className={layout === l ? 'on' : ''}
            aria-pressed={layout === l}
            onClick={() => setContent(block.id, { layout: l })}
          >
            {l}
          </button>
        ))}
      </div>
      {layout === 'tabs' && kids.length > 0 && (
        <div className="tabs" role="tablist">
          {kids.map((k, i) => (
            <button
              key={k.id}
              role="tab"
              aria-selected={i === active}
              className={i === active ? 'on' : ''}
              onClick={() => setTab(i)}
            >
              {metaOf(k.type).icon} {k.title || metaOf(k.type).label}
            </button>
          ))}
        </div>
      )}
      <div className={`frame-kids layout-${layout}`}>
        {(layout === 'tabs' ? kids.slice(active, active + 1) : kids).map((k) => (
          <BlockView key={k.id} block={k} />
        ))}
      </div>
      {!kids.length && <p className="dim">Empty frame.</p>}
      <button className="btn secondary small" onClick={() => openPicker(block.id)}>
        + Add inside
      </button>
    </div>
  )
}

function Body({ block }: { block: Block }) {
  switch (block.type) {
    case 'note':
      return <NoteBody block={block} />
    case 'list':
      return <ListBody block={block} />
    case 'frame':
      return <FrameBody block={block} />
    case 'portal':
      return <PortalBody block={block} />
    case 'media':
      return <MediaBody block={block} />
    case 'playlist':
      return <PlaylistBody block={block} />
    case 'player':
      return <PlayerBody block={block} />
    case 'button':
      return <ButtonBody block={block} />
    case 'toggle':
      return <ToggleBody block={block} />
    case 'picker':
      return <PickerBody block={block} />
    case 'counter':
      return <CounterBody block={block} />
    case 'timer':
      return <TimerBody block={block} />
    case 'clock':
      return <ClockBody block={block} />
    case 'link':
      return <LinkBody block={block} />
    default:
      return <SoonBody block={block} />
  }
}

export default function BlockView({ block }: { block: Block }) {
  const {
    selectedId,
    setSelectedId,
    selectMode,
    picked,
    togglePick,
    startSelect,
    openMenu,
    highlight,
    setHighlight,
    lit,
    openTags,
    openInspector,
    isHidden,
    switchDim,
    look,
  } = useWorld()
  const { snap } = useStore()
  const skin = useBlockSkin(snap.blocks, block, look)
  const idx = useTagIndex()
  const linkCount = activeLinks(idx, block).length
  const pl = block.type === 'player' ? connectedPlaylist(idx, block) : undefined
  const playing = useAudioSel((a) =>
    block.type === 'playlist'
      ? a.playing && a.playlistId === block.id
      : block.type === 'player'
        ? a.playing && (a.owner === block.id || (!!pl && a.playlistId === pl.other.id))
        : false,
  )
  const dimmed = (!!lit && !lit.has(block.id)) || switchDim.has(block.id)
  const hiddenNow = isHidden(block)
  const meta = metaOf(block.type)
  const isPicked = picked.has(block.id)
  const selected = selectedId === block.id && !selectMode
  const toggle = () => setBlock(block.id, { collapsed: !block.collapsed })
  const press = useLongPress(toggle, () => startSelect(block.id), { pressIgnores: 'button,a' })

  // Decorative blocks: no header chrome, just the thing and a ⋯ button.
  if (block.type === 'divider' || block.type === 'label' || block.type === 'spacer') {
    return (
      <div
        className={`block slim${selected ? ' selected' : ''}${isPicked ? ' picked' : ''}${dimmed ? ' dimmed' : ''}${hiddenNow ? ' is-hidden' : ''}`}
        data-block-id={block.id}
        style={skin.style}
        onClickCapture={(e) => {
          if (selectMode && (e.target as HTMLElement).closest('.block') === e.currentTarget) {
            e.preventDefault()
            e.stopPropagation()
            togglePick(block.id)
          }
        }}
        {...(selectMode ? {} : { onClick: () => setSelectedId(selected ? null : block.id) })}
      >
        {selectMode && (
          <span className="pick" aria-hidden>
            {isPicked ? '☑' : '☐'}
          </span>
        )}
        <div className="slim-body">
          {block.type === 'divider' && <hr aria-label="Divider" />}
          {block.type === 'label' && (
            <div className="label-text">{String(block.content.text ?? '')}</div>
          )}
          {block.type === 'spacer' && (
            <div style={{ height: Number(block.content.height ?? 24) }} aria-hidden />
          )}
        </div>
        {!selectMode && (
          <button
            className="btn ghost icon"
            aria-label={`${meta.label} options`}
            onClick={() => openMenu(block)}
          >
            ⋯
          </button>
        )}
      </div>
    )
  }

  const tags = block.tags
  return (
    <section
      className={`block${selected ? ' selected' : ''}${isPicked ? ' picked' : ''}${block.collapsed ? ' collapsed' : ''}${playing ? ' playing' : ''}${dimmed ? ' dimmed' : ''}${hiddenNow ? ' is-hidden' : ''}`}
      data-block-id={block.id}
      style={skin.style}
      aria-label={`${meta.label}: ${block.title}`}
      onClickCapture={(e) => {
        if (selectMode && (e.target as HTMLElement).closest('.block') === e.currentTarget) {
          e.preventDefault()
          e.stopPropagation()
          togglePick(block.id)
        }
      }}
      onClick={(e) => {
        if (selectMode) return
        const t = e.target as HTMLElement
        if (t.closest('.block') !== e.currentTarget) return
        const interactive = t.closest('input,button,textarea,a,select')
        if (!interactive) setSelectedId(selected ? null : block.id)
        else setSelectedId(block.id)
      }}
    >
      <div className={`block-head hdr-${skin.header}`} {...press}>
        {selectMode ? (
          <span
            className="pick"
            role="checkbox"
            aria-checked={isPicked}
            aria-label={`Select ${block.title}`}
          >
            {isPicked ? '☑' : '☐'}
          </span>
        ) : (
          <button
            className="btn ghost icon chev"
            aria-expanded={!block.collapsed}
            aria-label={block.collapsed ? 'Expand' : 'Collapse'}
            onClick={toggle}
          >
            {block.collapsed ? '▸' : '▾'}
          </button>
        )}
        <span className="type-icon" aria-hidden>
          {meta.icon}
        </span>
        <TitleInput block={block} />
        {linkCount > 0 && (
          <button
            className="link-glyph"
            aria-label={`Linked to ${linkCount} block${linkCount === 1 ? '' : 's'}. Show connections.`}
            onClick={() => openInspector(block)}
          >
            🔗
          </button>
        )}
        {tags.slice(0, 2).map((t) => (
          <TagChip
            key={t.name}
            tag={t}
            active={highlight === scopeKey(block.worldId, t.name)}
            onTap={() => {
              const k = scopeKey(block.worldId, t.name)
              setHighlight(highlight === k ? null : k)
            }}
            onLong={() => openTags([block.id])}
          />
        ))}
        {tags.length > 2 && (
          <button
            className="tag-chip"
            aria-label={`${tags.length - 2} more tags`}
            onClick={() => openTags([block.id])}
          >
            +{tags.length - 2}
          </button>
        )}
        {!selectMode && (
          <button
            className="btn ghost icon"
            aria-label={`${block.title} options`}
            onClick={() => openMenu(block)}
          >
            ⋯
          </button>
        )}
      </div>
      {!block.collapsed && (
        <div className="block-body">
          <Body block={block} />
        </div>
      )}
    </section>
  )
}
