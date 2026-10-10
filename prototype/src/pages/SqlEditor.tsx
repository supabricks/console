import { useRef, useState } from 'react'
import { AlertTriangle, Bookmark, ChevronRight, Database, Folder, History, Loader2, Play, Plus, Save, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, StatusBadge } from '@/components/common'
import { DataGrid } from '@/components/data-grid'
import type { GridColumn } from '@/components/data-grid'
import { ObjectTree } from '@/components/object-tree'
import { SqlInput } from '@/components/sql'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QUERY_HISTORY, rowsFor, SAVED_QUERIES, TABLES } from '@/lib/data'
import type { Row } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Result =
  | { kind: 'rows'; columns: GridColumn[]; rows: Row[]; ms: number; truncated?: boolean }
  | { kind: 'command'; message: string; ms: number }
  | { kind: 'error'; message: string; hint?: string; ms: number }
type QTab = { id: string; title: string; sql: string; saved?: string; result?: Result; running?: boolean; dirty?: boolean }

const PLAN = [
  { d: 0, node: 'Sort', detail: 'Sort Key: (sum(o.amount)) DESC', cost: '4812.40..4812.41', rows: 4, ms: 411.8, pct: 1 },
  { d: 1, node: 'HashAggregate', detail: 'Group Key: c.region', cost: '4812.30..4812.36', rows: 4, ms: 411.7, pct: 18 },
  { d: 2, node: 'Hash Join', detail: 'Hash Cond: (o.customer_id = c.id)', cost: '412.80..3890.79', rows: 171204, ms: 338.2, pct: 31 },
  { d: 3, node: 'Seq Scan on orders o', detail: "Filter: (status <> 'refunded') ,  Rows Removed by Filter: 13098", cost: '0.00..3024.78', rows: 171204, ms: 201.4, pct: 47 },
  { d: 3, node: 'Hash', detail: 'Buckets: 16384  Memory Usage: 712kB', cost: '256.80..256.80', rows: 12480, ms: 9.6, pct: 1 },
  { d: 4, node: 'Seq Scan on customers c', detail: '', cost: '0.00..256.80', rows: 12480, ms: 5.1, pct: 2 },
]

function execute(sql: string, writes: boolean, limit: number): Result {
  const s = sql.trim().replace(/;$/, '')
  const low = s.toLowerCase()
  if (!s) return { kind: 'error', message: 'Nothing to run.', ms: 0 }
  if (/^(update|insert|delete|alter|create|drop|truncate)\b/.test(low)) {
    if (!writes) return { kind: 'error', message: 'ERROR: cannot execute ' + low.split(/\s/)[0].toUpperCase() + ' in a read-only transaction', hint: 'Turn on “Allow writes” for this tab to change data on this branch.', ms: 2 }
    const verb = low.split(/\s/)[0].toUpperCase()
    return { kind: 'command', message: verb === 'ALTER' || verb === 'CREATE' || verb === 'DROP' ? verb + ' TABLE' : `${verb} ${verb === 'INSERT' ? '0 ' : ''}1`, ms: 14 }
  }
  if (low.includes('region') && low.includes('sum')) {
    return { kind: 'rows', ms: 412, columns: [{ name: 'region', type: 'text' }, { name: 'revenue', type: 'numeric' }], rows: [{ region: 'north', revenue: 1284020.5 }, { region: 'west', revenue: 1102877.25 }, { region: 'south', revenue: 874310.0 }, { region: 'east', revenue: 861992.75 }] }
  }
  if (low.includes('date_trunc')) {
    return { kind: 'rows', ms: 96, columns: [{ name: 'day', type: 'timestamptz' }, { name: 'orders', type: 'bigint' }], rows: Array.from({ length: 30 }, (_, i) => ({ day: `2026-${i < 9 ? '10' : '09'}-${String(i < 9 ? 9 - i : 39 - i).padStart(2, '0')} 00:00:00+00`, orders: 5200 + ((i * 977) % 1800) })) }
  }
  const m = low.match(/from\s+(?:public\.|auth\.)?"?([a-z_]+)"?/)
  if (m) {
    const t = TABLES.find((x) => x.name === m[1])
    if (!t) return { kind: 'error', message: `ERROR: relation "${m[1]}" does not exist`, hint: m[1] === 'order' ? 'Did you mean "orders"?' : 'Check the object explorer for the table name.', ms: 3 }
    const rows = rowsFor(t.name, Math.min(limit, 200))
    return { kind: 'rows', ms: 18 + t.columns.length * 3, columns: t.columns, rows, truncated: t.rows > rows.length && !/limit\s+\d+/.test(low) }
  }
  return { kind: 'rows', ms: 1, columns: [{ name: '?column?', type: 'integer' }], rows: [{ '?column?': 1 }] }
}

let seq = 1

export default function SqlEditor() {
  const { branchName, branch } = useStore()
  const [tabs, setTabs] = useState<QTab[]>([{ id: 't0', title: 'Revenue by region', sql: SAVED_QUERIES[0].sql, saved: 'q1' }])
  const [active, setActive] = useState('t0')
  const [writes, setWrites] = useState(false)
  const [limit, setLimit] = useState('200')
  const [saved, setSaved] = useState(SAVED_QUERIES)
  const [history, setHistory] = useState(QUERY_HISTORY)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tab = tabs.find((t) => t.id === active) ?? tabs[0]
  const patch = (id: string, p: Partial<QTab>) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)))

  const open = (title: string, sql: string, savedId?: string) => {
    if (tabs.length >= 8) return toast.error('Close a tab before opening another (eight-tab limit).')
    const id = `t${seq++}`
    setTabs((ts) => [...ts, { id, title, sql, saved: savedId }]); setActive(id)
  }
  const close = (id: string) => {
    const rest = tabs.filter((t) => t.id !== id)
    if (!rest.length) return patch(id, { title: 'Untitled', sql: '', result: undefined, saved: undefined, dirty: false })
    setTabs(rest); if (active === id) setActive(rest[rest.length - 1].id)
  }
  const run = () => {
    if (!tab || tab.running) return
    patch(tab.id, { running: true })
    const res = execute(tab.sql, writes, Number(limit))
    timer.current = setTimeout(() => {
      patch(tab.id, { running: false, result: res })
      setHistory((h) => [{ at: '14:05:3' + (h.length % 10), branch: branchName, status: res.kind === 'error' ? 'failed' : 'succeeded', ms: res.ms, rows: res.kind === 'rows' ? res.rows.length : 0, sql: tab.sql.replace(/\s+/g, ' ').slice(0, 90) }, ...h])
    }, Math.min(900, 150 + res.ms))
  }
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    patch(tab.id, { running: false, result: { kind: 'error', message: 'ERROR: canceling statement due to user request', ms: 0 } })
  }
  const res = tab?.result
  const folders = [...new Set(saved.map((s) => s.folder))]

  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0 shrink-0 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar/50">
        <Tabs defaultValue="objects" className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList className="m-2 grid grid-cols-3">
            <TabsTrigger value="objects"><Database /> Objects</TabsTrigger>
            <TabsTrigger value="saved"><Bookmark /> Saved</TabsTrigger>
            <TabsTrigger value="history"><History /> History</TabsTrigger>
          </TabsList>
          <TabsContent value="objects" className="flex min-h-0 flex-1 flex-col">
            <ObjectTree className="flex-1" showColumns onSelect={(o) => o.kind === 'table' ? open(o.name, `SELECT *\n  FROM ${o.schema}.${o.name}\n LIMIT 100;`) : toast.message(`${o.schema}.${o.name}: open the object explorer for its definition`)} />
          </TabsContent>
          <TabsContent value="saved" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {folders.map((f) => (
              <div key={f} className="mb-2">
                <div className="flex h-7 items-center gap-1.5 px-1.5 text-xs font-medium text-muted-foreground"><Folder className="size-3.5" />{f}</div>
                {saved.filter((s) => s.folder === f).map((s) => (
                  <div key={s.id} className="group flex h-7 items-center rounded-md pr-1 pl-6 text-[13px] hover:bg-accent">
                    <button className="min-w-0 flex-1 truncate text-left" onClick={() => open(s.title, s.sql, s.id)}>{s.title}</button>
                    <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100" aria-label={`Delete ${s.title}`} onClick={() => { setSaved((x) => x.filter((y) => y.id !== s.id)); toast.success('Saved query deleted') }}><X /></Button>
                  </div>
                ))}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <div className="px-1.5 pb-1"><BackingTag id="SQ-05" /></div>
            {history.map((h, i) => (
              <button key={i} className="mb-1 block w-full rounded-md border p-2 text-left hover:bg-accent" onClick={() => open('From history', h.sql)}>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="tabular">{h.at}</span><span className="truncate font-mono">{h.branch}</span><span className="ml-auto"><StatusBadge status={h.status} /></span></div>
                <div className="mt-1 truncate font-mono text-xs">{h.sql}</div>
                <div className="tabular mt-0.5 text-[11px] text-muted-foreground">{h.ms} ms, {h.rows} rows</div>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b bg-muted/30">
          <div className="flex min-w-0 flex-1 overflow-x-auto">
            {tabs.map((t) => (
              <div key={t.id} className={cn('group flex h-9 shrink-0 items-center gap-1.5 border-r pr-1.5 pl-3 text-[13px]', t.id === active ? 'bg-background font-medium shadow-[inset_0_-2px_0_var(--primary)]' : 'text-muted-foreground hover:bg-muted/60')}>
                <button onClick={() => setActive(t.id)} className="max-w-44 truncate">{t.title}{t.dirty && ' •'}</button>
                {t.running && <Loader2 className="size-3 animate-spin" />}
                <Button variant="ghost" size="icon-xs" aria-label={`Close ${t.title}`} onClick={() => close(t.id)}><X /></Button>
              </div>
            ))}
            <Button variant="ghost" size="icon-sm" className="m-1" aria-label="New query tab" onClick={() => open('Untitled', '')}><Plus /></Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5">
          <span className="flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"><Database className="size-3.5" /> PostgreSQL</span>
          <span className="text-[13px] text-muted-foreground">Runs on <span className="font-mono text-[12.5px] text-foreground">{branchName}</span></span>
          <label className={cn('flex items-center gap-1.5 text-xs', writes ? 'font-medium text-warning' : 'text-muted-foreground')}><Switch checked={writes} onCheckedChange={setWrites} /> {writes ? 'Writes allowed' : 'Read only'}</label>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger size="sm" aria-label="Row limit"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="100">100 rows</SelectItem><SelectItem value="200">200 rows</SelectItem><SelectItem value="1000">1,000 rows</SelectItem></SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSaveTitle(tab.title === 'Untitled' ? '' : tab.title); setSaveOpen(true) }}><Save /> Save</Button>
            {tab.running ? <Button variant="destructive" size="sm" onClick={cancel}><Square /> Cancel</Button> : <Button size="sm" onClick={run}><Play /> Run <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-[10px]">Ctrl ↵</kbd></Button>}
          </div>
        </div>
        {writes && branch.isDefault && (
          <div className="flex items-center gap-2 border-b bg-warning/10 px-3 py-1.5 text-[13px]"><AlertTriangle className="size-4 text-warning" /> Writes are enabled on the default branch <span className="font-mono">{branchName}</span>. Statements change live data immediately.</div>
        )}

        <SqlInput className="h-[38%] shrink-0 border-b" value={tab.sql} onChange={(v) => patch(tab.id, { sql: v, dirty: true })} onRun={run} />

        <Tabs defaultValue="results" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex items-center gap-3 border-b px-3 py-1">
            <TabsList><TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="plan">Query plan</TabsTrigger><TabsTrigger value="messages">Messages</TabsTrigger></TabsList>
            <div className="tabular ml-auto text-xs text-muted-foreground">
              {tab.running ? 'Running…' : res?.kind === 'rows' ? `${res.rows.length} rows in ${res.ms} ms` : res?.kind === 'command' ? `${res.message}, ${res.ms} ms` : res ? 'Failed' : 'Not run yet'}
            </div>
          </div>
          <TabsContent value="results" className="flex min-h-0 flex-1 flex-col">
            {tab.running ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Running on {branchName}…</div>
            ) : !res ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">Run a statement to see results. One statement per run, up to {Number(limit).toLocaleString()} rows.</div>
            ) : res.kind === 'error' ? (
              <div className="m-3 rounded-md border border-destructive/40 bg-destructive/8 p-3">
                <div className="font-mono text-[13px] text-destructive">{res.message}</div>
                {res.hint && <div className="mt-1 text-[13px] text-muted-foreground">Hint: {res.hint}</div>}
              </div>
            ) : res.kind === 'command' ? (
              <div className="m-3 rounded-md border border-success/40 bg-success/8 p-3 font-mono text-[13px]">{res.message}</div>
            ) : (
              <>
                {res.truncated && <div className="border-b bg-info/8 px-3 py-1 text-xs text-info">Showing the first {res.rows.length} rows. Add a LIMIT or raise the row limit to see more.</div>}
                <DataGrid className="flex-1" columns={res.columns} rows={res.rows} />
              </>
            )}
          </TabsContent>
          <TabsContent value="plan" className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">EXPLAIN (ANALYZE, BUFFERS), planning 0.4 ms, execution 412.0 ms <BackingTag id="SQ-03b" /></div>
            <div className="rounded-md border">
              {PLAN.map((p, i) => (
                <div key={i} className="flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0">
                  <div className="min-w-0 flex-1" style={{ paddingLeft: p.d * 18 }}>
                    <div className="flex items-center gap-1 font-mono text-[13px]">{p.d > 0 && <ChevronRight className="size-3 text-muted-foreground" />}{p.node}</div>
                    {p.detail && <div className="truncate pl-4 font-mono text-[11px] text-muted-foreground">{p.detail}</div>}
                  </div>
                  <div className="tabular w-24 text-right text-xs text-muted-foreground">{p.rows.toLocaleString()} rows</div>
                  <div className="tabular w-20 text-right text-xs">{p.ms} ms</div>
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', p.pct > 40 ? 'bg-warning' : 'bg-primary')} style={{ width: `${p.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">47% of the time is a sequential scan on orders. An index on orders(status) would not help here; most rows match.</p>
          </TabsContent>
          <TabsContent value="messages" className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs text-muted-foreground">
            {res ? <>[14:05:31] {res.kind === 'error' ? res.message : res.kind === 'command' ? res.message : `SELECT ${res.rows.length}`}<br />[14:05:31] Query ID op_7f31c2, {writes ? 'read-write' : 'read-only'} transaction, branch {branchName}</> : 'No messages.'}
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save query</DialogTitle><DialogDescription>Saved queries belong to this project and travel with it when it is packaged.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="q-title">Title</Label><Input id="q-title" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} maxLength={120} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button disabled={!saveTitle.trim()} onClick={() => {
              const id = tab.saved ?? `q${Date.now()}`
              setSaved((s) => (s.some((x) => x.id === id) ? s.map((x) => (x.id === id ? { ...x, title: saveTitle, sql: tab.sql } : x)) : [...s, { id, folder: 'Unfiled', title: saveTitle, sql: tab.sql }]))
              patch(tab.id, { title: saveTitle, saved: id, dirty: false }); setSaveOpen(false); toast.success('Query saved')
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
