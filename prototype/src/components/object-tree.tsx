import { useState } from 'react'
import type { ReactNode } from 'react'
import { Braces, ChevronRight, Eye, FunctionSquare, Hash, Layers, ListOrdered, Search, Table2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { OBJECTS, TABLES } from '@/lib/data'
import { cn } from '@/lib/utils'
import { BackingTag } from './common'

export type ObjKind = 'table' | 'view' | 'matview' | 'function' | 'sequence' | 'type'
export type ObjRef = { kind: ObjKind; schema: string; name: string }

const GROUPS: { kind: ObjKind; label: string; icon: typeof Table2 }[] = [
  { kind: 'table', label: 'Tables', icon: Table2 },
  { kind: 'view', label: 'Views', icon: Eye },
  { kind: 'matview', label: 'Materialized views', icon: Layers },
  { kind: 'function', label: 'Functions', icon: FunctionSquare },
  { kind: 'sequence', label: 'Sequences', icon: ListOrdered },
  { kind: 'type', label: 'Types', icon: Braces },
]

export function objectsOf(kind: ObjKind, schema: string): string[] {
  if (kind === 'table') return TABLES.filter((t) => t.schema === schema).map((t) => t.name)
  const src = { view: OBJECTS.views, matview: OBJECTS.matviews, function: OBJECTS.functions, sequence: OBJECTS.sequences, type: OBJECTS.types }[kind]
  return src.filter((o) => o.schema === schema).map((o) => o.name)
}

function Node({ label, icon, depth, open, onToggle, active, onClick, count, trailing }: {
  label: ReactNode; icon?: ReactNode; depth: number; open?: boolean; onToggle?: () => void; active?: boolean; onClick?: () => void; count?: number; trailing?: ReactNode
}) {
  return (
    <div
      role="treeitem"
      aria-expanded={open}
      aria-selected={active}
      tabIndex={0}
      onClick={onClick ?? onToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onClick ?? onToggle)?.() } }}
      className={cn('flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', active && 'bg-accent font-medium text-accent-foreground')}
      style={{ paddingLeft: 6 + depth * 14 }}
    >
      {onToggle ? <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} onClick={(e) => { e.stopPropagation(); onToggle() }} /> : <span className="w-3.5 shrink-0" />}
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="tabular text-[11px] text-muted-foreground">{count}</span>}
      {trailing}
    </div>
  )
}

/** Schema tree. `kinds` limits which object groups appear; tables can expand to columns. */
export function ObjectTree({ selected, onSelect, kinds, showColumns, className }: {
  selected?: ObjRef | null; onSelect: (o: ObjRef) => void; kinds?: ObjKind[]; showColumns?: boolean; className?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set(['public', 'public/table']))
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const groups = GROUPS.filter((g) => !kinds || kinds.includes(g.kind))
  const match = (n: string) => n.toLowerCase().includes(q.toLowerCase())

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="relative p-2">
        <Search className="absolute top-1/2 left-4.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-7 pl-8 text-[13px]" placeholder="Search objects" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div role="tree" className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {['public', 'auth'].map((schema) => (
          <div key={schema}>
            <Node depth={0} label={schema} icon={<Hash className="size-3.5 text-muted-foreground" />} open={open.has(schema) || !!q} onToggle={() => toggle(schema)} />
            {(open.has(schema) || !!q) && groups.map((g) => {
              const items = objectsOf(g.kind, schema).filter(match)
              if (!items.length) return null
              const gk = `${schema}/${g.kind}`
              const isOpen = open.has(gk) || !!q || groups.length === 1
              return (
                <div key={gk}>
                  {groups.length > 1 && (
                    <Node depth={1} label={g.label} count={items.length} open={isOpen} onToggle={() => toggle(gk)} trailing={g.kind !== 'table' ? <BackingTag id="OE-01b" compact /> : undefined} />
                  )}
                  {isOpen && items.map((name) => {
                    const tk = `${gk}/${name}`
                    const t = g.kind === 'table' ? TABLES.find((x) => x.schema === schema && x.name === name) : undefined
                    const expandable = showColumns && !!t
                    return (
                      <div key={tk}>
                        <Node
                          depth={groups.length > 1 ? 2 : 1}
                          label={<span className="font-mono">{name}</span>}
                          icon={<g.icon className="size-3.5 shrink-0 text-muted-foreground" />}
                          active={selected?.kind === g.kind && selected.schema === schema && selected.name === name}
                          onClick={() => onSelect({ kind: g.kind, schema, name })}
                          open={expandable ? open.has(tk) : undefined}
                          onToggle={expandable ? () => toggle(tk) : undefined}
                        />
                        {expandable && open.has(tk) && t!.columns.map((c) => (
                          <div key={c.name} className="flex h-6 items-center gap-2 pr-2 font-mono text-xs" style={{ paddingLeft: 6 + (groups.length > 1 ? 4 : 3) * 14 }}>
                            <span className={cn('truncate', c.pk && 'text-warning')}>{c.name}</span>
                            <span className="ml-auto shrink-0 text-muted-foreground">{c.type}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
