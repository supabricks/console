import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bookmark, ChevronRight, Columns2, Database, Folder, History, Loader2, Lock, Play, Plus, Save, Sparkles, Square, Table2, X } from 'lucide-react'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { deltaType, fmtN, QUERY_HISTORY, rowsFor, SAVED_QUERIES, SLOTS, slotsOf, TABLES, versionsFor } from '@/lib/data'
import type { Row } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Result =
  | { kind: 'rows'; columns: GridColumn[]; rows: Row[]; ms: number; truncated?: boolean }
  | { kind: 'command'; message: string; ms: number }
  | { kind: 'error'; message: string; hint?: string; ms: number }
type Engine = 'pg' | 'spark'
type QTab = { id: string; title: string; sql: string; engine: Engine; saved?: string; result?: Result; running?: boolean; dirty?: boolean; note?: string; kept?: { result: Result; version: number } }

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

export default function SqlEditor({ engine: initial = 'pg' }: { engine?: Engine }) {
  const { db, branchName, branch, pipelines, databases, sessions, setSessions } = useStore()
  const [tabs, setTabs] = useState<QTab[]>([{ id: 't0', title: 'Revenue by region', sql: SAVED_QUERIES[0].sql, saved: 'q1', engine: initial }])
  const [active, setActive] = useState('t0')
  const [writes, setWrites] = useState(false)
  const [limit, setLimit] = useState('200')
  const [saved, setSaved] = useState(SAVED_QUERIES)
  const [history, setHistory] = useState(QUERY_HISTORY)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [plId, setPlId] = useState(() => (pipelines.find((p) => p.db === db.id && p.branch === branchName) ?? pipelines.find((p) => p.db === db.id) ?? pipelines[0])?.id)
  const [version, setVersion] = useState('latest')
  const [profile, setProfile] = useState<'compact' | 'analytical'>('compact')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tab = tabs.find((t) => t.id === active) ?? tabs[0]
  const patch = (id: string, p: Partial<QTab>) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)))
  const spark = tab.engine === 'spark'
  const pl = pipelines.find((p) => p.id === plId)
  const plDb = (id: string) => databases.find((d) => d.id === id)?.name ?? id
  const versions = pl ? versionsFor(pl, 8) : []
  const vNum = version === 'latest' ? (pl?.version ?? 0) : Number(version)
  const held = sessions.find((s) => s.ownerKind === 'sql' && s.pipeline === plId)
  const mine = held?.version === vNum ? held : undefined
  const used = sessions.reduce((n, s) => n + slotsOf(s), 0)

  const open = (title: string, sql: string, savedId?: string) => {
    if (tabs.length >= 8) return toast.error('Close a tab before opening another (eight-tab limit).')
    const id = `t${seq++}`
    setTabs((ts) => [...ts, { id, title, sql, saved: savedId, engine: tab.engine }]); setActive(id)
  }
  const close = (id: string) => {
    const rest = tabs.filter((t) => t.id !== id)
    if (!rest.length) return patch(id, { title: 'Untitled', sql: '', result: undefined, saved: undefined, dirty: false, kept: undefined })
    setTabs(rest); if (active === id) setActive(rest[rest.length - 1].id)
  }
  const sparkResult = (): Result => {
    const low = tab.sql.toLowerCase()
    if (/^\s*(update|insert|delete|alter|create|drop|truncate)\b/.test(low)) return { kind: 'error', message: 'Analytical tables are read only. Change the data in PostgreSQL and it will be synced.', ms: 1 }
    const m = low.match(/from\s+(?:public\.|auth\.)?"?`?([a-z_]+)/)
    if (m && pl && TABLES.some((t) => t.name === m[1]) && !pl.tables.some((k) => k.endsWith(`.${m[1]}`))) return { kind: 'error', message: `[TABLE_OR_VIEW_NOT_FOUND] ${m[1]} is not in this pipeline.`, hint: 'Only synced tables can be queried with Spark. Check the pipeline in Sync.', ms: 40 }
    const r = execute(tab.sql, false, Number(limit))
    if (r.kind === 'rows' && version !== 'latest') r.rows = r.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' && k !== 'id' && !k.endsWith('_id') ? Math.round(v * 0.9871 * 100) / 100 : v])))
    return { ...r, ms: Math.round(r.ms * 2.6 + 380) }
  }
  const finish = (res: Result, note?: string) => {
    patch(tab.id, { running: false, result: res, note })
    setHistory((h) => [{ at: '14:05:3' + (h.length % 10), branch: spark ? `Spark v${vNum}` : branchName, status: res.kind === 'error' ? 'failed' : 'succeeded', ms: res.ms, rows: res.kind === 'rows' ? res.rows.length : 0, sql: tab.sql.replace(/\s+/g, ' ').slice(0, 90) }, ...h])
  }
  const run = () => {
    if (!tab || tab.running) return
    if (!spark) {
      patch(tab.id, { running: true, note: undefined })
      const res = execute(tab.sql, writes, Number(limit))
      timer.current = setTimeout(() => finish(res), Math.min(900, 150 + res.ms))
      return
    }
    if (!pl) return toast.error('No pipeline to query. Create one in Sync first.')
    const need = profile === 'analytical' ? 2 : 1
    if (!mine && used - (held ? slotsOf(held) : 0) + need > SLOTS) return patch(tab.id, { result: { kind: 'error', message: 'Analytical capacity is in use. Close a session first.', hint: `${used} of ${SLOTS} slots are held by other sessions. Open Sessions to see them.`, ms: 0 } })
    const res = sparkResult()
    if (mine) {
      patch(tab.id, { running: true, note: undefined })
      timer.current = setTimeout(() => finish(res, `version ${fmtN(vNum)}`), Math.min(1400, res.ms))
      return
    }
    const sid = `ses_${Math.random().toString(16).slice(2, 10)}`
    setSessions((s) => [...s.filter((x) => x.id !== held?.id), { id: sid, owner: `SQL editor: ${tab.title}`, ownerKind: 'sql', pipeline: pl.id, version: vNum, profile, state: 'starting', started: '14:05', expiresMin: 15 }])
    patch(tab.id, { running: true, note: held ? `Moving the session to version ${fmtN(vNum)}…` : 'Starting a session…' })
    timer.current = setTimeout(() => {
      setSessions((s) => s.map((x) => (x.id === sid ? { ...x, state: 'ready' } : x)))
      patch(tab.id, { note: undefined })
      timer.current = setTimeout(() => finish(res, `version ${fmtN(vNum)}`), Math.min(1400, res.ms))
    }, 1400)
  }
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    patch(tab.id, { running: false, note: undefined, result: { kind: 'error', message: spark ? 'Query cancelled.' : 'ERROR: canceling statement due to user request', ms: 0 } })
  }
  const res = tab?.result
  const folders = [...new Set(saved.map((s) => s.folder))]
  const grid = (r: Result) => r.kind === 'rows' ? <DataGrid className="flex-1" columns={r.columns} rows={r.rows} /> : null

  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0 shrink-0 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar/50">
        <Tabs defaultValue="objects" className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList className="m-2 grid grid-cols-3">
            <TabsTrigger value="objects"><Database /> {spark ? 'Tables' : 'Objects'}</TabsTrigger>
            <TabsTrigger value="saved"><Bookmark /> Saved</TabsTrigger>
            <TabsTrigger value="history"><History /> History</TabsTrigger>
          </TabsList>
          <TabsContent value="objects" className="flex min-h-0 flex-1 flex-col">
            {spark ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {pl ? (
                  <>
                    <div className="flex items-center gap-2 px-1.5 py-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-sm bg-olap" />Delta tables, version {fmtN(vNum)}</div>
                    {pl.tables.map((key) => {
                      const t = TABLES.find((x) => `${x.schema}.${x.name}` === key)
                      return (
                        <details key={key} className="group">
                          <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 text-[13px] hover:bg-accent">
                            <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" /><Table2 className="size-3.5 text-muted-foreground" />
                            <button className="min-w-0 flex-1 truncate text-left font-mono" onClick={(e) => { e.preventDefault(); open(key.split('.')[1], `SELECT *\nFROM ${key}\nLIMIT 100;`) }}>{key}</button>
                          </summary>
                          {t?.columns.map((c) => <div key={c.name} className="flex h-6 items-center gap-2 pr-2 pl-9 font-mono text-xs"><span className="truncate">{c.name}</span><span className="ml-auto shrink-0 text-olap">{deltaType(c.type).delta}</span></div>)}
                        </details>
                      )
                    })}
                    <p className="mt-3 px-1.5 text-xs text-muted-foreground">Only synced tables appear here. <Link to={`/sync/${pl.id}`} className="text-primary hover:underline">View pipeline</Link></p>
                  </>
                ) : <p className="p-3 text-[13px] text-muted-foreground">Nothing is synced yet. <Link to="/sync/new" className="text-primary hover:underline">Create a pipeline</Link></p>}
              </div>
            ) : (
              <ObjectTree className="flex-1" showColumns onSelect={(o) => o.kind === 'table' ? open(o.name, `SELECT *\nFROM ${o.schema}.${o.name}\nLIMIT 100;`) : toast.message(`${o.schema}.${o.name}: open the object explorer for its definition`)} />
            )}
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
            <div className="px-1.5 pb-1"><BackingTag id={spark ? 'AN-05' : 'SQ-05'} /></div>
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
              <div key={t.id} className={cn('group flex h-9 shrink-0 items-center gap-1.5 border-r pr-1.5 pl-3 text-[13px]', t.id === active ? cn('bg-background font-medium', t.engine === 'spark' ? 'shadow-[inset_0_-2px_0_var(--olap)]' : 'shadow-[inset_0_-2px_0_var(--oltp)]') : 'text-muted-foreground hover:bg-muted/60')}>
                <span className={cn('size-2 shrink-0 rounded-sm', t.engine === 'spark' ? 'bg-olap' : 'bg-oltp')} title={t.engine === 'spark' ? 'Spark' : 'PostgreSQL'} />
                <button onClick={() => setActive(t.id)} className="max-w-44 truncate">{t.title}{t.dirty && ' •'}</button>
                {t.running && <Loader2 className="size-3 animate-spin" />}
                <Button variant="ghost" size="icon-xs" aria-label={`Close ${t.title}`} onClick={() => close(t.id)}><X /></Button>
              </div>
            ))}
            <Button variant="ghost" size="icon-sm" className="m-1" aria-label="New query tab" onClick={() => open('Untitled', '')}><Plus /></Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5">
          <ToggleGroup type="single" variant="outline" size="sm" value={tab.engine} onValueChange={(v) => v && patch(tab.id, { engine: v as Engine, result: undefined, kept: undefined, note: undefined })} aria-label="Engine">
            <ToggleGroupItem value="pg" className="gap-1.5 px-2.5"><Database className="text-oltp" /> PostgreSQL</ToggleGroupItem>
            <ToggleGroupItem value="spark" className="gap-1.5 px-2.5"><Sparkles className="text-olap" /> Spark</ToggleGroupItem>
          </ToggleGroup>
          {spark ? (
            <>
              <Select value={plId} onValueChange={(v) => { setPlId(v); setVersion('latest') }}>
                <SelectTrigger size="sm" aria-label="Source"><SelectValue placeholder="No pipelines" /></SelectTrigger>
                <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{plDb(p.db)} / <span className="font-mono text-[12.5px]">{p.branch}</span></SelectItem>)}</SelectContent>
              </Select>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger size="sm" aria-label="Version"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest version{pl ? ` (${fmtN(pl.version)})` : ''}</SelectItem>
                  {versions.slice(1).map((v) => <SelectItem key={v.n} value={String(v.n)}>Version {fmtN(v.n)}, {v.published.toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
              {version !== 'latest' && <BackingTag id="AN-01b" />}
              <Select value={profile} onValueChange={(v) => setProfile(v as typeof profile)}>
                <SelectTrigger size="sm" aria-label="Compute profile"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="compact">Compact compute</SelectItem><SelectItem value="analytical">Analytical compute</SelectItem></SelectContent>
              </Select>
            </>
          ) : (
            <>
              <span className="text-[13px] text-muted-foreground">Runs on <span className="font-mono text-[12.5px] text-foreground">{branchName}</span></span>
              <label className={cn('flex items-center gap-1.5 text-xs', writes ? 'font-medium text-warning' : 'text-muted-foreground')}><Switch checked={writes} onCheckedChange={setWrites} /> {writes ? 'Writes allowed' : 'Read only'}</label>
            </>
          )}
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger size="sm" aria-label="Row limit"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="100">100 rows</SelectItem><SelectItem value="200">200 rows</SelectItem><SelectItem value="1000">1,000 rows</SelectItem></SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSaveTitle(tab.title === 'Untitled' ? '' : tab.title); setSaveOpen(true) }}><Save /> Save</Button>
            {tab.running ? <Button variant="destructive" size="sm" onClick={cancel}><Square /> Cancel</Button> : <Button size="sm" onClick={run}><Play /> Run <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-[10px]">Ctrl ↵</kbd></Button>}
          </div>
        </div>
        {spark && pl && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-olap/8 px-3 py-1.5 text-[13px]">
            <span className="flex items-center gap-2"><Lock className="size-3 text-muted-foreground" aria-label="Read only" />Reading version <span className="tabular font-medium">{fmtN(vNum)}</span> of {plDb(pl.db)} / <span className="font-mono text-[12.5px]">{pl.branch}</span></span>
            <span className="text-muted-foreground">{version !== 'latest' ? `Published ${versions.find((v) => v.n === vNum)?.published.toLowerCase()}. Newer data exists.` : pl.mode === 'continuous' && pl.lagMs ? `${(pl.lagMs / 1000).toFixed(1)} s behind PostgreSQL when published` : `As of ${pl.lastSuccess.toLowerCase()}`}</span>
            <span className="ml-auto text-xs text-muted-foreground">{mine ? `Session ${mine.state}, expires in ${mine.expiresMin} min` : held ? 'The session moves to this version on the next run' : 'A session starts on the first run'}</span>
            <Link to="/analytics/sessions" className="text-xs text-primary hover:underline">{used} of {SLOTS} slots in use</Link>
          </div>
        )}
        {!spark && writes && branch.isDefault && (
          <div className="flex items-center gap-2 border-b bg-warning/10 px-3 py-1.5 text-[13px]"><AlertTriangle className="size-4 text-warning" /> Writes are enabled on the default branch <span className="font-mono">{branchName}</span>. Statements change live data immediately.</div>
        )}

        <SqlInput className="h-[38%] shrink-0 border-b" value={tab.sql} onChange={(v) => patch(tab.id, { sql: v, dirty: true })} onRun={run} />

        <Tabs defaultValue="results" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex items-center gap-3 border-b px-3 py-1">
            <TabsList><TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="plan">Query plan</TabsTrigger><TabsTrigger value="messages">Messages</TabsTrigger></TabsList>
            {spark && res?.kind === 'rows' && !tab.running && (
              tab.kept
                ? <Button variant="ghost" size="xs" onClick={() => patch(tab.id, { kept: undefined })}><X /> Clear comparison</Button>
                : <Button variant="ghost" size="xs" onClick={() => { patch(tab.id, { kept: { result: res, version: vNum } }); toast.message('Kept. Pick another version and run again to compare.') }}><Columns2 /> Keep to compare versions</Button>
            )}
            <div className="tabular ml-auto text-xs text-muted-foreground">
              {tab.running ? (tab.note ?? 'Running…') : res?.kind === 'rows' ? `${res.rows.length} rows in ${res.ms >= 1000 ? `${(res.ms / 1000).toFixed(1)} s` : `${res.ms} ms`}${tab.note ? `, ${tab.note}` : ''}` : res?.kind === 'command' ? `${res.message}, ${res.ms} ms` : res ? 'Failed' : 'Not run yet'}
            </div>
          </div>
          <TabsContent value="results" className="flex min-h-0 flex-1 flex-col">
            {tab.running ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {tab.note ?? (spark ? `Running on version ${fmtN(vNum)}…` : `Running on ${branchName}…`)}</div>
            ) : !res ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-muted-foreground">{spark ? 'Run a query against the published version. Results are limited to 1,000 rows.' : `Run a statement to see results. One statement per run, up to ${Number(limit).toLocaleString()} rows.`}</div>
            ) : res.kind === 'error' ? (
              <div className="m-3 rounded-md border border-destructive/40 bg-destructive/8 p-3">
                <div className="font-mono text-[13px] text-destructive">{res.message}</div>
                {res.hint && <div className="mt-1 text-[13px] text-muted-foreground">{res.hint}</div>}
              </div>
            ) : res.kind === 'command' ? (
              <div className="m-3 rounded-md border border-success/40 bg-success/8 p-3 font-mono text-[13px]">{res.message}</div>
            ) : tab.kept ? (
              <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
                {[{ label: `This run, version ${tab.note?.replace('version ', '') ?? fmtN(vNum)}`, r: res as Result }, { label: `Kept, version ${fmtN(tab.kept.version)}`, r: tab.kept.result }].map((x) => (
                  <div key={x.label} className="flex min-h-0 flex-col"><div className="border-b bg-muted/40 px-3 py-1 text-xs text-muted-foreground">{x.label}</div>{grid(x.r)}</div>
                ))}
              </div>
            ) : (
              <>
                {res.truncated && <div className="border-b bg-info/8 px-3 py-1 text-xs text-info">Showing the first {res.rows.length} rows. Add a LIMIT or raise the row limit to see more.</div>}
                {grid(res)}
              </>
            )}
          </TabsContent>
          <TabsContent value="plan" className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">{spark ? 'Physical plan, 3 stages, 4 Parquet files scanned' : 'EXPLAIN (ANALYZE, BUFFERS), planning 0.4 ms, execution 412.0 ms'} <BackingTag id="SQ-03b" /></div>
            <div className="rounded-md border">
              {PLAN.map((p, i) => (
                <div key={i} className="flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0">
                  <div className="min-w-0 flex-1" style={{ paddingLeft: p.d * 18 }}>
                    <div className="flex items-center gap-1 font-mono text-[13px]">{p.d > 0 && <ChevronRight className="size-3 text-muted-foreground" />}{spark ? p.node.replace('Seq Scan on', 'Scan parquet').replace('Hash Join', 'BroadcastHashJoin') : p.node}</div>
                    {p.detail && <div className="truncate pl-4 font-mono text-[11px] text-muted-foreground">{p.detail}</div>}
                  </div>
                  <div className="tabular w-24 text-right text-xs text-muted-foreground">{p.rows.toLocaleString()} rows</div>
                  <div className="tabular w-20 text-right text-xs">{p.ms} ms</div>
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', p.pct > 40 ? 'bg-warning' : spark ? 'bg-olap' : 'bg-primary')} style={{ width: `${p.pct}%` }} /></div>
                </div>
              ))}
            </div>
            {!spark && <p className="mt-2 text-xs text-muted-foreground">47% of the time is a sequential scan on orders. An index on orders(status) would not help here; most rows match.</p>}
          </TabsContent>
          <TabsContent value="messages" className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs text-muted-foreground">
            {res ? <>[14:05:31] {res.kind === 'error' ? res.message : res.kind === 'command' ? res.message : `SELECT ${res.rows.length}`}<br />[14:05:31] Query ID op_7f31c2, {spark ? `Spark, read only, version ${vNum}` : `${writes ? 'read-write' : 'read-only'} transaction, branch ${branchName}`}</> : 'No messages.'}
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
