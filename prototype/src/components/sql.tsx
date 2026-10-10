import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const KW = new Set('select from where group by order limit join left right inner outer on as and or not in is null insert into values update set delete create table alter add column drop index view with distinct having union all case when then else end desc asc begin commit rollback explain analyze primary key references default interval ilike like exists returning'.split(' '))
const FN = new Set('sum count avg min max now date_trunc coalesce pg_size_pretty pg_total_relation_size gen_random_uuid lower upper'.split(' '))

export function highlight(sql: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(--[^\n]*)|('(?:[^']|'')*')|("(?:[^"])*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(sql))) {
    const [tok, comment, str, ident, num, word] = m
    const k = i++
    if (comment) out.push(<span key={k} className="text-muted-foreground italic">{tok}</span>)
    else if (str) out.push(<span key={k} className="text-chart-5">{tok}</span>)
    else if (ident) out.push(<span key={k} className="text-chart-2">{tok}</span>)
    else if (num) out.push(<span key={k} className="text-chart-3">{tok}</span>)
    else if (word && KW.has(word.toLowerCase())) out.push(<span key={k} className="font-medium text-chart-1">{tok}</span>)
    else if (word && FN.has(word.toLowerCase())) out.push(<span key={k} className="text-chart-4">{tok}</span>)
    else out.push(tok)
  }
  return out
}

/** A textarea with a highlighted layer underneath and a line-number gutter. */
export function SqlInput({ value, onChange, onRun, className }: { value: string; onChange: (v: string) => void; onRun?: () => void; className?: string }) {
  const lines = value.split('\n').length
  const shared = 'col-start-2 row-start-1 m-0 whitespace-pre-wrap break-words p-3 pl-2 font-mono text-[13px] leading-[1.6]'
  return (
    <div className={cn('grid min-h-0 grid-cols-[auto_1fr] overflow-auto bg-background', className)}>
      <div aria-hidden className="row-start-1 border-r bg-muted/30 px-2.5 py-3 text-right font-mono text-[13px] leading-[1.6] text-muted-foreground/60 select-none">
        {Array.from({ length: Math.max(lines, 12) }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <pre aria-hidden className={cn(shared, 'pointer-events-none')}>{highlight(value)}{'\n'}</pre>
      <textarea
        aria-label="SQL statement"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onRun?.() } }}
        className={cn(shared, 'resize-none bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/30')}
      />
    </div>
  )
}

export function SqlCode({ sql, className }: { sql: string; className?: string }) {
  return <pre className={cn('overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap', className)}>{highlight(sql)}</pre>
}
