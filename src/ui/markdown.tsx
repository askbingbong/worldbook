import type { ReactNode } from 'react'

const INLINE =
  /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<]+)/g

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={k}>{part.slice(2, -2)}</strong>
    if (/^\*.+\*$/.test(part)) return <em key={k}>{part.slice(1, -1)}</em>
    const m = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (m)
      return (
        <a key={k} href={m[2]} target="_blank" rel="noopener noreferrer">
          {m[1]}
        </a>
      )
    if (/^https?:\/\//.test(part))
      return (
        <a key={k} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      )
    return part
  })
}

/** Tiny, safe markdown subset: **bold**, *italic*, links, bullets, checklists. */
export function Markdown({
  text,
  onToggleLine,
}: {
  text: string
  onToggleLine?: (line: number) => void
}) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let bullets: ReactNode[] = []
  const flush = (i: number) => {
    if (bullets.length) out.push(<ul key={`ul${i}`}>{bullets}</ul>)
    bullets = []
  }
  lines.forEach((line, i) => {
    const chk = line.match(/^\s*[-*] \[( |x|X)\] ?(.*)$/)
    const bul = line.match(/^\s*[-*] (.*)$/)
    if (chk) {
      const done = chk[1] !== ' '
      bullets.push(
        <li key={i} className="check">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            className="md-check"
            aria-label={chk[2] || 'item'}
            onClick={() => onToggleLine?.(i)}
          >
            {done ? '☑' : '☐'}
          </button>
          <span className={done ? 'done' : ''}>{inline(chk[2], `c${i}`)}</span>
        </li>,
      )
    } else if (bul) {
      bullets.push(<li key={i}>{inline(bul[1], `b${i}`)}</li>)
    } else {
      flush(i)
      out.push(
        line.trim() ? <p key={i}>{inline(line, `p${i}`)}</p> : <div key={i} className="md-gap" />,
      )
    }
  })
  flush(lines.length)
  return <div className="md">{out}</div>
}
