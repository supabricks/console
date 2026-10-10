import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, CheckCircle2, Code2, MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Square, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { SubjectPicker, Who } from '@/components/access-parts'
import { BackingTag, ConfirmDelete, PageHeader, Section, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAccess } from '@/lib/access'
import { fmtN, SAVED_QUERIES } from '@/lib/data'
import { DAYS, describeTrigger, fmtDur, nextRuns, REVISIONS } from '@/lib/jobs'
import type { Job, JobRun, JobTrigger, RunState } from '@/lib/jobs'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const HEAD = 'bg-muted/50 hover:bg-muted/50'
const BOX = 'overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-3'
const BAR: Record<RunState, string> = { succeeded: 'bg-success', failed: 'bg-destructive', running: 'bg-info animate-pulse', queued: 'bg-info/50', cancelled: 'bg-warning', skipped: 'bg-muted-foreground/40' }

function usePipelineName() {
  const { pipelines, databases } = useStore()
  return (id: string) => { const p = pipelines.find((x) => x.id === id); return p ? `${databases.find((d) => d.id === p.db)?.name} / ${p.branch}` : id }
}

/** Starting, stopping and retrying runs, shared by every jobs screen. */
function useRuns() {
  const { jobRuns, setJobRuns } = useStore()
  const set = (id: string, p: Partial<JobRun>) => setJobRuns((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const start = (job: Job, trigger: JobRun['trigger'] = 'Manual', attempt = 1) => {
    const n = Math.max(0, ...jobRuns.filter((r) => r.job === job.id).map((r) => r.n)) + (trigger === 'Retry' ? 0 : 1)
    const id = `run_${Date.now()}`
    setJobRuns((rs) => [{ id, job: job.id, n, trigger, state: 'queued', started: 'Oct 10, 14:05', seconds: 0, attempt, version: null, by: 'Maya Okafor' }, ...rs])
    setTimeout(() => set(id, { state: 'running', seconds: 3, version: job.task.engine === 'PostgreSQL' ? null : 4169 }), 900)
    setTimeout(() => setJobRuns((rs) => rs.map((r) => (r.id === id && r.state === 'running' ? { ...r, state: 'succeeded', seconds: job.task.kind === 'query' ? 18 : 284, rows: job.task.kind === 'query' ? 4 : undefined } : r))), 4200)
    toast.success(`${job.name} started`, { description: 'It runs with the job’s identity, not yours.' })
  }
  const stop = (r: JobRun) => { set(r.id, { state: 'cancelled', error: 'Stopped by Maya Okafor.' }); toast.success('Run stopped') }
  return { start, stop }
}

function Dots({ runs }: { runs: JobRun[] }) {
  const last = runs.slice(0, 12).reverse()
  return (
    <span className="inline-flex h-5 items-end gap-0.5" aria-label={`Last ${last.length} runs`}>
      {last.map((r) => <Tooltip key={r.id}><TooltipTrigger asChild><span className={cn('w-1.5 rounded-sm', BAR[r.state], r.state === 'skipped' ? 'h-2' : 'h-5')} /></TooltipTrigger><TooltipContent><span className="capitalize">{r.state}</span>, {r.started}</TooltipContent></Tooltip>)}
      {last.length === 0 && <span className="text-[13px] text-muted-foreground">No runs yet</span>}
    </span>
  )
}

function TaskLabel({ job }: { job: Job }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      {job.task.kind === 'notebook' ? <BookOpen className="size-3.5 shrink-0 text-olap" /> : <Code2 className={cn('size-3.5 shrink-0', job.task.engine === 'PostgreSQL' ? 'text-oltp' : 'text-olap')} />}
      <span className="truncate">{job.task.ref}{job.task.kind === 'query' && `, ${job.task.engine}`}</span>
    </span>
  )
}

const STEPS = ['Queued', 'Got a session slot', 'Environment ready', 'Ran', 'Output saved']
function reached(r: JobRun) { return r.state === 'succeeded' ? 5 : r.state === 'queued' ? 1 : r.state === 'skipped' ? 1 : r.state === 'running' ? 3 : 3 }

function RunSheet({ run, onClose }: { run: JobRun | null; onClose: () => void }) {
  const { jobs, jobRuns } = useStore()
  const { start, stop } = useRuns()
  const nav = useNavigate()
  const r = run && (jobRuns.find((x) => x.id === run.id) ?? run)
  const job = r && jobs.find((j) => j.id === r.job)
  const done = r ? reached(r) : 0
  const bad = r && (r.state === 'failed' || r.state === 'skipped' || r.state === 'cancelled')
  const resolved = (v: string) => v.replace('{{ run.date }}', '2026-10-09').replace('{{ run.started_at }}', '2026-10-10T02:30:00Z').replace('{{ data.version }}', String(r?.version ?? ''))
  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {r && job && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">Run {r.n}{r.attempt > 1 && <span className="text-[13px] font-normal text-muted-foreground">attempt {r.attempt}</span>}<StatusBadge status={r.state} /></SheetTitle>
              <SheetDescription><Link to={`/jobs/${job.id}`} className="font-mono text-[13px] hover:underline" onClick={onClose}>{job.name}</Link></SheetDescription>
            </SheetHeader>
            <div className="grid min-w-0 grid-cols-1 gap-6 px-4 pb-6 [&>*]:min-w-0">
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2 text-[13px] [&_dt]:text-muted-foreground">
                <dt>Started</dt><dd className="tabular">{r.started} UTC</dd>
                <dt>Took</dt><dd className="tabular">{r.state === 'running' ? 'Running now' : fmtDur(r.seconds) || 'Did not start'}</dd>
                <dt>Started by</dt><dd>{r.trigger === 'Schedule' ? 'Schedule' : r.trigger === 'Retry' ? 'Automatic retry' : r.by}</dd>
                <dt>Ran as</dt><dd><Who subject={job.runAs} sub={false} /></dd>
                <dt>Ran</dt><dd className="min-w-0 truncate font-mono text-[12.5px]">{job.task.ref} @ {job.task.revision}</dd>
                <dt>Data read</dt><dd>{r.version ? <Link to="/analytics/versions" className="text-primary hover:underline">Analytical version <span className="tabular">{fmtN(r.version)}</span></Link> : job.task.engine === 'PostgreSQL' ? 'PostgreSQL, app / main, live' : <span className="text-muted-foreground">None</span>}</dd>
              </dl>

              <ol className="grid gap-0">
                {STEPS.map((s, i) => {
                  const ok = i < done, failedHere = bad && i === done
                  return (
                    <li key={s} className="flex gap-3 text-[13px]">
                      <span className="flex flex-col items-center"><span className={cn('mt-1 size-2.5 rounded-full border-[1.5px]', ok ? 'border-success bg-success' : failedHere ? 'border-destructive bg-destructive' : r.state === 'running' && i === done ? 'animate-pulse border-info bg-info' : 'border-border')} />{i < STEPS.length - 1 && <span className={cn('w-px flex-1', ok ? 'bg-success/50' : 'bg-border')} />}</span>
                      <span className={cn('pb-3', !ok && !failedHere && !(r.state === 'running' && i === done) && 'text-muted-foreground')}>{failedHere ? (r.state === 'skipped' ? 'No session slot became free' : r.state === 'cancelled' ? 'Stopped while running' : 'Failed while running') : s}</span>
                    </li>
                  )
                })}
              </ol>

              {r.error && <div className="-mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{r.error}</div>}

              {job.params.length > 0 && (
                <div>
                  <div className="mb-2 text-[13px] font-medium">Parameters</div>
                  <div className="divide-y rounded-md border font-mono text-[12.5px]">{job.params.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-3 py-1.5"><span>{k}</span><span className="text-muted-foreground">{resolved(v)}</span></div>)}</div>
                </div>
              )}

              {r.state === 'succeeded' && (
                <div>
                  <div className="mb-2 text-[13px] font-medium">Output</div>
                  {job.task.kind === 'notebook' ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-[13px]"><span><span className="font-medium">Executed copy of the notebook</span><span className="block text-muted-foreground">4 cells ran. Outputs are saved with the run; your notebook is not changed.</span></span><Button variant="outline" size="sm" onClick={() => { onClose(); nav(`/notebooks/${encodeURIComponent(job.task.ref)}`) }}>Open</Button></div>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <Table><TableHeader><TableRow className={HEAD}><TableHead>region</TableHead><TableHead className="text-right">revenue</TableHead></TableRow></TableHeader>
                        <TableBody>{[['EMEA', '1,284,310.50'], ['AMER', '1,102,945.20'], ['APAC', '688,120.75'], ['LATAM', '241,008.10']].slice(0, r.rows ?? 4).map(([a, b]) => <TableRow key={a}><TableCell className="pl-3 font-mono text-[12.5px]">{a}</TableCell><TableCell className="tabular pr-3 text-right font-mono text-[12.5px]">{b}</TableCell></TableRow>)}</TableBody></Table>
                      <div className="border-t bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">{r.rows} rows. Kept with the run.</div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="mb-2 text-[13px] font-medium">Log</div>
                <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {[`${r.started.split(', ')[1]}:00  queued (${r.trigger.toLowerCase()})`,
                    r.state === 'skipped' ? `${r.started.split(', ')[1]}:00  waiting for a session slot (2 of 2 in use)\n${r.started.split(', ')[1]}:00  start window of 10 min passed, run skipped` : `${r.started.split(', ')[1]}:02  session slot acquired${r.version ? `, pinned to version ${r.version}` : ''}`,
                    done >= 3 && `${r.started.split(', ')[1]}:04  environment revision 6 ready`,
                    done >= 3 && `${r.started.split(', ')[1]}:05  running ${job.task.ref} @ ${job.task.revision} as ${job.runAs}`,
                    r.state === 'failed' && `error: ${r.error}`, r.state === 'cancelled' && 'cancelled on request',
                    r.state === 'succeeded' && `finished in ${fmtDur(r.seconds)}, output saved`].filter(Boolean).join('\n')}
                </pre>
              </div>

              <div className="flex gap-2">
                {(r.state === 'running' || r.state === 'queued') && <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => stop(r)}><Square /> Stop run</Button>}
                {bad && <Button variant="outline" onClick={() => { start(job, 'Manual'); onClose() }}><RotateCcw /> Run again</Button>}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function RunsTable({ runs, showJob }: { runs: JobRun[]; showJob?: boolean }) {
  const { jobs } = useStore()
  const [open, setOpen] = useState<JobRun | null>(null)
  return (
    <>
      <div className={BOX}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead className="w-24">Run</TableHead>{showJob && <TableHead>Job</TableHead>}<TableHead>Status</TableHead><TableHead>Started (UTC)</TableHead><TableHead className="text-right">Took</TableHead><TableHead>Started by</TableHead><TableHead className="text-right">Data version</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id} className="h-11 cursor-pointer" onClick={() => setOpen(r)}>
                <TableCell className="tabular font-medium">{r.n}{r.attempt > 1 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">try {r.attempt}</span>}</TableCell>
                {showJob && <TableCell className="font-mono text-[13px]">{jobs.find((j) => j.id === r.job)?.name}</TableCell>}
                <TableCell><StatusBadge status={r.state} /></TableCell>
                <TableCell className="tabular text-muted-foreground">{r.started}</TableCell>
                <TableCell className="tabular text-right">{r.state === 'running' ? 'Running' : fmtDur(r.seconds)}</TableCell>
                <TableCell className="text-muted-foreground">{r.trigger === 'Schedule' ? 'Schedule' : r.trigger === 'Retry' ? 'Retry' : r.by}</TableCell>
                <TableCell className="tabular text-right text-muted-foreground">{r.version ? fmtN(r.version) : ''}</TableCell>
                <TableCell className={cn('max-w-64 truncate', r.error ? (r.state === 'failed' ? 'text-destructive' : 'text-muted-foreground') : 'text-muted-foreground')}>{r.error ?? (r.rows ? `${r.rows} rows` : '')}</TableCell>
              </TableRow>
            ))}
            {runs.length === 0 && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No runs match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <RunSheet run={open} onClose={() => setOpen(null)} />
    </>
  )
}

export default function Jobs() {
  const { jobs, setJobs, jobRuns } = useStore()
  const { start } = useRuns()
  const nav = useNavigate()
  const pname = usePipelineName()
  const [q, setQ] = useState('')
  const [del, setDel] = useState<Job | null>(null)
  const today = jobRuns.filter((r) => r.started.startsWith('Oct 10'))
  const rows = jobs.filter((j) => `${j.name} ${j.task.ref}`.toLowerCase().includes(q.toLowerCase()))
  const failing = jobs.filter((j) => jobRuns.find((r) => r.job === j.id)?.state === 'failed')

  return (
    <div>
      <PageHeader title="Jobs" tag={<BackingTag id="JB-01" />} description="Run a notebook or a saved query without anyone at the keyboard: on a schedule, or each time fresh data arrives from PostgreSQL."
        actions={<Button onClick={() => nav('/jobs/new')}><Plus /> New job</Button>} />
      <div className="mb-7 grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="Active jobs" value={jobs.filter((j) => j.state === 'active').length} sub={`${jobs.filter((j) => j.state === 'paused').length} paused`} />
        <Stat label="Runs today" value={today.length} sub={`${today.filter((r) => r.state === 'succeeded').length} succeeded`} />
        <Stat label="Needs attention" value={failing.length} sub={failing.length ? failing.map((j) => j.name).join(', ') : 'Every job’s last run succeeded'} />
        <Stat label="Next run" value="15:05" sub="revenue-by-region-hourly" />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter jobs" aria-label="Filter jobs" className="h-8 w-64 pl-8" /></div>
        <span className="text-xs text-muted-foreground">{rows.length} jobs</span>
      </div>
      <div className={BOX}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead>Job</TableHead><TableHead>When</TableHead><TableHead>Recent runs</TableHead><TableHead>Last run</TableHead><TableHead>Next run</TableHead><TableHead>Runs as</TableHead><TableHead className="w-36" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((j) => {
              const runs = jobRuns.filter((r) => r.job === j.id), last = runs[0]
              return (
                <TableRow key={j.id} className="h-14 cursor-pointer" onClick={() => nav(`/jobs/${j.id}`)}>
                  <TableCell><div className={cn('font-mono text-[13px] font-medium', j.state === 'paused' && 'text-muted-foreground')}>{j.name}</div><TaskLabel job={j} /></TableCell>
                  <TableCell className="text-[13px]">{describeTrigger(j.trigger, pname)}</TableCell>
                  <TableCell><Dots runs={runs} /></TableCell>
                  <TableCell>{last ? <span className="grid leading-tight"><StatusBadge status={last.state} /><span className="tabular text-xs text-muted-foreground">{last.started}</span></span> : <span className="text-muted-foreground">Never</span>}</TableCell>
                  <TableCell className={cn('tabular text-[13px]', !j.nextRun && 'text-muted-foreground')}>{j.state === 'paused' ? 'Paused' : j.nextRun}</TableCell>
                  <TableCell><Who subject={j.runAs} sub={false} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => start(j)}><Play /> Run now</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${j.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setJobs((js) => js.map((x) => (x.id === j.id ? { ...x, state: x.state === 'active' ? 'paused' : 'active', nextRun: x.state === 'active' ? null : nextRuns(x.trigger)[0] ?? 'After the next sync' } : x)))}>{j.state === 'active' ? 'Pause' : 'Resume'}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => nav(`/jobs/${j.id}/settings`)}>Settings</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDel(j)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 max-w-[90ch] text-xs text-muted-foreground">Jobs that read analytical tables use the same two session slots as people. A job that cannot get a slot within its start window is skipped and shown here, never run late without telling you.</p>
      {del && <ConfirmDelete open onOpenChange={(o) => !o && setDel(null)} name={del.name} kind="job" consequence="The job stops running. Its run history and saved outputs are removed with it." onConfirm={() => setJobs((js) => js.filter((x) => x.id !== del.id))} />}
    </div>
  )
}

export function AllRuns() {
  const { jobs, jobRuns } = useStore()
  const [state, setState] = useState('all')
  const [job, setJob] = useState('all')
  const rows = jobRuns.filter((r) => (state === 'all' || r.state === state) && (job === 'all' || r.job === job))
  return (
    <div>
      <PageHeader title="Runs" tag={<BackingTag id="JB-03" />} description="Every run of every job in this project, newest first. Open one for its output, its log and exactly which data it read." />
      <div className="mb-3 flex items-center gap-2">
        <Select value={job} onValueChange={setJob}><SelectTrigger size="sm" className="w-64" aria-label="Job"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All jobs</SelectItem>{jobs.map((j) => <SelectItem key={j.id} value={j.id}><span className="font-mono text-[13px]">{j.name}</span></SelectItem>)}</SelectContent></Select>
        <Select value={state} onValueChange={setState}><SelectTrigger size="sm" className="w-40" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any status</SelectItem>{['succeeded', 'failed', 'running', 'queued', 'cancelled', 'skipped'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
        <span className="text-xs text-muted-foreground">{rows.length} runs</span>
      </div>
      <RunsTable runs={rows} showJob />
    </div>
  )
}

type Draft = Omit<Job, 'id' | 'state' | 'created' | 'nextRun'>
const BLANK: Draft = { name: '', description: '', task: { kind: 'notebook', ref: '', follow: 'pinned', revision: '' }, trigger: { kind: 'schedule', every: 'daily', at: '02:00', days: ['Mon'], minutes: 15, cron: '0 2 * * 1-5' }, params: [], timeoutMin: 30, retries: 1, retryWaitMin: 5, overlap: 'skip', runAs: '', notify: [] }

function JobForm({ initial, submit, onSubmit, taken }: { initial: Draft; submit: string; onSubmit: (d: Draft) => void; taken: string[] }) {
  const { notebooks, pipelines } = useStore()
  const { effective, name: who } = useAccess()
  const pname = usePipelineName()
  const [d, setD] = useState(initial)
  const [addNotify, setAddNotify] = useState('')
  const t = d.trigger
  const sched = t.kind === 'schedule' ? t : null
  const setT = (p: Partial<Extract<JobTrigger, { kind: 'schedule' }>>) => sched && setD({ ...d, trigger: { ...sched, ...p } })
  const nameOk = /^[a-z][a-z0-9-]{2,49}$/.test(d.name) && !taken.includes(d.name)
  const eff = d.runAs ? effective(d.runAs) : null
  const reads = d.task.kind === 'notebook' || d.task.engine === 'Spark'
  const checks: [boolean, string, string][] = eff ? [
    [!!eff.role, eff.role ? `Has the ${eff.role} role in this project` : 'Has no role in this project', '/access/roles'],
    ...(d.task.kind === 'notebook' ? [[eff.runs.some((r) => r.grant.grant === 'execute'), eff.runs.some((r) => r.grant.grant === 'execute') ? 'May run notebooks' : 'May not run notebooks', '/access/runs'] as [boolean, string, string]] : []),
    reads ? [eff.tables.length > 0, eff.tables.length ? `Can read ${eff.tables.length} catalog ${eff.tables.length === 1 ? 'table' : 'tables'}` : 'Cannot read any catalog table', '/access/catalog'] : [eff.data.some((x) => x.caps.includes('read')), eff.data.some((x) => x.caps.includes('read')) ? 'Can read PostgreSQL data' : 'Cannot read any PostgreSQL branch', '/access/data'],
  ] : []
  const valid = nameOk && d.task.ref && d.runAs && (t.kind !== 'pipeline' || t.pipeline) && (t.kind !== 'schedule' || t.every !== 'weekly' || (t.days?.length ?? 0) > 0)
  const upcoming = nextRuns(t)
  const field = 'grid gap-1.5'

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-8">
        <Section title="What to run">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={field}><Label htmlFor="jb-name">Job name</Label><Input id="jb-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="nightly-revenue-report" className="font-mono text-[13px]" />{d.name && !nameOk && <p className="text-xs text-destructive">{taken.includes(d.name) ? 'A job with this name exists.' : 'Lowercase letters, digits and hyphens, at least 3 characters.'}</p>}</div>
              <div className={field}>
                <Label htmlFor="jb-task">Notebook or saved query</Label>
                <Select value={d.task.ref ? `${d.task.kind}:${d.task.ref}` : ''} onValueChange={(v) => { const [kind, ...rest] = v.split(':'); const ref = rest.join(':'); const sq = SAVED_QUERIES.find((x) => x.title === ref); setD({ ...d, task: { ...d.task, kind: kind as 'notebook' | 'query', ref, revision: REVISIONS[ref] ?? 'r1', engine: kind === 'query' ? (sq?.folder === 'Ops' || sq?.folder === 'Support' ? 'PostgreSQL' : 'Spark') : undefined } }) }}>
                  <SelectTrigger id="jb-task" className="w-full"><SelectValue placeholder="Choose what to run" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup><SelectLabel>Notebooks</SelectLabel>{notebooks.map((n) => <SelectItem key={n.name} value={`notebook:${n.name}`}><BookOpen className="text-olap" />{n.name}</SelectItem>)}</SelectGroup>
                    <SelectGroup><SelectLabel>Saved queries</SelectLabel>{SAVED_QUERIES.map((s) => <SelectItem key={s.id} value={`query:${s.title}`}><Code2 />{s.title}</SelectItem>)}</SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={field}><Label htmlFor="jb-desc">What it is for</Label><Textarea id="jb-desc" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="One line for whoever is paged when it fails." /></div>
            {d.task.ref && (
              <RadioGroup value={d.task.follow} onValueChange={(v) => setD({ ...d, task: { ...d.task, follow: v as 'pinned' | 'latest' } })} className="grid gap-2 sm:grid-cols-2">
                <label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', d.task.follow === 'pinned' && 'border-foreground/40 bg-muted/40')}><RadioGroupItem value="pinned" className="mt-0.5" /><span><span className="font-medium">Run the version saved now</span><span className="block text-[13px] text-muted-foreground">Revision <span className="font-mono text-[12.5px]">{d.task.revision}</span>. Later edits do not reach the job until you update it.</span></span></label>
                <label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', d.task.follow === 'latest' && 'border-foreground/40 bg-muted/40')}><RadioGroupItem value="latest" className="mt-0.5" /><span><span className="font-medium">Always run the latest saved version</span><span className="block text-[13px] text-muted-foreground">Anyone who can edit it changes what the job does.</span></span></label>
              </RadioGroup>
            )}
          </div>
        </Section>

        <Section title="When to run" tag={<BackingTag id="JB-02" />}>
          <div className="grid gap-4">
            <RadioGroup value={t.kind} onValueChange={(v) => setD({ ...d, trigger: v === 'schedule' ? (BLANK.trigger) : v === 'pipeline' ? { kind: 'pipeline', pipeline: '' } : { kind: 'manual' } })} className="grid gap-2 sm:grid-cols-3">
              {([['schedule', 'On a schedule', 'At fixed times.'], ['pipeline', 'When data arrives', 'After a sync publishes a new version.'], ['manual', 'Only by hand', 'From here or the API.']] as const).map(([v, l, s]) => (
                <label key={v} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', t.kind === v && 'border-foreground/40 bg-muted/40')}><RadioGroupItem value={v} className="mt-0.5" /><span><span className="font-medium">{l}</span><span className="block text-[13px] text-muted-foreground">{s}</span></span></label>
              ))}
            </RadioGroup>
            {sched && (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className={field}><Label htmlFor="jb-every">Repeat</Label><Select value={sched.every} onValueChange={(every) => setT({ every: every as typeof sched.every })}><SelectTrigger id="jb-every" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Every few minutes</SelectItem><SelectItem value="hourly">Every hour</SelectItem><SelectItem value="daily">Every day</SelectItem><SelectItem value="weekly">On chosen weekdays</SelectItem><SelectItem value="cron">Cron expression</SelectItem></SelectContent></Select></div>
                  {sched.every === 'minutes' && <div className={field}><Label htmlFor="jb-min">Interval</Label><Select value={String(sched.minutes)} onValueChange={(m) => setT({ minutes: +m })}><SelectTrigger id="jb-min" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{[5, 10, 15, 30].map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}</SelectContent></Select></div>}
                  {sched.every === 'hourly' && <div className={field}><Label htmlFor="jb-past">Minutes past the hour</Label><Input id="jb-past" type="number" min={0} max={59} className="w-40" value={+(sched.at ?? '00:00').slice(3)} onChange={(e) => setT({ at: `00:${String(Math.max(0, Math.min(59, +e.target.value))).padStart(2, '0')}` })} /></div>}
                  {(sched.every === 'daily' || sched.every === 'weekly') && <div className={field}><Label htmlFor="jb-at">At (UTC)</Label><Input id="jb-at" type="time" className="w-40" value={sched.at} onChange={(e) => setT({ at: e.target.value })} /></div>}
                  {sched.every === 'cron' && <div className={field}><Label htmlFor="jb-cron">Expression (UTC)</Label><Input id="jb-cron" className="w-56 font-mono text-[13px]" value={sched.cron} onChange={(e) => setT({ cron: e.target.value })} /></div>}
                </div>
                {sched.every === 'weekly' && <div className="flex gap-1.5" role="group" aria-label="Weekdays">{DAYS.map((x) => { const on = sched.days?.includes(x); return <button key={x} type="button" aria-pressed={on} onClick={() => setT({ days: on ? sched.days!.filter((y) => y !== x) : DAYS.filter((y) => y === x || sched.days?.includes(y)) })} className={cn('h-8 w-12 rounded-md border text-[13px]', on ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}>{x}</button> })}</div>}
                <p className="text-xs text-muted-foreground">Times are in UTC. If the server was off at a start time, the job runs once when it comes back, not once per missed time.</p>
              </div>
            )}
            {t.kind === 'pipeline' && (
              <div className={field}><Label htmlFor="jb-pl">Sync pipeline</Label><Select value={t.pipeline} onValueChange={(pipeline) => setD({ ...d, trigger: { kind: 'pipeline', pipeline } })}><SelectTrigger id="jb-pl" className="w-80"><SelectValue placeholder="Choose a pipeline" /></SelectTrigger><SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id} disabled={p.mode === 'continuous'}>{pname(p.id)}<span className="text-xs text-muted-foreground">{p.mode}{p.mode === 'continuous' && ', publishes too often'}</span></SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">The run reads exactly the version that triggered it. Continuous pipelines publish every few seconds, so use a schedule with them.</p></div>
            )}
          </div>
        </Section>

        <Section title="Parameters" tag={<BackingTag id="JB-05" />} description={d.task.kind === 'notebook' ? 'Read in the notebook as params["name"].' : 'Used in the query as :name.'} actions={<Button variant="outline" size="sm" onClick={() => setD({ ...d, params: [...d.params, ['', '']] })}><Plus /> Add</Button>}>
          {d.params.length ? (
            <div className="grid gap-2">
              {d.params.map(([k, v], i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label="Parameter name" placeholder="name" className="w-56 font-mono text-[13px]" value={k} onChange={(e) => setD({ ...d, params: d.params.map((p, j) => (j === i ? [e.target.value, p[1]] : p)) })} />
                  <Input aria-label="Parameter value" placeholder="value" className="font-mono text-[13px]" value={v} onChange={(e) => setD({ ...d, params: d.params.map((p, j) => (j === i ? [p[0], e.target.value] : p)) })} />
                  <Button variant="ghost" size="icon" aria-label="Remove parameter" onClick={() => setD({ ...d, params: d.params.filter((_, j) => j !== i) })}><X /></Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Filled in at start: <span className="font-mono">{'{{ run.date }}'}</span>, <span className="font-mono">{'{{ run.started_at }}'}</span>, <span className="font-mono">{'{{ data.version }}'}</span>.</p>
            </div>
          ) : <span className="text-[13px] text-muted-foreground">No parameters. The task runs exactly as saved.</span>}
        </Section>

        <Section title="Limits and retries">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={field}><Label htmlFor="jb-to">Stop after</Label><Select value={String(d.timeoutMin)} onValueChange={(v) => setD({ ...d, timeoutMin: +v })}><SelectTrigger id="jb-to" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[5, 15, 30, 60, 120].map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}</SelectContent></Select></div>
            <div className={field}><Label htmlFor="jb-re">If it fails</Label><Select value={String(d.retries)} onValueChange={(v) => setD({ ...d, retries: +v })}><SelectTrigger id="jb-re" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Do not retry</SelectItem><SelectItem value="1">Retry once</SelectItem><SelectItem value="2">Retry twice</SelectItem><SelectItem value="3">Retry 3 times</SelectItem></SelectContent></Select></div>
            <div className={field}><Label htmlFor="jb-rw">Wait before a retry</Label><Select disabled={!d.retries} value={String(d.retryWaitMin)} onValueChange={(v) => setD({ ...d, retryWaitMin: +v })}><SelectTrigger id="jb-rw" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[1, 5, 10, 30].map((m) => <SelectItem key={m} value={String(m)}>{m} {m === 1 ? 'minute' : 'minutes'}</SelectItem>)}</SelectContent></Select></div>
            <div className={field}><Label htmlFor="jb-ov">If the last run is still going</Label><Select value={d.overlap} onValueChange={(v) => setD({ ...d, overlap: v as 'skip' | 'queue' })}><SelectTrigger id="jb-ov" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="skip">Skip this one</SelectItem><SelectItem value="queue">Wait, then run</SelectItem></SelectContent></Select></div>
          </div>
        </Section>

        <Section title="Identity" tag={<BackingTag id="JB-06" />} description="A job runs as a service account, so it keeps working when people change teams and can only touch what that account was granted.">
          <div className="grid gap-3">
            <div className="max-w-sm"><SubjectPicker value={d.runAs ? `principal:${d.runAs}` : ''} onChange={(v) => setD({ ...d, runAs: v.split(':')[1] })} only="service" /></div>
            {checks.length > 0 && <ul className="grid gap-1.5 text-[13px]">{checks.map(([ok, text, to]) => <li key={text} className="flex items-center gap-2">{ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-destructive" />}{text}{!ok && <Link to={to} className="text-primary hover:underline">Grant it</Link>}</li>)}</ul>}
          </div>
        </Section>

        <Section title="When it fails" tag={<BackingTag id="JB-07" />} description="Tell someone after the last retry has failed, and again when the job recovers.">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5">{d.notify.map((n) => <span key={n} className="inline-flex items-center gap-1 rounded-md border py-0.5 pr-1 pl-2 text-[13px]">{who(n)}<button aria-label={`Remove ${who(n)}`} className="rounded p-0.5 hover:bg-muted" onClick={() => setD({ ...d, notify: d.notify.filter((x) => x !== n) })}><X className="size-3" /></button></span>)}{d.notify.length === 0 && <span className="text-[13px] text-muted-foreground">Nobody is told. The failure is still shown on the jobs page.</span>}</div>
            <div className="flex max-w-sm gap-2"><SubjectPicker value={addNotify} onChange={setAddNotify} only={undefined} exclude={d.notify.flatMap((n) => [`principal:${n}`, `group:${n}`])} /><Button variant="outline" disabled={!addNotify} onClick={() => { setD({ ...d, notify: [...d.notify, addNotify.split(':')[1]] }); setAddNotify('') }}>Add</Button></div>
          </div>
        </Section>
      </div>

      <aside className="sticky top-16 grid gap-4 rounded-lg border bg-card p-4 text-[13px]">
        <div className="font-semibold">Summary</div>
        <p className="leading-relaxed">{d.task.ref ? <>Runs <span className="font-medium">{d.task.ref}</span>{d.task.kind === 'query' && ` on ${d.task.engine}`}</> : <span className="text-muted-foreground">Choose what to run</span>}{d.task.ref && <>, {describeTrigger(t, pname).replace(/^./, (c) => c.toLowerCase())}{d.runAs && <>, as <span className="font-mono text-[12.5px]">{who(d.runAs)}</span></>}.</>}</p>
        {upcoming.length > 0 && <div><div className="mb-1 text-muted-foreground">Next runs (UTC)</div><ul className="tabular grid gap-0.5">{upcoming.map((u) => <li key={u}>{u}</li>)}</ul></div>}
        {reads && d.task.ref && <p className="text-xs text-muted-foreground">Each run takes one of the two analytical session slots and reads one fixed version of the data from start to finish.</p>}
        {checks.some(([ok]) => !ok) && <p className="rounded-md border border-warning/40 bg-warning/8 p-2 text-xs">The service account is missing access. The job can be saved, but every run will be refused until it is granted.</p>}
        <Button disabled={!valid} onClick={() => onSubmit(d)}>{submit}</Button>
      </aside>
    </div>
  )
}

export function JobCreate() {
  const { jobs, setJobs } = useStore()
  const nav = useNavigate()
  return (
    <div>
      <PageHeader title="New job" tag={<BackingTag id="JB-01" />} description="Nothing runs until you create the job. You can run it once by hand afterwards to check it before the first scheduled start." />
      <JobForm initial={BLANK} submit="Create job" taken={jobs.map((j) => j.name)} onSubmit={(d) => {
        const id = `job_${d.name.replaceAll('-', '_')}`
        setJobs((js) => [{ ...d, id, state: 'active', created: '2026-10-10', nextRun: d.trigger.kind === 'schedule' ? nextRuns(d.trigger)[0].replace(/^\w+ /, '') : d.trigger.kind === 'pipeline' ? 'After the next sync' : null }, ...js])
        toast.success(`Job ${d.name} created`); nav(`/jobs/${id}`)
      }} />
    </div>
  )
}

export function JobDetail() {
  const { id, tab = 'runs' } = useParams()
  const { jobs, setJobs, jobRuns } = useStore()
  const { start } = useRuns()
  const nav = useNavigate()
  const pname = usePipelineName()
  const [del, setDel] = useState(false)
  const job = jobs.find((j) => j.id === id)
  if (!job) return <Navigate to="/jobs" replace />
  const runs = jobRuns.filter((r) => r.job === job.id)
  const finished = runs.filter((r) => r.state === 'succeeded' || r.state === 'failed')
  const okRate = finished.length ? Math.round((finished.filter((r) => r.state === 'succeeded').length / finished.length) * 100) : null
  const durs = runs.filter((r) => r.state === 'succeeded').map((r) => r.seconds).sort((a, b) => a - b)
  const chart = runs.filter((r) => r.seconds > 0).slice(0, 24).reverse()
  const max = Math.max(1, ...chart.map((r) => r.seconds))
  const patch = (p: Partial<Job>) => setJobs((js) => js.map((x) => (x.id === job.id ? { ...x, ...p } : x)))
  const lastOk = runs.find((r) => r.state === 'succeeded')

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3"><h1 className="truncate font-mono text-[1.45rem] leading-tight font-semibold tracking-tight">{job.name}</h1><StatusBadge status={job.state} /></div>
          {job.description && <p className="mt-1.5 max-w-[72ch] text-muted-foreground">{job.description}</p>}
          <dl className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px] [&>div]:flex [&>div]:items-center [&>div]:gap-1.5 [&_dt]:text-muted-foreground">
            <div><dt>Runs</dt><dd><Link className="hover:underline" to={job.task.kind === 'notebook' ? `/notebooks/${encodeURIComponent(job.task.ref)}` : job.task.engine === 'Spark' ? '/analytics/sql' : '/sql'}><TaskLabel job={job} /></Link></dd></div>
            <div><dt>When</dt><dd>{describeTrigger(job.trigger, pname)}</dd></div>
            <div><dt>As</dt><dd><Who subject={job.runAs} sub={false} /></dd></div>
          </dl>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { patch({ state: job.state === 'active' ? 'paused' : 'active', nextRun: job.state === 'active' ? null : nextRuns(job.trigger)[0]?.replace(/^\w+ /, '') ?? 'After the next sync' }); toast.success(job.state === 'active' ? 'Job paused. Running work is not stopped.' : 'Job resumed') }}>{job.state === 'active' ? <><Pause /> Pause</> : <><Play /> Resume</>}</Button>
          <Button onClick={() => start(job)}><Play /> Run now</Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(t) => nav(`/jobs/${job.id}/${t}`)}>
        <TabsList variant="line" className="mb-6 h-10 w-full justify-start gap-1 border-b p-0">
          <TabsTrigger value="runs" className="flex-none px-2.5">Runs</TabsTrigger><TabsTrigger value="settings" className="flex-none px-2.5">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="runs" className="grid gap-7">
          <div className="grid grid-cols-2 gap-y-5 lg:grid-cols-4">
            <Stat label="Success rate" value={okRate === null ? 'No runs' : `${okRate}%`} sub={`${finished.length} finished runs`} />
            <Stat label="Typical duration" value={durs.length ? fmtDur(durs[Math.floor(durs.length / 2)]) : 'No runs'} sub={durs.length ? `Longest ${fmtDur(durs[durs.length - 1])}, limit ${job.timeoutMin} min` : undefined} />
            <Stat label="Last success" value={lastOk?.started ?? 'Never'} sub={lastOk?.version ? `Read version ${fmtN(lastOk.version)}` : undefined} />
            <Stat label="Next run" value={job.state === 'paused' ? 'Paused' : job.nextRun ?? 'By hand only'} />
          </div>
          {chart.length > 1 && (
            <Section title="Duration" description="One bar per run, oldest on the left.">
              <div className="flex h-28 items-end gap-1.5">
                {chart.map((r) => <Tooltip key={r.id}><TooltipTrigger asChild><div className={cn('min-w-2 flex-1 rounded-t-sm', BAR[r.state].replace(' animate-pulse', ''))} style={{ height: `${Math.max(4, (r.seconds / max) * 100)}%`, maxWidth: 28 }} /></TooltipTrigger><TooltipContent>Run {r.n}, {r.started}<br /><span className="capitalize">{r.state}</span> in {fmtDur(r.seconds)}</TooltipContent></Tooltip>)}
              </div>
            </Section>
          )}
          <div><h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold">Run history <BackingTag id="JB-03" /></h2><RunsTable runs={runs} /></div>
        </TabsContent>
        <TabsContent value="settings" className="grid gap-8">
          <JobForm key={job.id} initial={job} submit="Save changes" taken={jobs.filter((j) => j.id !== job.id).map((j) => j.name)} onSubmit={(d) => { patch({ ...d, nextRun: job.state === 'paused' ? null : d.trigger.kind === 'schedule' ? nextRuns(d.trigger)[0].replace(/^\w+ /, '') : d.trigger.kind === 'pipeline' ? 'After the next sync' : null }); toast.success('Job saved', { description: 'Runs already in progress finish with the old settings.' }) }} />
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
            <div><div className="font-medium">Delete this job</div><div className="text-[13px] text-muted-foreground">Its run history and saved outputs are removed with it.</div></div>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDel(true)}>Delete job</Button>
          </div>
        </TabsContent>
      </Tabs>
      <ConfirmDelete open={del} onOpenChange={setDel} name={job.name} kind="job" consequence="The job stops running. Its run history and saved outputs are removed with it." onConfirm={() => { setJobs((js) => js.filter((x) => x.id !== job.id)); nav('/jobs') }} />
    </div>
  )
}
