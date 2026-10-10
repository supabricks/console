import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pause, Play, Plus, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, ConfirmDelete, PageHeader, StatusBadge } from '@/components/common'
import { Route } from '@/components/sync-parts'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtEvery, MODE_LABEL } from '@/lib/data'
import type { Pipeline } from '@/lib/data'
import { useStore } from '@/lib/store'

export function freshness(p: Pipeline): string {
  if (p.state === 'starting') return 'First copy in progress'
  if (p.mode === 'continuous') return p.state === 'paused' ? `Paused, as of ${p.lastSuccess}` : p.lagMs === null ? 'Lag unknown' : `${(p.lagMs / 1000).toFixed(1)} s behind`
  return `As of ${p.lastSuccess.toLowerCase()}`
}

export default function Sync() {
  const { pipelines, setPipelines, databases } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [del, setDel] = useState<Pipeline | null>(null)
  const dbName = (id: string) => databases.find((d) => d.id === id)?.name ?? id
  const rows = pipelines.filter((p) => `${dbName(p.db)} ${p.branch} ${p.mode}`.includes(q.toLowerCase()))
  const patch = (id: string, p: Partial<Pipeline>) => setPipelines((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)))

  return (
    <>
      <PageHeader
        title="Sync"
        description="Keep analytical tables current with PostgreSQL. A pipeline publishes a branch as Delta tables that Spark and notebooks can query. There are no connectors, queues or jobs to operate."
        actions={<Button onClick={() => nav('/sync/new')}><Plus /> New pipeline</Button>}
      />
      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-64"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="Filter pipelines" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-xs text-muted-foreground">{rows.length} pipelines</span>
        <BackingTag id="SY-01b" className="ml-1" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Pipeline</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Freshness</TableHead><TableHead>Schedule</TableHead><TableHead className="text-right">Tables</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className="h-11">
                <TableCell><Link to={`/sync/${p.id}`} className="hover:text-primary"><Route db={dbName(p.db)} branch={p.branch} version={p.state === 'starting' ? undefined : p.version} /></Link></TableCell>
                <TableCell>{MODE_LABEL[p.mode]}</TableCell>
                <TableCell><StatusBadge status={p.state} /></TableCell>
                <TableCell className={p.state === 'blocked' ? 'text-destructive' : undefined}>{p.state === 'blocked' ? `Stopped, as of ${p.lastSuccess.toLowerCase()}` : freshness(p)}</TableCell>
                <TableCell className="text-muted-foreground">{p.mode === 'continuous' ? `Target ${p.freshnessMs / 1000} s` : p.nextRun ? `${fmtEvery(p.everySeconds)}, next ${p.nextRun}` : fmtEvery(p.everySeconds)}</TableCell>
                <TableCell className="tabular text-right">{p.tables.length}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${dbName(p.db)} ${p.branch}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => nav(`/sync/${p.id}`)}>Open</DropdownMenuItem>
                      {p.mode !== 'continuous' && <DropdownMenuItem disabled={p.state !== 'idle'} onClick={() => { patch(p.id, { state: 'running' }); toast.success('Run started'); setTimeout(() => patch(p.id, { state: 'idle', lastSuccess: 'Just now', version: p.version + 1 }), 2500) }}><RefreshCw /> Run now</DropdownMenuItem>}
                      {p.state === 'paused'
                        ? <DropdownMenuItem onClick={() => { patch(p.id, { state: p.mode === 'continuous' ? 'healthy' : 'idle' }); toast.success('Pipeline resumed') }}><Play /> Resume</DropdownMenuItem>
                        : <DropdownMenuItem disabled={p.state === 'blocked'} onClick={() => { patch(p.id, { state: 'paused' }); toast.success('Pipeline paused') }}><Pause /> Pause</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDel(p)}>Delete…</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed px-4 py-3.5">
        <span className="inline-flex items-center gap-2 font-medium">
          <span className="size-2 rounded-sm bg-olap" /> Delta
          <svg width="22" height="8" viewBox="0 0 22 8" className="text-muted-foreground" aria-hidden><path d="M0 4h19M16 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="size-2 rounded-sm bg-oltp" /> PostgreSQL
        </span>
        <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">Serve analytical results from PostgreSQL as read-only tables, for features, scores and reference data your application reads at request time.</span>
        <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">Not available yet</span>
        <BackingTag id="SY-09" />
      </div>

      <ConfirmDelete
        open={!!del} onOpenChange={(o) => !o && setDel(null)} name={del?.branch ?? ''} kind="pipeline"
        consequence="The pipeline stops and its change capture is retired. Versions already published stay available to the sessions and notebooks reading them."
        onConfirm={() => { if (del) { setPipelines((ps) => ps.filter((x) => x.id !== del.id)); toast.success('Pipeline deleted') } }}
      />
    </>
  )
}
