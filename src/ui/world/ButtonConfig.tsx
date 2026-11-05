import { metaOf } from '../../model/blockTypes'
import { summaries } from '../../model/tags'
import type { Block } from '../../model/types'
import { ACTIONS, cfgOf, type ActionKind } from '../../store/actions'
import { setContent, useStore } from '../../store/store'

/** "When tapped → Action → Target" editor. Target can be a block or a tag. */
export default function ButtonConfig({ block }: { block: Block }) {
  const { snap } = useStore()
  const c = cfgOf(block)
  const blocks = snap.blocks.filter((b) => b.worldId === block.worldId && b.id !== block.id)
  const tags = summaries(snap, block.worldId)
  const spaces = snap.spaces.filter((s) => s.worldId === block.worldId)
  const opt = (b: Block) => (
    <option key={b.id} value={b.id}>
      {metaOf(b.type).icon} {b.title || metaOf(b.type).label} ·{' '}
      {snap.spaces.find((s) => s.id === b.spaceId)?.title}
    </option>
  )
  const action = c.action
  const kindOptions: ('block' | 'tag' | 'space')[] =
    action === 'taggroup' ? ['tag'] : action === 'portal' ? ['block', 'space'] : ['block', 'tag']
  const kind = c.targetKind && kindOptions.includes(c.targetKind) ? c.targetKind : kindOptions[0]
  const pickBlocks = (types?: string[]) => blocks.filter((b) => !types || types.includes(b.type))

  return (
    <div className="stack cfg">
      <label>
        Button label
        <input
          value={String(block.content.label ?? '')}
          placeholder={block.title}
          onChange={(e) => setContent(block.id, { label: e.target.value })}
        />
      </label>
      <label>
        When tapped →
        <select
          value={action ?? ''}
          onChange={(e) =>
            setContent(block.id, {
              action: (e.target.value || undefined) as ActionKind | undefined,
              targetKind: undefined,
              targetId: undefined,
              tagName: undefined,
            })
          }
        >
          <option value="">— choose an action —</option>
          {ACTIONS.map((a) => (
            <option key={a.kind} value={a.kind}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      {action === 'link' && (
        <label>
          Link
          <input
            type="url"
            value={String(c.url ?? '')}
            placeholder="https://"
            onChange={(e) => setContent(block.id, { url: e.target.value })}
          />
        </label>
      )}
      {action && action !== 'link' && (
        <>
          {kindOptions.length > 1 && (
            <div className="seg" role="group" aria-label="Target type">
              {kindOptions.map((k) => (
                <button
                  key={k}
                  className={kind === k ? 'on' : ''}
                  aria-pressed={kind === k}
                  onClick={() =>
                    setContent(block.id, { targetKind: k, targetId: undefined, tagName: undefined })
                  }
                >
                  {k === 'block'
                    ? action === 'portal'
                      ? 'Portal block'
                      : 'A block'
                    : k === 'tag'
                      ? 'A tag'
                      : 'A space'}
                </button>
              ))}
            </div>
          )}
          <label>
            → Target
            {kind === 'tag' ? (
              <select
                value={c.tagName ?? ''}
                onChange={(e) =>
                  setContent(block.id, { targetKind: 'tag', tagName: e.target.value })
                }
              >
                <option value="">— choose a tag —</option>
                {tags.map((t) => (
                  <option key={t.key} value={t.name}>
                    {t.global ? t.name : `#${t.name}`} ({t.count})
                  </option>
                ))}
              </select>
            ) : kind === 'space' ? (
              <select
                value={c.targetId ?? ''}
                onChange={(e) =>
                  setContent(block.id, { targetKind: 'space', targetId: e.target.value })
                }
              >
                <option value="">— choose a space —</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={c.targetId ?? ''}
                onChange={(e) =>
                  setContent(block.id, { targetKind: 'block', targetId: e.target.value })
                }
              >
                <option value="">— choose a block —</option>
                {pickBlocks(
                  action === 'playpause'
                    ? ['player']
                    : action === 'portal'
                      ? ['portal']
                      : undefined,
                ).map(opt)}
              </select>
            )}
          </label>
        </>
      )}
    </div>
  )
}
