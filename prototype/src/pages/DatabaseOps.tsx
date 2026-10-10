import { useMemo, useState } from 'react'
import { ArrowRight, Pause, Play, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { MetricChart, timeAxis } from '@/components/charts'
import { BackingTag, Section, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ACTIVE_QUERIES, fmtN, series, SIZES, SLOW_QUERIES } from '@/lib/data'
import { useStore } from '@/lib/store'
import { SizePicker } from './Databases'

export function Compute() {
  const { db, setDatabases, dbBranches } = useStore()
  const [size, setSize] = useState(db.size)
  const [suspend, setSuspend] = useState(String(db.autosuspendMin))
  const [review, setReview] = useState(false)
  const cur = SIZES.find((s) => s.id === db.size)!
  const next = SIZES.find((s) => s.id === size)!
  const running = db.state === 'running'
  const patch = (p: Partial<typeof db>) => setDatabases((ds) => ds.map((d) => (d.id === db.id ? { ...d, ...p } : d)))

  const apply = () => {
    setReview(false)
    patch({ state: 'provisioning' })
    toast.loading(`Resizing ${db.name} to ${next.label}…`, { id: 'resize' })
    setTimeout(() => { patch({ size, state: 'running' }); toast.success(`${db.name} is now ${next.label} (${next.vcpu} vCPU, ${next.memGb} GB)`, { id: 'resize' }) }, 2000)
  }

  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Current size" value={cur.label} sub={`${cur.vcpu} vCPU, ${cur.memGb} GB RAM`} />
        <Stat label="CPU now" value="34%" sub="Peak 81% in the last 24 h" tag={<BackingTag id="DB-07" />} />
        <Stat label="Memory now" value="61%" sub={`${(cur.memGb * 0.61).toFixed(1)} of ${cur.memGb} GB`} tag={<BackingTag id="DB-07" />} />
        <Stat label="Connections" value={`${db.connections} / ${cur.maxConn}`} sub="Limit set by compute size" />
      </div>
      <Section
        title="Compute size"
        tag={<BackingTag id="DB-06b" />}
        description="Applies to the default branch. Child branches start at Extra small and can be resized on their own."
        actions={<Button size="sm" disabled={size === db.size || db.state !== 'running'} onClick={() => setReview(true)}>Review change</Button>}
      >
        <SizePicker value={size} onChange={setSize} />
        {size !== db.size && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
            {cur.label} <ArrowRight className="size-3.5" /> <span className="font-medium text-foreground">{next.label}</span>
           , connections are dropped once while the compute restarts (about 5 seconds).
          </p>
        )}
      </Section>
      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Suspend when idle" tag={<BackingTag id="DB-06c" />} description="A suspended compute uses no CPU or memory. Data is kept; the next connection wakes it.">
          <div className="flex items-end gap-3">
            <div className="grid flex-1 gap-1.5">
              <Label>Idle timeout</Label>
              <Select value={suspend} onValueChange={setSuspend}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">After 5 minutes</SelectItem><SelectItem value="30">After 30 minutes</SelectItem><SelectItem value="60">After 1 hour</SelectItem><SelectItem value="0">Never (always on)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" disabled={suspend === String(db.autosuspendMin)} onClick={() => { patch({ autosuspendMin: Number(suspend) }); toast.success('Idle timeout updated') }}>Save</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Typical wake time on this device: 1.8 s to first query.</p>
        </Section>
        <Section title="Run state" description="Suspend or resume the default branch's compute now.">
          <div className="flex items-center justify-between gap-3">
            <div>
              <StatusBadge status={db.state} />
              <p className="mt-2 text-xs text-muted-foreground">{running ? `${db.connections} open connections will be closed on suspend.` : 'No compute is running for this database.'}</p>
            </div>
            <Button variant="outline" disabled={db.state === 'provisioning'} onClick={() => { patch({ state: running ? 'suspended' : 'running', connections: running ? 0 : 1 }); toast.success(running ? 'Compute suspended' : 'Compute resumed') }}>
              {running ? <><Pause /> Suspend now</> : <><Play /> Resume now</>}
            </Button>
          </div>
        </Section>
      </div>
      <Section flush title="Compute by branch" description="Each branch has its own compute. Suspended branches cost nothing to keep.">
        <Table>
          <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>State</TableHead><TableHead>Size</TableHead><TableHead className="w-56">CPU (last hour)</TableHead><TableHead className="text-right">Connections</TableHead></TableRow></TableHeader>
          <TableBody>
            {dbBranches.map((b, i) => {
              const cpu = b.state === 'running' ? [34, 12, 6, 0, 0, 58][i % 6] : 0
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-[13px]">{b.name}</TableCell>
                  <TableCell><StatusBadge status={b.state} /></TableCell>
                  <TableCell>{b.isDefault ? cur.label : 'Extra small'}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><Progress value={cpu} className="h-1.5" /><span className="tabular w-9 text-right text-xs text-muted-foreground">{cpu}%</span></div></TableCell>
                  <TableCell className="tabular text-right">{b.state === 'running' ? (b.isDefault ? db.connections : 1) : 0}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Section>
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resize {db.name}?</DialogTitle>
            <DialogDescription>Review what changes before applying.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-3 gap-y-2 rounded-md border bg-muted/40 p-3 text-[13px]">
            <dt className="text-muted-foreground">CPU</dt><dd className="tabular">{cur.vcpu} vCPU</dd><ArrowRight className="size-3.5 text-muted-foreground" /><dd className="tabular font-medium">{next.vcpu} vCPU</dd>
            <dt className="text-muted-foreground">Memory</dt><dd className="tabular">{cur.memGb} GB</dd><ArrowRight className="size-3.5 text-muted-foreground" /><dd className="tabular font-medium">{next.memGb} GB</dd>
            <dt className="text-muted-foreground">Connections</dt><dd className="tabular">{cur.maxConn}</dd><ArrowRight className="size-3.5 text-muted-foreground" /><dd className="tabular font-medium">{next.maxConn}</dd>
          </dl>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
            <li>The compute restarts once. {db.connections} open connections are dropped and must reconnect.</li>
            <li>No data is moved or copied. Storage is unaffected.</li>
            <li>In-flight transactions are rolled back.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(false)}>Cancel</Button>
            <Button onClick={apply}>Resize to {next.label}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function Observability() {
  const { db, branchName } = useStore()
  const [range, setRange] = useState('1h')
  const [cancelled, setCancelled] = useState<number[]>([])
  const n = 48
  const data = useMemo(() => {
    const t = timeAxis(n, range)
    const seed = range.length * 7 + db.name.length
    const conn = series(seed + 1, n, 18, 14), idle = series(seed + 2, n, 6, 5)
    const tps = series(seed + 3, n, 420, 260), rb = series(seed + 4, n, 4, 5)
    const p50 = series(seed + 5, n, 2.2, 1.4), p95 = series(seed + 6, n, 14, 12), p99 = series(seed + 7, n, 48, 50)
    const cpu = series(seed + 8, n, 36, 34), mem = series(seed + 9, n, 60, 10)
    const hit = series(seed + 10, n, 98.6, 1.6), wal = series(seed + 11, n, 1.8, 2.2)
    return t.map((label, i) => ({
      t: label, active: conn[i], idle: idle[i], commits: tps[i], rollbacks: rb[i], p50: p50[i], p95: p95[i], p99: p99[i],
      cpu: Math.min(100, cpu[i]), mem: Math.min(100, mem[i]), hit: Math.min(100, hit[i]), wal: wal[i], storage: 4.1 + i * 0.004,
    }))
  }, [range, db.name])
  const last = data[n - 1]
  const c = (i: number) => `var(--chart-${i})`

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          Metrics for branch <span className="font-mono text-foreground">{branchName}</span> <BackingTag id="DB-07" />
        </div>
        <ToggleGroup type="single" variant="outline" size="sm" value={range} onValueChange={(v) => v && setRange(v)}>
          {['1h', '6h', '24h', '7d'].map((r) => <ToggleGroupItem key={r} value={r} className="px-3">{r}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Transactions / s" value={fmtN(Math.round(last.commits))} sub="Commits, current" />
        <Stat label="Query latency p95" value={`${last.p95.toFixed(1)} ms`} sub={`p50 ${last.p50.toFixed(1)} ms, p99 ${last.p99.toFixed(0)} ms`} />
        <Stat label="Cache hit ratio" value={`${last.hit.toFixed(1)}%`} sub="Shared buffers and local file cache" />
        <Stat label="Longest transaction" value="4 m 51 s" sub="pid 48102, idle in transaction" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <MetricChart title="Connections" value={`${Math.round(last.active + last.idle)} open`} data={data} series={[{ key: 'active', label: 'Active', color: c(1) }, { key: 'idle', label: 'Idle', color: c(2) }]} />
        <MetricChart title="Transactions per second" value={fmtN(Math.round(last.commits))} data={data} series={[{ key: 'commits', label: 'Commits', color: c(1) }, { key: 'rollbacks', label: 'Rollbacks', color: c(4) }]} />
        <MetricChart title="Query latency" value={`${last.p95.toFixed(1)} ms p95`} unit=" ms" kind="line" data={data} series={[{ key: 'p50', label: 'p50', color: c(2) }, { key: 'p95', label: 'p95', color: c(1) }, { key: 'p99', label: 'p99', color: c(3) }]} />
        <MetricChart title="CPU and memory" value={`${last.cpu.toFixed(0)}% CPU`} unit="%" kind="line" data={data} series={[{ key: 'cpu', label: 'CPU', color: c(1) }, { key: 'mem', label: 'Memory', color: c(5) }]} />
        <MetricChart title="Storage" value={`${last.storage.toFixed(2)} GB`} unit=" GB" data={data} series={[{ key: 'storage', label: 'Used', color: c(2) }]} />
        <MetricChart title="WAL generated" value={`${last.wal.toFixed(1)} MB/min`} unit=" MB" data={data} series={[{ key: 'wal', label: 'WAL', color: c(3) }]} />
      </div>
      <Section title="Queries" description="What the database is spending its time on.">
        <Tabs defaultValue="slow">
          <TabsList><TabsTrigger value="slow">Slowest queries</TabsTrigger><TabsTrigger value="active">Running now ({ACTIVE_QUERIES.length - cancelled.length})</TabsTrigger><TabsTrigger value="locks">Locks (1)</TabsTrigger></TabsList>
          <TabsContent value="slow" className="mt-3">
            <Table>
              <TableHeader><TableRow><TableHead>Query</TableHead><TableHead className="text-right">Calls</TableHead><TableHead className="text-right">Mean</TableHead><TableHead className="text-right">p95</TableHead><TableHead className="text-right">Rows</TableHead><TableHead className="w-40">Share of total time</TableHead></TableRow></TableHeader>
              <TableBody>
                {SLOW_QUERIES.map((q) => (
                  <TableRow key={q.q}>
                    <TableCell className="max-w-md truncate font-mono text-xs" title={q.q}>{q.q}</TableCell>
                    <TableCell className="tabular text-right">{fmtN(q.calls)}</TableCell>
                    <TableCell className="tabular text-right">{q.mean} ms</TableCell>
                    <TableCell className="tabular text-right">{q.p95} ms</TableCell>
                    <TableCell className="tabular text-right">{fmtN(q.rows)}</TableCell>
                    <TableCell><div className="flex items-center gap-2"><Progress value={q.share} className="h-1.5" /><span className="tabular w-8 text-right text-xs text-muted-foreground">{q.share}%</span></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="active" className="mt-3">
            <Table>
              <TableHeader><TableRow><TableHead>PID</TableHead><TableHead>Role</TableHead><TableHead>State</TableHead><TableHead>Running for</TableHead><TableHead>Waiting on</TableHead><TableHead>Query</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {ACTIVE_QUERIES.filter((q) => !cancelled.includes(q.pid)).map((q) => (
                  <TableRow key={q.pid}>
                    <TableCell className="tabular font-mono text-xs">{q.pid}</TableCell>
                    <TableCell>{q.role}</TableCell>
                    <TableCell><StatusBadge status={q.state} /></TableCell>
                    <TableCell className="tabular">{q.dur}</TableCell>
                    <TableCell className="text-muted-foreground">{q.wait || 'Nothing'}</TableCell>
                    <TableCell className="max-w-sm truncate font-mono text-xs" title={q.q}>{q.q}</TableCell>
                    <TableCell><Button variant="ghost" size="icon-sm" aria-label={`Cancel query ${q.pid}`} onClick={() => { setCancelled((x) => [...x, q.pid]); toast.success(`Cancelled pid ${q.pid}`) }}><XCircle /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="locks" className="mt-3">
            <Table>
              <TableHeader><TableRow><TableHead>Blocked</TableHead><TableHead>Blocked by</TableHead><TableHead>Lock</TableHead><TableHead>On</TableHead><TableHead>Waiting for</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs">47998, app_owner</TableCell>
                  <TableCell className="font-mono text-xs">48102, app_rw (idle in transaction)</TableCell>
                  <TableCell>Row exclusive</TableCell>
                  <TableCell className="font-mono text-xs">public.customers, id = 1042</TableCell>
                  <TableCell className="tabular">00:00:00.1</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  )
}
