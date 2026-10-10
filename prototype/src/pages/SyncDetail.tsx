import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertOctagon, ArrowLeft, ChevronRight, Coffee, Database, Layers, MoreHorizontal, Pause, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { MetricChart, timeAxis } from '@/components/charts'
import { BackingTag, ConfirmDelete, Section, Stat, StatusBadge } from '@/components/common'
import { Budget, ModeCards, ModeSettings } from '@/components/sync-parts'
import type { SyncConfig } from '@/components/sync-parts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { deltaType, fmtBytes, fmtEvery, fmtN, MODE_LABEL, runsFor, series, TABLES } from '@/lib/data'
import type { Pipeline } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { freshness } from './Sync'

const hex = (lsn: string) => parseInt(lsn.split('/')[1], 16)

/** PostgreSQL on the left, Delta on the right, and how far apart they are. */
function Flow({ p, dbName }: { p: Pipeline; dbName: string }) {
  const toCapture = Math.max(0, hex(p.sourceLsn) - hex(p.capturedLsn))
  const stopped = p.state === 'blocked' || p.state === 'paused'
  const live = p.mode === 'continuous' && !stopped
  const Link = ({ label, sub, dim }: { label: string; sub: string; dim?: boolean }) => (
    <div className="flex min-w-24 flex-1 flex-col items-center px-2 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="relative my-1.5 h-px w-full bg-border">
        <div className={cn('absolute inset-y-0 left-0 h-px', dim ? 'w-0' : 'w-full bg-gradient-to-r from-oltp to-olap')} />
        <ChevronRight className={cn('absolute -top-[7px] -right-1.5 size-3.5', dim ? 'text-border' : 'text-olap')} />
      </div>
      <div className="tabular text-xs">{sub}</div>
    </div>
  )
  const Node = ({ icon, title, name, lsn, tone }: { icon: React.ReactNode; title: string; name: React.ReactNode; lsn: string; tone: string }) => (
    <div className={cn('w-52 shrink-0 rounded-lg border bg-card p-3 shadow-[inset_3px_0_0_var(--tw-shadow-color)]', tone)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{title}</div>
      <div className="mt-1 truncate font-medium">{name}</div>
      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{lsn}</div>
    </div>
  )
  return (
    <div className="rounded-lg border bg-muted/30 p-5">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="tabular text-[1.9rem] leading-none font-semibold tracking-tight">
          {p.state === 'starting' ? 'First copy in progress' : live && p.lagMs !== null ? <>{(p.lagMs / 1000).toFixed(1)} s <span className="text-xl font-medium text-muted-foreground">behind PostgreSQL</span></> : <>As of {p.lastSuccess.toLowerCase()}</>}
        </div>
        {live && <div className="text-[13px] text-muted-foreground">target {p.freshnessMs / 1000} s</div>}
        {live && <div className="text-xs text-muted-foreground">Observed just now. Lag is measured, not promised.</div>}
      </div>
      <div className="flex items-center overflow-x-auto pb-1">
        <Node tone="shadow-oltp" icon={<Database className="size-3.5 text-oltp" />} title="PostgreSQL" name={<><span>{dbName}</span><span className="text-muted-foreground"> / </span><span className="font-mono text-[12.5px]">{p.branch}</span></>} lsn={`at ${p.sourceLsn}`} />
        {p.mode === 'snapshot' ? (
          <Link label="Full copy each run" sub={p.nextRun ? `next ${p.nextRun}` : 'manual'} dim={stopped} />
        ) : (
          <>
            <Link label="Capture" sub={toCapture ? `${fmtBytes(toCapture)} to read` : 'caught up'} dim={p.state === 'blocked'} />
            <Node tone="shadow-border" icon={<Layers className="size-3.5" />} title="Captured changes" name={`${fmtBytes(p.backlogBytes)} waiting`} lsn={`to ${p.capturedLsn}`} />
            <Link label={p.mode === 'continuous' ? 'Apply continuously' : 'Apply on each run'} sub={stopped ? 'stopped' : p.mode === 'continuous' ? `every ${p.batchMs / 1000} s or more` : p.nextRun ? `next ${p.nextRun}` : 'manual'} dim={stopped} />
          </>
        )}
        <Node tone="shadow-olap" icon={<span className="size-2 rounded-sm bg-olap" />} title="Delta tables" name={p.version ? <>Version <span className="tabular">{fmtN(p.version)}</span></> : 'Not published yet'} lsn={`as of ${p.publishedLsn}`} />
      </div>
    </div>
  )
}

function Overview({ p, dbName }: { p: Pipeline; dbName: string }) {
  const n = 48
  const data = useMemo(() => {
    const t = timeAxis(n, '1h')
    const base = p.mode === 'continuous' ? 3.1 : 420
    const lag = series(p.version % 97, n, base, base * 0.7), rows = series(p.version % 89 + 3, n, 52, 60)
    return t.map((label, i) => ({ t: label, lag: p.mode === 'continuous' ? Math.max(0.6, lag[i]) : p.state === 'blocked' ? 74000 + i * 75 : ((i * 37) % 900), rows: rows[i] }))
  }, [p.mode, p.version, p.state])
  const incremental = p.mode !== 'snapshot'
  return (
    <div className="grid gap-8">
      <Flow p={p} dbName={dbName} />
      {incremental && (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            <Stat label="Oldest unpublished change" value={p.state === 'blocked' ? 'Stopped' : p.lagMs === null ? (p.backlogBytes ? '11 min' : 'None') : `${(p.lagMs / 1000).toFixed(1)} s`} sub={p.state === 'blocked' ? `nothing published since ${p.lastSuccess.toLowerCase()}` : p.mode === 'continuous' ? `target ${p.freshnessMs / 1000} s` : 'published on the next run'} />
            <Stat label="Waiting to publish" value={fmtBytes(p.backlogBytes)} sub="captured, not yet in Delta" />
            <Budget label="Change history on disk" used={p.spoolBytes} />
            <Budget label="Write-ahead log kept" used={p.walBytes} />
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13px]">
            <Coffee className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>Change capture keeps the compute for <span className="font-mono text-[12.5px]">{p.branch}</span> awake, so idle suspend does not apply to this branch while the pipeline exists. Pausing stops publishing, not capture.</span>
          </div>
        </>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <MetricChart title={p.mode === 'continuous' ? 'Lag behind PostgreSQL, last hour' : 'Age of published data, last hour'} value={freshness(p)} unit=" s" kind="line" data={data} series={[{ key: 'lag', label: 'Lag', color: 'var(--chart-2)' }]} target={p.mode === 'continuous' ? { value: p.freshnessMs / 1000, label: `target ${p.freshnessMs / 1000} s` } : undefined} tag={<BackingTag id="SY-03b" />} />
        <MetricChart title="Rows published per second, last hour" value={p.mode === 'continuous' ? '50 rows/s' : 'Between runs'} data={data} series={[{ key: 'rows', label: 'Rows', color: 'var(--chart-1)' }]} tag={<BackingTag id="SY-03b" />} />
      </div>
    </div>
  )
}

function Runs({ p }: { p: Pipeline }) {
  const runs = runsFor(p)
  return (
    <Section title="Runs" flush description={p.mode === 'continuous' ? 'Continuous pipelines publish in small batches. Each batch that changed data is one run.' : 'Each run publishes one new version. Readers keep the version they opened until they ask for a newer one.'}>
      <Table>
        <TableHeader><TableRow><TableHead>Run</TableHead><TableHead>Started by</TableHead><TableHead>Started</TableHead><TableHead className="text-right">Duration</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Rows changed</TableHead><TableHead>Published</TableHead><TableHead>Up to position</TableHead></TableRow></TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
              <TableCell>{r.trigger}</TableCell>
              <TableCell className="tabular text-muted-foreground">{r.started}</TableCell>
              <TableCell className="tabular text-right">{r.seconds >= 60 ? `${Math.floor(r.seconds / 60)} m ${Math.round(r.seconds % 60)} s` : `${r.seconds.toFixed(1)} s`}</TableCell>
              <TableCell><StatusBadge status={r.state} />{r.error && <div className="text-xs text-destructive">{r.error}</div>}</TableCell>
              <TableCell className="tabular text-right">{r.rows ? fmtN(r.rows) : ''}</TableCell>
              <TableCell>{r.version ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-olap" />Version <span className="tabular">{fmtN(r.version)}</span></span> : <span className="text-muted-foreground">Nothing</span>}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{r.lsn}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

function Tables({ p }: { p: Pipeline }) {
  const [open, setOpen] = useState<string | null>(p.tables[0])
  return (
    <Section title="Tables" flush tag={<BackingTag id="SY-05" />} description="What each PostgreSQL table becomes in Delta. Types are mapped without losing information, or the table is not synced.">
      {p.tables.map((key) => {
        const t = TABLES.find((x) => `${x.schema}.${x.name}` === key)
        const isOpen = open === key
        return (
          <div key={key} className="border-b last:border-b-0">
            <button onClick={() => setOpen(isOpen ? null : key)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-muted/40">
              <ChevronRight className={cn('size-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
              <span className="font-mono font-medium">{key}</span>
              <span className="tabular ml-auto text-muted-foreground">{t ? `about ${fmtN(t.rows)} rows` : 'about 1,204,000 rows'}</span>
              <span className="tabular w-52 text-right whitespace-nowrap text-muted-foreground">last change {p.mode === 'continuous' ? 'seconds ago' : p.lastSuccess.toLowerCase()}</span>
            </button>
            {isOpen && t && (
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-1 border-t bg-muted/30 px-11 py-3 font-mono text-xs">
                <div className="font-sans text-muted-foreground">PostgreSQL column</div><div /><div className="font-sans text-muted-foreground">Delta column</div>
                {t.columns.map((c) => (
                  <div key={c.name} className="contents">
                    <div><span>{c.name}</span> <span className="text-oltp">{c.type}</span></div>
                    <ChevronRight className="size-3 self-center text-muted-foreground" />
                    <div><span>{c.name}</span> <span className="text-olap">{deltaType(c.type).delta ?? 'not synced'}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </Section>
  )
}

function Settings({ p, patch, onResync, onDelete }: { p: Pipeline; patch: (x: Partial<Pipeline>) => void; onResync: () => void; onDelete: () => void }) {
  const [cfg, setCfg] = useState<SyncConfig>({ mode: p.mode, everySeconds: p.everySeconds, freshnessMs: p.freshnessMs, batchMs: p.batchMs, storage: p.storage })
  const set = (x: Partial<SyncConfig>) => setCfg((c) => ({ ...c, ...x }))
  const dirty = (Object.keys(cfg) as (keyof SyncConfig)[]).some((k) => cfg[k] !== p[k])
  const crossing = (cfg.mode === 'snapshot') !== (p.mode === 'snapshot')
  return (
    <div className="grid gap-8">
      <Section title="Mode" description="Switching between triggered and continuous keeps the captured history. Switching to or from snapshot starts a new first copy.">
        <ModeCards value={cfg.mode} onChange={(mode) => set({ mode })} />
      </Section>
      <Section title="Settings" actions={<Button size="sm" disabled={!dirty || cfg.batchMs > cfg.freshnessMs} onClick={() => { patch({ ...cfg, everySeconds: cfg.mode === 'continuous' ? null : cfg.everySeconds, revision: p.revision + 1, state: cfg.mode === 'continuous' ? 'healthy' : 'idle', lagMs: cfg.mode === 'continuous' ? 2800 : null }); toast.success(crossing ? 'Saved. A new first copy has started.' : 'Settings saved') }}>Save changes</Button>}>
        <ModeSettings cfg={cfg} set={set} />
      </Section>
      <Section title="Danger zone">
        <div className="divide-y">
          {p.mode !== 'snapshot' && (
            <div className="flex items-center justify-between gap-4 pb-4">
              <div><div className="font-medium">Full resync</div><p className="text-xs text-muted-foreground">Discard captured history and copy every table again. Readers keep the current version until the new copy is published.</p></div>
              <Button variant="outline" onClick={onResync}>Review resync</Button>
            </div>
          )}
          <div className={cn('flex items-center justify-between gap-4', p.mode !== 'snapshot' && 'pt-4')}>
            <div><div className="font-medium">Delete this pipeline</div><p className="text-xs text-muted-foreground">Stops publishing and retires change capture. Published versions stay available to their readers.</p></div>
            <Button variant="destructive" onClick={onDelete}>Delete pipeline</Button>
          </div>
        </div>
      </Section>
    </div>
  )
}

export default function SyncDetail() {
  const { id, tab = 'overview' } = useParams()
  const { pipelines, setPipelines, databases } = useStore()
  const nav = useNavigate()
  const [resync, setResync] = useState(false)
  const [del, setDel] = useState(false)
  const p = pipelines.find((x) => x.id === id)
  if (!p) return <Navigate to="/sync" replace />
  const dbName = databases.find((d) => d.id === p.db)?.name ?? p.db
  const patch = (x: Partial<Pipeline>) => setPipelines((ps) => ps.map((y) => (y.id === p.id ? { ...y, ...x } : y)))
  const resting = p.mode === 'continuous' ? 'healthy' : 'idle'
  const runNow = () => { patch({ state: 'running' }); toast.success('Run started'); setTimeout(() => patch({ state: 'idle', lastSuccess: 'Just now', version: p.version + 1, backlogBytes: 0 }), 2500) }
  const doResync = () => {
    setResync(false); patch({ state: 'starting', blocked: undefined, backlogBytes: 0, spoolBytes: 0, walBytes: 0, revision: p.revision + 1 })
    toast.loading('Resync started. Copying tables again…', { id: p.id })
    setTimeout(() => { patch({ state: resting, version: p.version + 1, lastSuccess: 'Just now', lagMs: p.mode === 'continuous' ? 2600 : null }); toast.success('Resync complete. New version published.', { id: p.id }) }, 3500)
  }

  return (
    <>
      <button onClick={() => nav('/sync')} className="mb-3 flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Sync</button>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-[1.6rem] leading-tight font-semibold tracking-tight">{dbName}<span className="text-muted-foreground"> / </span><span className="font-mono text-[1.35rem]">{p.branch}</span></h1>
            <StatusBadge status={p.state} />
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {[['Mode', MODE_LABEL[p.mode]], [p.mode === 'continuous' ? 'Freshness target' : 'Schedule', p.mode === 'continuous' ? `${p.freshnessMs / 1000} s` : fmtEvery(p.everySeconds)], ['Tables', String(p.tables.length)], ['Created', p.created], ['Revision', String(p.revision)]].map(([k, v]) => (
              <div key={k} className="flex gap-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
        <div className="flex items-center gap-2">
          {p.mode !== 'continuous' && <Button variant="outline" disabled={p.state !== 'idle'} onClick={runNow}><RefreshCw className={cn(p.state === 'running' && 'animate-spin')} /> {p.state === 'running' ? 'Running' : 'Run now'}</Button>}
          {p.state === 'paused'
            ? <Button onClick={() => { patch({ state: resting }); toast.success('Pipeline resumed') }}><Play /> Resume</Button>
            : <Button variant="outline" disabled={p.state === 'blocked' || p.state === 'starting'} onClick={() => { patch({ state: 'paused' }); toast.success('Paused after the current batch') }}><Pause /> Pause</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => nav('/branches')}>View source branch</DropdownMenuItem>
              {p.mode !== 'snapshot' && <DropdownMenuItem onClick={() => setResync(true)}>Full resync…</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDel(true)}>Delete…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {p.blocked && (
        <div className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/6 px-4 py-3.5">
          <AlertOctagon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1"><div className="font-medium">{p.blocked.title}</div><p className="mt-0.5 max-w-[80ch] text-[13px] text-muted-foreground">{p.blocked.detail}</p></div>
          <Button size="sm" onClick={() => setResync(true)}>Review resync</Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(t) => nav(`/sync/${p.id}/${t}`)}>
        <TabsList variant="line" className="mb-6 h-10 w-full justify-start gap-1 border-b p-0">
          {['overview', 'runs', 'tables', 'settings'].map((t) => <TabsTrigger key={t} value={t} className="flex-none px-2.5 capitalize">{t}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><Overview p={p} dbName={dbName} /></TabsContent>
        <TabsContent value="runs"><Runs p={p} /></TabsContent>
        <TabsContent value="tables"><Tables p={p} /></TabsContent>
        <TabsContent value="settings"><Settings key={p.revision} p={p} patch={patch} onResync={() => setResync(true)} onDelete={() => setDel(true)} /></TabsContent>
      </Tabs>

      <Dialog open={resync} onOpenChange={setResync}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resync {dbName} / {p.branch} in full?</DialogTitle>
            <DialogDescription>Review what happens before approving.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-[13px]">
            <li>Captured change history ({fmtBytes(p.spoolBytes)}) is discarded and capture restarts from the branch's current state.</li>
            <li>All {p.tables.length} tables are copied again in full. Expect about 3 minutes for this branch.</li>
            <li>Version <span className="tabular">{fmtN(p.version)}</span> stays readable until the new copy is published. Open sessions and notebooks are not interrupted.</li>
            <li>Schema changes on the source since the pipeline started are picked up.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResync(false)}>Cancel</Button>
            <Button onClick={doResync}>Approve resync</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDelete
        open={del} onOpenChange={setDel} name={p.branch} kind="pipeline"
        consequence="The pipeline stops and its change capture is retired. Versions already published stay available to the sessions and notebooks reading them."
        onConfirm={() => { nav('/sync'); setPipelines((ps) => ps.filter((x) => x.id !== p.id)); toast.success('Pipeline deleted') }}
      />
    </>
  )
}
