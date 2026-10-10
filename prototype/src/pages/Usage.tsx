import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Who } from '@/components/access-parts'
import { MetricChart } from '@/components/charts'
import { BackingTag, PageHeader, Section, Stat } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PROJECT } from '@/lib/access'
import { series } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const HEAD = 'bg-muted/50 hover:bg-muted/50'
const gb = (n: number) => (n >= 10 ? n.toFixed(1) : n.toFixed(2))
const PARTS = [
  { key: 'data', label: 'PostgreSQL data', color: 'var(--oltp)', help: 'Rows and indexes on the default branch of each database.' },
  { key: 'history', label: 'Restore history', color: 'color-mix(in oklab, var(--oltp) 55%, transparent)', help: 'Changes kept so you can restore or branch from a past moment.' },
  { key: 'branches', label: 'Branches', color: 'color-mix(in oklab, var(--oltp) 28%, transparent)', help: 'Only what each branch changed since it was made.' },
  { key: 'analytics', label: 'Analytical tables', color: 'var(--olap)', help: 'Published versions of the tables Spark and notebooks read.' },
  { key: 'backups', label: 'Backups', color: 'var(--muted-foreground)', help: 'Backups kept on this server.' },
] as const
type Part = (typeof PARTS)[number]['key']
// GB per database. Only data size relates to figures shown elsewhere in the prototype.
const BY_DB: Record<string, Record<Part, number>> = {
  db_app: { data: 4.31, history: 1.2, branches: 0.62, analytics: 2.84, backups: 33.4 },
  db_billing: { data: 18.24, history: 3.9, branches: 0, analytics: 6.1, backups: 0 },
  db_scratch: { data: 0.21, history: 0.02, branches: 0, analytics: 0, backups: 0 },
}
const total = (r: Record<Part, number>) => PARTS.reduce((n, p) => n + r[p.key], 0)
const DISK_GB = 200

function Bar({ parts, max, className }: { parts: { label: string; value: number; color: string }[]; max: number; className?: string }) {
  return (
    <div className={cn('flex h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      {parts.filter((p) => p.value > 0).map((p) => <Tooltip key={p.label}><TooltipTrigger asChild><div style={{ width: `${(p.value / max) * 100}%`, background: p.color }} className="h-full border-r border-background last:border-r-0" /></TooltipTrigger><TooltipContent>{p.label}: {gb(p.value)} GB</TooltipContent></Tooltip>)}
    </div>
  )
}

const days = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 10 - (n - 1 - i))); return `${['Sep', 'Oct'][d.getUTCMonth() - 8]} ${d.getUTCDate()}` })

export default function Usage() {
  const { databases, jobs } = useStore()
  const [range, setRange] = useState('7')
  const n = +range, f = n / 7
  const sum = PARTS.map((p) => ({ ...p, value: databases.reduce((s, d) => s + (BY_DB[d.id]?.[p.key] ?? 0), 0) }))
  const all = sum.reduce((s, p) => s + p.value, 0)
  const t = days(n)
  const grow = t.map((d, i) => ({ t: d, oltp: +(27.1 + (i / (n - 1)) * 1.4 + series(3, n, 0, 0.2)[i]).toFixed(2), olap: +(7.9 + (i / (n - 1)) * 1.04).toFixed(2), backups: +(28.6 + (i / (n - 1)) * 4.8).toFixed(2) }))
  const slots = Array.from({ length: 56 }, (_, i) => ({ t: `Oct ${4 + Math.floor(i / 8)}`, people: Math.round(Math.min(2, series(11, 56, 0.9, 1.6)[i])), jobs: 0 })).map((p, i) => ({ ...p, jobs: Math.min(2 - p.people, i % 8 === 1 || i % 8 === 5 ? 1 : 0) }))
  const sessions: { who: string; kind: string; hours: number; count: number }[] = [
    { who: 'pr_priya', kind: 'Notebooks', hours: 31.5, count: 44 }, { who: 'pr_tomas', kind: 'Spark SQL', hours: 22.1, count: 61 }, { who: 'sv_nightly', kind: 'Jobs', hours: 14.8, count: 187 },
    { who: 'pr_daniel', kind: 'Notebooks', hours: 9.4, count: 12 }, { who: 'pr_kenji', kind: 'Spark SQL', hours: 3.2, count: 9 }, { who: 'pr_maya', kind: 'Spark SQL', hours: 1.1, count: 4 },
  ].map((s) => ({ ...s, hours: +(s.hours * f).toFixed(1), count: Math.round(s.count * f) }))
  const sessHours = sessions.reduce((s, x) => s + x.hours, 0)
  const compute = [{ db: 'db_app', hours: 151 }, { db: 'db_billing', hours: 168 }, { db: 'db_scratch', hours: 6.5 }].map((c) => ({ ...c, hours: +(c.hours * f).toFixed(1) }))
  const activity = [
    { kind: 'Job runs', to: '/jobs/runs', count: 196, failed: 3, time: '15 h 40 min' }, { kind: 'Sync runs', to: '/sync', count: 684, failed: 1, time: '4 h 12 min' },
    { kind: 'Notebook runs by people', to: '/notebooks', count: 312, failed: 27, time: '40 h 54 min' }, { kind: 'Spark SQL statements', to: '/analytics/sql', count: 1408, failed: 61, time: '26 h 24 min' },
    { kind: 'Backups', to: '/databases/app/backups', count: 8, failed: 1, time: '1 h 4 min' },
  ]
  const reclaim = [
    { what: 'Backups of app older than 7 days', size: 0, note: 'None. The schedule keeps 14 and has taken 8.', to: '/databases/app/backups' },
    { what: 'Analytical versions of billing / main nobody reads', size: 4.2, note: '26 versions, none pinned or in use', to: '/analytics/versions' },
    { what: 'Branch restore-oct-06 of app', size: 0.41, note: 'Suspended, not connected to since Oct 6', to: '/branches' },
    { what: 'Database scratch', size: 0.23, note: 'Suspended, last used Oct 2', to: '/databases/scratch' },
  ].filter((r) => r.size > 0)
  const limits: { name: string; limit: string; used: number; of: number; text: string; scope: string }[] = [
    { name: 'Analytical session slots', limit: '2 at a time', used: 0.49, of: 2, text: 'Both in use 9% of the time', scope: 'Shared with every project' },
    { name: 'Incremental sync capture', limit: '1 for the server', used: 1, of: 1, text: 'Held by this project (app)', scope: 'Other projects can only use snapshot sync' },
    { name: 'Change buffer', limit: '512 MiB', used: 425, of: 512, text: 'Peak 425 MiB on Oct 10', scope: 'Per capture' },
    { name: 'Database connections', limit: '256', used: 31, of: 256, text: 'Peak 31', scope: 'Shared with every project' },
    { name: 'Disk', limit: `${DISK_GB} GB`, used: all, of: DISK_GB, text: `${gb(all)} GB by this project, 109 GB by all`, scope: 'Shared with every project' },
  ]

  return (
    <div>
      <PageHeader title="Usage" tag={<BackingTag id="UQ-01" />} description={`What ${PROJECT} takes up on this server and how much it runs. Nothing here is billed; it is for seeing where space and capacity go.`}
        actions={<Select value={range} onValueChange={setRange}><SelectTrigger className="w-40" aria-label="Period"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="14">Last 14 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem></SelectContent></Select>} />
      <div className="mb-8 grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="Storage" value={`${gb(all)} GB`} sub={`${((all / DISK_GB) * 100).toFixed(0)}% of the disk, up ${gb(7.2 * f)} GB in the period`} />
        <Stat label="Database running time" value={`${Math.round(compute.reduce((s, c) => s + c.hours, 0))} h`} sub={`${databases.length} databases, ${n} days`} />
        <Stat label="Analytical session time" value={`${Math.round(sessHours)} h`} sub={`${Math.round((sessHours / (n * 24 * 2)) * 100)}% of the two slots`} />
        <Stat label="Runs" value={Math.round(activity.reduce((s, a) => s + a.count, 0) * f).toLocaleString('en-US')} sub="Jobs, sync, notebooks, queries, backups" />
      </div>

      <div className="grid gap-9">
        <Section title="Storage" description="Where the space goes. The two engines share nothing on disk except that analytical tables are built from PostgreSQL.">
          <Bar parts={sum} max={all} className="h-3.5" />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            {sum.map((p) => <Tooltip key={p.key}><TooltipTrigger asChild><span className="inline-flex cursor-help items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.label}<span className="tabular font-medium">{gb(p.value)} GB</span></span></TooltipTrigger><TooltipContent className="max-w-xs">{p.help}</TooltipContent></Tooltip>)}
          </div>
          <div className="-mx-4 mt-5 -mb-4 border-t">
            <Table>
              <TableHeader><TableRow className={HEAD}><TableHead className="pl-4">Database</TableHead>{PARTS.map((p) => <TableHead key={p.key} className="text-right">{p.label}</TableHead>)}<TableHead className="text-right">Total</TableHead><TableHead className="w-56 pr-4" /></TableRow></TableHeader>
              <TableBody>
                {databases.map((d) => { const r = BY_DB[d.id] ?? { data: d.storageMb / 1024, history: 0, branches: 0, analytics: 0, backups: 0 }; const max = Math.max(...databases.map((x) => total(BY_DB[x.id] ?? r))); return (
                  <TableRow key={d.id} className="h-11">
                    <TableCell className="pl-4"><Link to={`/databases/${d.name}`} className="inline-flex items-center gap-2 font-medium hover:text-primary"><span className="size-2 rounded-sm bg-oltp" />{d.name}</Link></TableCell>
                    {PARTS.map((p) => <TableCell key={p.key} className={cn('tabular text-right', !r[p.key] && 'text-muted-foreground')}>{r[p.key] ? gb(r[p.key]) : '0'}</TableCell>)}
                    <TableCell className="tabular text-right font-medium">{gb(total(r))} GB</TableCell>
                    <TableCell className="pr-4"><Bar parts={PARTS.map((p) => ({ label: p.label, value: r[p.key], color: p.color }))} max={max} /></TableCell>
                  </TableRow>
                ) })}
              </TableBody>
            </Table>
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <MetricChart title="Storage over time" value={`${gb(all)} GB`} unit=" GB" data={grow} series={[{ key: 'oltp', label: 'PostgreSQL, history and branches', color: 'var(--oltp)' }, { key: 'olap', label: 'Analytical tables', color: 'var(--olap)' }, { key: 'backups', label: 'Backups', color: 'var(--muted-foreground)' }]} kind="line" height={170} />
          <MetricChart title="Analytical session slots in use" value={`${(sessHours / (n * 24)).toFixed(2)} on average`} data={slots} series={[{ key: 'people', label: 'People', color: 'var(--olap)' }, { key: 'jobs', label: 'Jobs', color: 'var(--muted-foreground)' }]} target={{ value: 2, label: 'Limit 2' }} height={170} />
        </div>

        <Section flush title="Could be reclaimed" description="Things that take space and look unused. Nothing is removed unless you remove it.">
          <Table>
            <TableBody>
              {reclaim.map((r) => <TableRow key={r.what} className="h-12"><TableCell className="font-medium">{r.what}</TableCell><TableCell className="text-muted-foreground">{r.note}</TableCell><TableCell className="tabular w-28 text-right">{gb(r.size)} GB</TableCell><TableCell className="w-24 text-right"><Button variant="ghost" size="sm" asChild><Link to={r.to}>Review</Link></Button></TableCell></TableRow>)}
            </TableBody>
          </Table>
        </Section>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Section flush title="Database running time" description="A suspended database uses storage but no compute.">
            <Table>
              <TableHeader><TableRow className={HEAD}><TableHead>Database</TableHead><TableHead>Compute</TableHead><TableHead className="text-right">Running</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
              <TableBody>{compute.map((c) => { const d = databases.find((x) => x.id === c.db); if (!d) return null; const pct = c.hours / (n * 24); return (
                <TableRow key={c.db} className="h-11"><TableCell className="font-medium">{d.name}</TableCell><TableCell className="text-muted-foreground uppercase">{d.size}</TableCell><TableCell className="tabular text-right">{c.hours} h</TableCell><TableCell><span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-oltp" style={{ width: `${pct * 100}%` }} /></span><span className="tabular w-9 text-right text-xs text-muted-foreground">{Math.round(pct * 100)}%</span></span></TableCell></TableRow>
              ) })}</TableBody>
            </Table>
          </Section>
          <Section flush title="Analytical session time by who" tag={<BackingTag id="UQ-02" />} description="Who held the two session slots, people and jobs alike.">
            <Table>
              <TableHeader><TableRow className={HEAD}><TableHead>Who</TableHead><TableHead>Mostly</TableHead><TableHead className="text-right">Sessions</TableHead><TableHead className="text-right">Time</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
              <TableBody>{sessions.map((s) => (
                <TableRow key={s.who} className="h-11"><TableCell><Who subject={s.who} sub={false} /></TableCell><TableCell className="text-muted-foreground">{s.kind}</TableCell><TableCell className="tabular text-right">{s.count}</TableCell><TableCell className="tabular text-right">{s.hours} h</TableCell><TableCell><span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-olap" style={{ width: `${(s.hours / sessions[0].hours) * 100}%` }} /></span></TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </Section>
        </div>

        <Section flush title="Activity" description={`Work started in the last ${n} days. ${jobs.filter((j) => j.state === 'active').length} jobs are active.`}>
          <Table>
            <TableHeader><TableRow className={HEAD}><TableHead>Kind</TableHead><TableHead className="text-right">Started</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Total time</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>{activity.map((a) => <TableRow key={a.kind} className="h-11"><TableCell className="font-medium">{a.kind}</TableCell><TableCell className="tabular text-right">{Math.round(a.count * f).toLocaleString('en-US')}</TableCell><TableCell className={cn('tabular text-right', a.failed ? '' : 'text-muted-foreground')}>{Math.round(a.failed * f)}</TableCell><TableCell className="tabular text-right text-muted-foreground">{n === 7 ? a.time : 'about ' + Math.round(parseInt(a.time) * f) + ' h'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link to={a.to}>Open</Link></Button></TableCell></TableRow>)}</TableBody>
          </Table>
        </Section>

        <Section flush title="Limits" tag={<BackingTag id="UQ-03" />} description="The server has fixed limits that every project shares. This project has no limit of its own."
          actions={<Button variant="outline" size="sm" disabled>Set limits for this project</Button>}>
          <Table>
            <TableHeader><TableRow className={HEAD}><TableHead>Limit</TableHead><TableHead>Server allows</TableHead><TableHead className="w-64">This project</TableHead><TableHead>Shared how</TableHead></TableRow></TableHeader>
            <TableBody>{limits.map((l) => { const pct = l.used / l.of; return (
              <TableRow key={l.name} className="h-13"><TableCell className="font-medium">{l.name}</TableCell><TableCell className="tabular">{l.limit}</TableCell>
                <TableCell><span className="grid gap-1"><span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full', pct >= 0.8 ? 'bg-warning' : 'bg-foreground/60')} style={{ width: `${Math.min(100, pct * 100)}%` }} /></span><span className="text-xs text-muted-foreground">{l.text}</span></span></TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{l.scope}</TableCell></TableRow>
            ) })}</TableBody>
          </Table>
        </Section>
      </div>
    </div>
  )
}

const ALL = [
  { name: 'sales-analytics', storage: 71.07, dbHours: 325.5, sessHours: 82.1, runs: 2608, slotShare: 61, capture: true },
  { name: 'finance-ops', storage: 31.4, dbHours: 168, sessHours: 38.6, runs: 902, slotShare: 29, capture: false },
  { name: 'growth', storage: 6.5, dbHours: 12, sessHours: 13.3, runs: 141, slotShare: 10, capture: false },
]

export function AllUsage() {
  const used = ALL.reduce((s, p) => s + p.storage, 0)
  const tones = ['var(--foreground)', 'color-mix(in oklab, var(--foreground) 55%, transparent)', 'color-mix(in oklab, var(--foreground) 28%, transparent)']
  return (
    <div>
      <PageHeader title="Usage" tag={<BackingTag id="UQ-04" />} description="How the server’s space and capacity are divided between projects over the last 7 days." />
      <div className="mb-8 grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="Disk used" value={`${used.toFixed(0)} of ${DISK_GB} GB`} sub={`${Math.round((used / DISK_GB) * 100)}%, full in about 5 weeks at this rate`} />
        <Stat label="Session slots busy" value="40%" sub="Both in use 11% of the time" />
        <Stat label="Runs skipped for capacity" value="7" sub="No session slot was free" />
        <Stat label="Incremental capture" value="In use" sub="Held by sales-analytics" />
      </div>
      <div className="grid gap-8">
        <Section title="Disk" description="Everything each project stores: databases, history, branches, analytical tables and backups.">
          <Bar parts={ALL.map((p, i) => ({ label: p.name, value: p.storage, color: tones[i] }))} max={DISK_GB} className="h-3.5" />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">{ALL.map((p, i) => <span key={p.name} className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: tones[i] }} />{p.name}<span className="tabular font-medium">{gb(p.storage)} GB</span></span>)}<span className="inline-flex items-center gap-2 text-muted-foreground"><span className="size-2.5 rounded-sm bg-muted" />Free<span className="tabular">{gb(DISK_GB - used)} GB</span></span></div>
        </Section>
        <Section flush title="By project">
          <Table>
            <TableHeader><TableRow className={HEAD}><TableHead>Project</TableHead><TableHead className="text-right">Storage</TableHead><TableHead className="text-right">Database running time</TableHead><TableHead className="text-right">Session time</TableHead><TableHead className="w-56">Share of session slots</TableHead><TableHead className="text-right">Runs</TableHead><TableHead>Incremental capture</TableHead></TableRow></TableHeader>
            <TableBody>{ALL.map((p) => (
              <TableRow key={p.name} className="h-12">
                <TableCell className="font-medium">{p.name === PROJECT ? <Link to="/usage" className="hover:text-primary hover:underline">{p.name}</Link> : p.name}</TableCell>
                <TableCell className="tabular text-right">{gb(p.storage)} GB</TableCell><TableCell className="tabular text-right">{p.dbHours} h</TableCell><TableCell className="tabular text-right">{p.sessHours} h</TableCell>
                <TableCell><span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-olap" style={{ width: `${p.slotShare}%` }} /></span><span className="tabular w-9 text-right text-xs text-muted-foreground">{p.slotShare}%</span></span></TableCell>
                <TableCell className="tabular text-right">{p.runs.toLocaleString('en-US')}</TableCell><TableCell className={p.capture ? '' : 'text-muted-foreground'}>{p.capture ? 'Holds it' : 'Snapshot sync only'}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Section>
        <div className="rounded-lg border border-dashed p-4 text-[13px]">
          <div className="flex items-center gap-2 font-medium">Limits per project <BackingTag id="UQ-03" /></div>
          <p className="mt-1 max-w-[78ch] text-muted-foreground">Every limit on this server is shared: two analytical session slots, one incremental capture, one disk. A project cannot yet be given its own share, so one busy project can crowd out the others. This page shows when that is happening.</p>
        </div>
      </div>
    </div>
  )
}
