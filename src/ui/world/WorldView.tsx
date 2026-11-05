import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_LOOK } from '../../model/defaults'
import { inheritedLook, spaceLook } from '../../model/appearance'
import {
  applyToAllSubspaces,
  saveCustom,
  setSpaceAppearance,
  setWorldLook,
  updateCustom,
} from '../../store/appearance'
import LookEditor from '../appearance/LookEditor'
import { BackdropLayer, themeProps } from '../appearance/theme'
import { StyleSheet, ThemeSheet } from '../appearance/Sheets'
import { metaOf } from '../../model/blockTypes'
import {
  addBlock,
  childrenOf,
  deleteBlocks,
  duplicateBlocks,
  spacePath,
  wrapInFrame,
} from '../../model/ops'
import type { Block, BlockType, ID, World } from '../../model/types'
import { change, recordPortal, showToast, useStore, visitWorld } from '../../store/store'
import { go, worldPath } from '../router'
import { useLongPress } from '../useLongPress'
import BlockView from './BlockView'
import { Ctx } from './ctx'
import { BlockMenu, EditSheet, MoveIntoSheet } from './ManageSheets'
import { exportWorld } from '../../lib/exportImport'
import { PathSheet, RenameSheet, SearchSheet, WorldMenu } from './NavSheets'
import { InspectorBody, InspectorSheet, TagManager, TagsSheet } from './TagUI'
import { scopeKey, tagIndex, targetsOf } from '../../model/tags'
import { BlockPicker, PortalSetup, rememberType, type InsertTarget } from './PickerSheets'

type Sheetstate =
  | { k: 'picker'; parentId: ID | null }
  | { k: 'portal'; target: InsertTarget }
  | { k: 'menu'; block: Block }
  | { k: 'edit'; block: Block }
  | { k: 'move'; ids: ID[] }
  | { k: 'rename' }
  | { k: 'worldMenu' }
  | { k: 'search' }
  | { k: 'path' }
  | { k: 'tags'; ids: ID[] }
  | { k: 'tagManager' }
  | { k: 'inspector'; block: Block }
  | { k: 'appearance' }
  | { k: 'theme' }
  | { k: 'style'; block: Block }
  | null

export default function WorldView({ worldId, spaceId }: { worldId: ID; spaceId?: ID }) {
  const { snap } = useStore()
  const world = snap.worlds.find((w) => w.id === worldId)
  const space =
    snap.spaces.find((s) => s.id === spaceId && s.worldId === worldId) ??
    snap.spaces.find((s) => s.id === world?.rootSpaceId)

  const [selectedId, setSelectedId] = useState<ID | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [picked, setPicked] = useState<Set<ID>>(new Set())
  const [sheet, setSheet] = useState<Sheetstate>(null)
  const [fx, setFx] = useState<{ n: number; from: string; to: string } | null>(null)
  const [scrollTo, setScrollTo] = useState<ID | null>(null)
  // The finger-lift after a long press fires a click on the same block; ignore it.
  const selectGuard = useRef(0)
  const curAccent = useRef('#7c9cff')
  const [inspectorOn, setInspectorOn] = useState(() => {
    try {
      return localStorage.getItem('wb.inspector') !== '0'
    } catch {
      return true
    }
  })
  const toggleInspector = () => {
    setInspectorOn((v) => {
      try {
        localStorage.setItem('wb.inspector', v ? '0' : '1')
      } catch {
        /* optional convenience */
      }
      return !v
    })
  }
  const edge = useRef<{ x: number; y: number } | null>(null)
  const pinch = useRef<{ d0: number; fired: boolean } | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  // A jump (search / tag manager) selects its target once the destination space is showing.
  const pendingSelect = useRef<ID | null>(null)

  useEffect(() => {
    if (world) visitWorld(world.id)
  }, [world?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset transient UI when the space changes.
  const sid = space?.id
  useEffect(() => {
    const pending = pendingSelect.current
    pendingSelect.current = null
    setSelectedId(pending)
    if (pending) setScrollTo(pending)
    setSelectMode(false)
    setPicked(new Set())
    setHighlight(null)
  }, [sid])

  useEffect(() => {
    if (!scrollTo) return
    const el = document.querySelector(`[data-block-id="${scrollTo}"]`)
    if (el) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' })
      setScrollTo(null)
    }
  }, [scrollTo, snap.blocks, sid])

  const look = useMemo(() => (space ? spaceLook(snap, space.id) : DEFAULT_LOOK), [snap, space])
  curAccent.current = look.accent
  const path = useMemo(() => (space ? spacePath(snap, space.id) : []), [snap, space])

  /** Blocks that stay bright while a tag is highlighted: matches plus the frames holding them. */
  const lit = useMemo(() => {
    if (!highlight || !space) return null
    const ids = new Set<ID>()
    const byId = new Map(snap.blocks.map((b) => [b.id, b]))
    for (const b of snap.blocks) {
      if (b.spaceId !== space.id || !b.tags.some((t) => scopeKey(b.worldId, t.name) === highlight))
        continue
      let cur: Block | undefined = b
      while (cur) {
        ids.add(cur.id)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
    }
    return ids
  }, [highlight, snap.blocks, space])

  /** Switches that are off dim or hide the blocks they share a tag with. */
  const { switchDim, switchHide } = useMemo(() => {
    const dim = new Set<ID>()
    const hide = new Set<ID>()
    if (!space) return { switchDim: dim, switchHide: hide }
    const idx = tagIndex(snap)
    for (const t of snap.blocks) {
      if (t.type !== 'toggle' || t.worldId !== worldId || t.content.on) continue
      const effect = String(t.content.effect ?? 'dim')
      if (effect === 'none') continue
      for (const l of targetsOf(idx, t)) (effect === 'hide' ? hide : dim).add(l.other.id)
    }
    return { switchDim: dim, switchHide: hide }
  }, [snap, space, worldId])
  const isHidden = (b: Block) => !!b.hidden || switchHide.has(b.id)

  const jumpTo = (b: Block) => {
    if (space && (b.spaceId !== space.id || b.worldId !== worldId)) {
      pendingSelect.current = b.id
      go(worldPath(b.worldId, b.spaceId))
    } else {
      setSelectedId(b.id)
      setScrollTo(b.id)
    }
    setSheet(null)
  }

  const enterSpace = useCallback(
    (id: ID) => {
      const target = snap.spaces.find((s) => s.id === id)
      if (!target || !world) return
      recordPortal(world.id, id, target.title)
      setFx((f) => ({
        n: (f?.n ?? 0) + 1,
        from: curAccent.current,
        to: spaceLook(snap, id).accent,
      }))
      go(worldPath(world.id, id))
    },
    [snap, world],
  )

  const startSelect = useCallback((id?: ID) => {
    selectGuard.current = Date.now()
    setSelectMode(true)
    setSheet(null)
    setPicked(id ? new Set([id]) : new Set())
  }, [])
  const exitSelect = () => {
    setSelectMode(false)
    setPicked(new Set())
  }
  const togglePick = useCallback((id: ID) => {
    if (Date.now() - selectGuard.current < 400) return
    setPicked((p) => {
      const n = new Set(p)
      if (!n.delete(id)) n.add(id)
      return n
    })
  }, [])

  const goBack = () => {
    if (!world || !space) return
    if (space.parentSpaceId) go(worldPath(world.id, space.parentSpaceId))
    else go('/')
  }
  const back = useLongPress(goBack, () => setSheet({ k: 'path' }))

  // Optional gestures (never required): swipe from the left edge = Back, pinch on a frame = collapse/expand all frames.
  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const setAllFrames = (collapsed: boolean) =>
    change(
      (s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.spaceId === space?.id && b.type === 'frame' && b.collapsed !== collapsed
            ? { ...b, collapsed }
            : b,
        ),
      }),
      collapsed ? 'Frames collapsed.' : 'Frames expanded.',
    )
  const touch = {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length === 1 && e.touches[0].clientX < 24)
        edge.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      else edge.current = null
      if (e.touches.length === 2) pinch.current = { d0: dist(e.touches), fired: false }
    },
    onTouchMove: (e: React.TouchEvent) => {
      const p = pinch.current
      if (!p || p.fired || e.touches.length !== 2 || !p.d0) return
      const r = dist(e.touches) / p.d0
      if (r < 0.7 || r > 1.35) {
        p.fired = true
        setAllFrames(r < 1)
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null
      const s0 = edge.current
      edge.current = null
      const t = e.changedTouches[0]
      if (s0 && t && t.clientX - s0.x > 80 && Math.abs(t.clientY - s0.y) < 60 && !selectMode)
        goBack()
    },
  }

  if (!world || !space)
    return (
      <div className="page">
        <button className="btn ghost" onClick={() => go('/')}>
          ← Library
        </button>
        <h1>World not found</h1>
        <p className="dim">It may have been deleted.</p>
      </div>
    )

  const allTop = childrenOf(snap.blocks, space.id, null)
  const blocks = allTop.filter((b) => showHidden || selectMode || !isHidden(b))
  const hiddenCount = snap.blocks.filter((b) => b.spaceId === space.id && isHidden(b)).length
  const close = () => setSheet(null)

  const insertAfter = (): ID | null => {
    const b = selectedId ? snap.blocks.find((x) => x.id === selectedId) : undefined
    return b && b.spaceId === space.id ? b.id : null
  }

  const addOfType = (type: BlockType, parentId: ID | null) => {
    rememberType(type)
    if (type === 'portal') {
      setSheet({ k: 'portal', target: { parentId, afterId: parentId ? null : insertAfter() } })
      return
    }
    let made: Block | null = null
    change(
      (s) => {
        const r = addBlock(s, space.id, type, {
          parentId,
          afterId: parentId ? null : insertAfter(),
        })
        made = r.block
        return r.snap
      },
      `${metaOf(type).label} added.`,
    )
    if (made) {
      setSelectedId((made as Block).id)
      setScrollTo((made as Block).id)
    }
    close()
  }

  const pickedIds = [...picked]
  const needPick = (fn: () => void) => () =>
    pickedIds.length ? fn() : showToast('Tap blocks to select them first.')

  const selBlock = selectedId
    ? snap.blocks.find((b) => b.id === selectedId && b.spaceId === space.id)
    : undefined
  const depth = path.length
  const NavButtons = (
    <>
      <button className="nav-btn" onClick={() => go('/')}>
        <span aria-hidden>📚</span>
        <span>Library</span>
      </button>
      <button className="nav-btn" aria-label="Back (hold for full path)" {...back}>
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <button
        className="nav-btn add"
        aria-label="Add block"
        onClick={() => setSheet({ k: 'picker', parentId: null })}
      >
        <span aria-hidden>＋</span>
        <span>Add</span>
      </button>
      <button className="nav-btn" onClick={() => setSheet({ k: 'tagManager' })}>
        <span aria-hidden>#</span>
        <span>Tags</span>
      </button>
      <button className="nav-btn" onClick={() => setSheet({ k: 'search' })}>
        <span aria-hidden>🔍</span>
        <span>Search</span>
      </button>
    </>
  )

  const tree = (parent: ID | null, d: number) =>
    snap.spaces
      .filter((s) => s.worldId === world.id && s.parentSpaceId === parent)
      .map((s) => (
        <div key={s.id}>
          <button
            className={`tree-row${s.id === space.id ? ' on' : ''}`}
            style={{ paddingLeft: 12 + d * 14 }}
            aria-current={s.id === space.id ? 'page' : undefined}
            onClick={() => go(worldPath(world.id, s.id))}
          >
            {d === 0 ? world.emoji : '🌀'} {s.title}
          </button>
          {tree(s.id, d + 1)}
        </div>
      ))

  return (
    <Ctx.Provider
      value={{
        world,
        look,
        openStyle: (b) => setSheet({ k: 'style', block: b }),
        space,
        selectedId,
        setSelectedId,
        selectMode,
        picked,
        togglePick,
        startSelect,
        openMenu: (b) => setSheet({ k: 'menu', block: b }),
        openPicker: (p) => setSheet({ k: 'picker', parentId: p }),
        enterSpace,
        highlight,
        setHighlight,
        lit,
        openTags: (ids) => setSheet({ k: 'tags', ids }),
        openInspector: (b) => setSheet({ k: 'inspector', block: b }),
        openEdit: (b) => setSheet({ k: 'edit', block: b }),
        isHidden,
        showHidden: showHidden || selectMode,
        switchDim,
      }}
    >
      <div
        className={`world-shell themed${selectMode ? ' select-mode' : ''}${inspectorOn ? '' : ' no-inspector'}`}
        {...themeProps(look)}
        {...touch}
      >
        <BackdropLayer look={look} />
        <div className="depth" aria-hidden>
          {Array.from({ length: Math.min(depth, 5) }, (_, i) => (
            <span key={i} style={{ opacity: 1 - i * 0.14 }} />
          ))}
          {depth > 5 && <b>+</b>}
        </div>

        <aside className="sidebar" aria-label="World tree">
          <div className="sidebar-title">
            {world.emoji} {world.title}
          </div>
          <div className="tree">{tree(null, 0)}</div>
          <nav className="side-nav" aria-label="World actions">
            {NavButtons}
          </nav>
        </aside>

        <div className="world-main">
          <header className="topbar">
            <button
              className="title-btn"
              onClick={() => setSheet({ k: 'rename' })}
              aria-label={`Rename ${space.title}`}
            >
              <span aria-hidden>{world.emoji}</span> {space.title}
            </button>
            <button
              className="btn ghost icon only-wide"
              aria-label="Toggle inspector panel"
              aria-pressed={inspectorOn}
              onClick={toggleInspector}
            >
              ◨
            </button>
            <button
              className="btn ghost icon"
              aria-label="World menu"
              onClick={() => setSheet({ k: 'worldMenu' })}
            >
              ⋯
            </button>
            <nav className="crumbs" aria-label="Breadcrumb">
              <button onClick={() => go('/')}>Library</button>
              {path.map((s, i) => (
                <span key={s.id} className="crumb">
                  <i aria-hidden>›</i>
                  <button
                    aria-current={i === path.length - 1 ? 'page' : undefined}
                    onClick={() => go(worldPath(world.id, s.id))}
                  >
                    {i === 0 ? world.title : s.title}
                  </button>
                </span>
              ))}
            </nav>
          </header>

          {highlight && (
            <div className="hl-banner" role="status">
              Highlighting {highlight.includes('|') ? '#' + highlight.split('|')[1] : highlight}
              <button className="btn secondary small" onClick={() => setHighlight(null)}>
                Clear
              </button>
            </div>
          )}
          <main className="page world-page" id="main" tabIndex={-1}>
            <div key={space.id} className="space-enter">
              {allTop.length === 0 ? (
                <button
                  className="ghost-block"
                  onClick={() => setSheet({ k: 'picker', parentId: null })}
                >
                  Tap + to add your first block
                </button>
              ) : (
                <div className="blocks">
                  {blocks.map((b) => (
                    <BlockView key={b.id} block={b} />
                  ))}
                </div>
              )}
              {hiddenCount > 0 && (
                <button
                  className="hidden-pill"
                  aria-pressed={showHidden}
                  onClick={() => setShowHidden(!showHidden)}
                >
                  {showHidden
                    ? 'Hide hidden blocks again'
                    : `${hiddenCount} hidden block${hiddenCount > 1 ? 's' : ''} · Show`}
                </button>
              )}
            </div>
          </main>
        </div>

        <aside className="inspector" aria-label="Block inspector">
          {selBlock ? (
            <div className="stack">
              <h2>
                {metaOf(selBlock.type).icon} {selBlock.title || metaOf(selBlock.type).label}
              </h2>
              <p className="dim small">
                {metaOf(selBlock.type).label} in {space.title}
              </p>
              <InspectorBody
                block={selBlock}
                onTags={() => setSheet({ k: 'tags', ids: [selBlock.id] })}
              />
              <div className="row wrap">
                <button
                  className="btn secondary small"
                  onClick={() => setSheet({ k: 'edit', block: selBlock })}
                >
                  Edit
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => setSheet({ k: 'style', block: selBlock })}
                >
                  Style
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => setSheet({ k: 'move', ids: [selBlock.id] })}
                >
                  Move into…
                </button>
              </div>
            </div>
          ) : (
            <p className="dim">Select a block to see how it connects to the rest of your world.</p>
          )}
        </aside>

        {selectMode ? (
          <div className="bottom-bar select-bar" role="toolbar" aria-label="Selected blocks">
            <span className="count" aria-live="polite">
              {picked.size} selected
            </span>
            <button
              className="btn secondary"
              onClick={needPick(() => setSheet({ k: 'move', ids: pickedIds }))}
            >
              Move into
            </button>
            <button
              className="btn secondary"
              onClick={needPick(() => setSheet({ k: 'tags', ids: pickedIds }))}
            >
              Tag
            </button>
            <button
              className="btn secondary"
              onClick={needPick(() => {
                change((s) => wrapInFrame(s, pickedIds).snap, 'Wrapped in a frame.')
                exitSelect()
              })}
            >
              Wrap in frame
            </button>
            <button
              className="btn secondary"
              onClick={needPick(() => {
                change((s) => duplicateBlocks(s, pickedIds), 'Duplicated.')
                exitSelect()
              })}
            >
              Duplicate
            </button>
            <button
              className="btn danger"
              onClick={needPick(() => {
                change(
                  (s) => deleteBlocks(s, pickedIds),
                  `${pickedIds.length} block${pickedIds.length > 1 ? 's' : ''} deleted.`,
                )
                exitSelect()
              })}
            >
              Delete
            </button>
            <button className="btn ghost icon" aria-label="Exit select mode" onClick={exitSelect}>
              ✕
            </button>
          </div>
        ) : (
          <nav className="bottom-bar" aria-label="World navigation">
            {NavButtons}
          </nav>
        )}

        {fx && (
          <div
            key={fx.n}
            className="portal-fx"
            aria-hidden
            style={{ ['--fx-from' as string]: fx.from, ['--fx-to' as string]: fx.to }}
            onAnimationEnd={() => setFx(null)}
          />
        )}

        {sheet?.k === 'picker' && (
          <BlockPicker onClose={close} onPick={(t) => addOfType(t, sheet.parentId)} />
        )}
        {sheet?.k === 'portal' && (
          <PortalSetup
            space={space}
            target={sheet.target}
            onClose={close}
            onDone={(b) => {
              setSelectedId(b.id)
              setScrollTo(b.id)
              close()
            }}
          />
        )}
        {sheet?.k === 'menu' && (
          <BlockMenu
            block={sheet.block}
            onClose={close}
            onEdit={() => setSheet({ k: 'edit', block: sheet.block })}
            onMove={() => setSheet({ k: 'move', ids: [sheet.block.id] })}
            onTags={() => setSheet({ k: 'tags', ids: [sheet.block.id] })}
            onConnections={() => setSheet({ k: 'inspector', block: sheet.block })}
            onStyle={() => setSheet({ k: 'style', block: sheet.block })}
          />
        )}
        {sheet?.k === 'edit' && <EditSheet block={sheet.block} onClose={close} />}
        {sheet?.k === 'move' && (
          <MoveIntoSheet
            ids={sheet.ids}
            worldId={world.id}
            currentSpaceId={space.id}
            onClose={close}
            onMoved={() => {
              exitSelect()
              close()
            }}
          />
        )}
        {sheet?.k === 'tags' && <TagsSheet blockIds={sheet.ids} onClose={close} />}
        {sheet?.k === 'tagManager' && (
          <TagManager worldId={world.id} onJump={jumpTo} onClose={close} />
        )}
        {sheet?.k === 'inspector' && (
          <InspectorSheet
            block={sheet.block}
            onClose={close}
            onTags={() => setSheet({ k: 'tags', ids: [sheet.block.id] })}
          />
        )}
        {sheet?.k === 'rename' && <RenameSheet world={world} space={space} onClose={close} />}
        {sheet?.k === 'worldMenu' && (
          <WorldMenu
            onClose={close}
            onSelect={() => startSelect()}
            onAppearance={() => setSheet({ k: 'appearance' })}
            onTheme={() => setSheet({ k: 'theme' })}
            onExport={() => {
              exportWorld(world.id)
              close()
            }}
          />
        )}
        {sheet?.k === 'theme' && (
          <ThemeSheet worldId={world.id} look={world.look} onClose={close} />
        )}
        {sheet?.k === 'style' && <StyleSheet block={sheet.block} base={look} onClose={close} />}
        {sheet?.k === 'appearance' && (
          <AppearanceEditor world={world} spaceId={space.id} onClose={close} />
        )}
        {sheet?.k === 'search' && (
          <SearchSheet worldId={world.id} onClose={close} onJump={jumpTo} />
        )}
        {sheet?.k === 'path' && (
          <PathSheet
            world={world}
            path={path}
            onClose={close}
            onLibrary={() => go('/')}
            onGo={(s) => {
              go(worldPath(world.id, s.id))
              close()
            }}
          />
        )}
      </div>
    </Ctx.Provider>
  )
}

/** World ⋯ → Appearance: opens the editor on the current look (world root) or the space's overrides. */
function AppearanceEditor({
  world,
  spaceId,
  onClose,
}: {
  world: World
  spaceId: ID
  onClose: () => void
}) {
  const { snap } = useStore()
  const space = snap.spaces.find((s) => s.id === spaceId)!
  const isRoot = space.id === world.rootSpaceId
  const src = snap.customs.find((c) => c.id === world.sourceCustomId)
  const parentSpace = snap.spaces.find((s) => s.id === space.parentSpaceId)

  if (isRoot)
    return (
      <LookEditor
        mode="world"
        title="Appearance"
        initial={world.look}
        customName={src?.name}
        onCancel={onClose}
        onDone={({ look }) => {
          setWorldLook(world.id, look)
          onClose()
        }}
        onSaveNew={(name, look) => {
          const c = saveCustom(name, look)
          setWorldLook(world.id, look, c.id, 'Saved to My Customs and applied.')
          onClose()
        }}
        onUpdateCustom={
          src
            ? (look) => {
                updateCustom(src.id, look)
                setWorldLook(world.id, look, src.id)
                onClose()
              }
            : undefined
        }
      />
    )
  return (
    <LookEditor
      mode="space"
      title={`Appearance · ${space.title}`}
      initial={spaceLook(snap, space.id)}
      parent={inheritedLook(snap, space.id)}
      parentName={parentSpace?.title ?? world.title}
      initialPatch={space.appearance}
      customName={src?.name}
      onCancel={onClose}
      onDone={({ patch }) => {
        setSpaceAppearance(space.id, patch)
        onClose()
      }}
      onApplyAll={(patch) => {
        applyToAllSubspaces(space.id, patch)
        onClose()
      }}
      onSaveNew={(name, look, patch) => {
        saveCustom(name, look)
        setSpaceAppearance(space.id, patch, 'Saved the effective look to My Customs.')
        onClose()
      }}
    />
  )
}
