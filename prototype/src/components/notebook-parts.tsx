import { forwardRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { Output } from '@/lib/notebooks'
import { cn } from '@/lib/utils'

const KW = new Set('import from as def return if elif else for while in not and or is None True False class with try except finally raise lambda yield pass break continue global nonlocal assert del async await'.split(' '))
const BI = new Set('print len range str int float list dict set tuple sum min max round sorted enumerate zip open type isinstance'.split(' '))

export function highlightPy(src: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:[^"\\\n]|\\.)*"|f?'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(@?[A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g
  let m: RegExpExecArray | null, i = 0
  while ((m = re.exec(src))) {
    const [tok, comment, str, num, word] = m
    const k = i++
    if (comment) out.push(<span key={k} className="text-muted-foreground italic">{tok}</span>)
    else if (str) out.push(<span key={k} className="text-chart-5">{tok}</span>)
    else if (num) out.push(<span key={k} className="text-chart-2">{tok}</span>)
    else if (word && KW.has(word)) out.push(<span key={k} className="font-medium text-chart-1">{tok}</span>)
    else if (word && BI.has(word)) out.push(<span key={k} className="text-chart-4">{tok}</span>)
    else out.push(tok)
  }
  return out
}

const CODE = 'm-0 font-mono text-[13px] leading-[1.55] whitespace-pre-wrap break-words px-3 py-2'

/** Auto-growing code input: a highlighted layer sets the height, the textarea sits on top. */
export const CodeInput = forwardRef<HTMLTextAreaElement, { value: string; onChange: (v: string) => void; onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void; onFocus: () => void; plain?: boolean; label: string }>(
  function CodeInput({ value, onChange, onKeyDown, onFocus, plain, label }, ref) {
    return (
      <div className="relative">
        <pre aria-hidden className={cn(CODE, 'pointer-events-none min-h-[2.4rem]')}>{plain ? value : highlightPy(value)}{'\n'}</pre>
        <textarea
          ref={ref} aria-label={label} spellCheck={false} value={value}
          onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} onFocus={onFocus}
          className={cn(CODE, 'absolute inset-0 size-full resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/25')}
        />
      </div>
    )
  },
)

function inline(text: string, key: number): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return <span key={key}>{parts.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{p.slice(1, -1)}</code> : p)}</span>
}

/** Enough Markdown for notebook prose: headings, lists, bold and inline code. */
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = [], para: string[] = []
  const flush = () => {
    if (list.length) { blocks.push(<ul key={blocks.length} className="my-1.5 list-disc space-y-0.5 pl-5">{list.map((l, i) => <li key={i}>{inline(l, i)}</li>)}</ul>); list = [] }
    if (para.length) { blocks.push(<p key={blocks.length} className="my-1.5">{inline(para.join(' '), 0)}</p>); para = [] }
  }
  for (const line of source.split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)/)
    if (h) { flush(); const cls = ['text-[1.5rem] font-semibold tracking-tight mt-1 mb-2', 'text-[1.2rem] font-semibold mt-1 mb-1.5', 'text-[1.05rem] font-semibold mt-1 mb-1'][h[1].length - 1]; blocks.push(<div key={blocks.length} role="heading" aria-level={h[1].length} className={cls}>{inline(h[2], 0)}</div>) }
    else if (/^\s*[-*]\s+/.test(line)) { if (para.length) flush(); list.push(line.replace(/^\s*[-*]\s+/, '')) }
    else if (!line.trim()) flush()
    else { if (list.length) flush(); para.push(line) }
  }
  flush()
  return <div className="max-w-[80ch] text-[14.5px] leading-relaxed">{blocks.length ? blocks : <span className="text-muted-foreground italic">Empty Markdown cell. Double-click to edit.</span>}</div>
}

function Chart({ o }: { o: Extract<Output, { kind: 'chart' }> }) {
  const W = 460, H = 280, L = 56, B = 44, T = 28, R = 12
  const max = Math.ceil(Math.max(...o.data.map((d) => d.value)) * 5) / 5 + 0.2
  const bw = (W - L - R) / o.data.length
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={o.title} className="rounded bg-white font-sans text-[#222]">
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="none" stroke="#222" strokeWidth="0.8" />
      {ticks.map((t) => <g key={t}><line x1={L - 4} x2={L} y1={y(t)} y2={y(t)} stroke="#222" strokeWidth="0.8" /><text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="#222">{t.toFixed(1)}</text></g>)}
      {o.data.map((d, i) => (
        <g key={d.label}>
          <rect x={L + i * bw + bw * 0.25} y={y(d.value)} width={bw * 0.5} height={H - B - y(d.value)} fill="#0b5c6e" />
          <text x={L + i * bw + bw / 2} y={H - B + 15} textAnchor="middle" fontSize="10.5" fill="#222">{d.label}</text>
        </g>
      ))}
      <text x={L + (W - L - R) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#222">region</text>
      <text transform={`translate(14 ${T + (H - T - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#222">{o.ylabel}</text>
    </svg>
  )
}

export function OutputView({ o, count }: { o: Output; count: number | null }) {
  if (o.kind === 'text') return <pre className="overflow-x-auto font-mono text-[13px] leading-[1.45] whitespace-pre">{o.text.replace(/\n$/, '')}</pre>
  if (o.kind === 'chart') return <Chart o={o} />
  if (o.kind === 'error') return <pre className="overflow-x-auto rounded-sm bg-destructive/8 px-3 py-2 font-mono text-[13px] leading-[1.45] whitespace-pre text-destructive">{o.traceback.replace('{n}', String(count ?? ' '))}</pre>
  return (
    <div className="overflow-x-auto">
      <table className="tabular border-collapse font-sans text-[13px]">
        <thead><tr className="border-b border-foreground/60"><th />{o.columns.map((c) => <th key={c} className="px-2.5 py-1 text-right font-semibold">{c}</th>)}</tr></thead>
        <tbody>
          {o.rows.map((r, i) => (
            <tr key={i} className="odd:bg-muted/60 hover:bg-accent">
              <th className="px-2.5 py-1 text-right font-semibold">{i}</th>
              {r.map((v, j) => <td key={j} className="px-2.5 py-1 text-right">{typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {o.note && <div className="mt-1 text-xs text-muted-foreground">{o.note}</div>}
    </div>
  )
}
