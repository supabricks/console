import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag } from '@/components/common'
import { ModeCards, MODES, ModeSettings, Route } from '@/components/sync-parts'
import type { SyncConfig } from '@/components/sync-parts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { deltaType, fmtEvery, fmtN, TABLES } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const STEPS = ['Source', 'Tables', 'Mode', 'Settings', 'Review']

export default function SyncCreate() {
  const { databases, branches, pipelines, setPipelines, db: currentDb } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [dbId, setDbId] = useState(currentDb.id)
  const dbBranches = branches.filter((b) => b.db === dbId)
  const [branch, setBranch] = useState(() => params.get('branch') ?? dbBranches.find((x) => !pipelines.some((q) => q.db === dbId && q.branch === x.name))?.name ?? 'main')
  const [cfg, setCfgRaw] = useState<SyncConfig>({ mode: 'continuous', everySeconds: 3600, freshnessMs: 5000, batchMs: 500, storage: 'compact' })
  const set = (p: Partial<SyncConfig>) => setCfgRaw((c) => ({ ...c, ...p }))
  const [ack, setAck] = useState(false)

  const tables = TABLES.map((t) => {
    const bad = t.columns.filter((c) => !deltaType(c.type).delta)
    return { t, key: `${t.schema}.${t.name}`, bad, noKey: !t.columns.some((c) => c.pk) }
  })
  const [excluded, setExcluded] = useState<Set<string>>(new Set(tables.filter((x) => x.bad.length).map((x) => x.key)))
  const included = tables.filter((x) => !excluded.has(x.key))
  const blocking = included.filter((x) => x.bad.length)
  const b = dbBranches.find((x) => x.name === branch)
  const taken = pipelines.some((p) => p.db === dbId && p.branch === branch)
  const db = databases.find((d) => d.id === dbId)!
  const incremental = cfg.mode !== 'snapshot'
  const ok = [!!b && !taken, included.length > 0 && blocking.length === 0, true, cfg.batchMs <= cfg.freshnessMs && cfg.freshnessMs >= 1000 && cfg.freshnessMs <= 300000, !incremental || ack][step]

  const create = () => {
    const id = `pl_${Math.random().toString(16).slice(2, 10)}`
    setPipelines((ps) => [...ps, { id, db: dbId, branch, ...cfg, everySeconds: cfg.mode === 'continuous' ? null : cfg.everySeconds, state: 'starting', tables: included.map((x) => x.key), created: '2026-10-09', revision: 1, lastSuccess: 'Never', nextRun: null, version: 0, lagMs: null, sourceLsn: b!.lsn, capturedLsn: b!.lsn, publishedLsn: b!.lsn, backlogBytes: 0, spoolBytes: 0, walBytes: 0 }])
    toast.loading('Copying tables for the first time…', { id })
    setTimeout(() => {
      setPipelines((ps) => ps.map((p) => (p.id === id ? { ...p, state: cfg.mode === 'continuous' ? 'healthy' : 'idle', version: 1, lastSuccess: 'Just now', lagMs: cfg.mode === 'continuous' ? 2400 : null, nextRun: cfg.mode !== 'continuous' && cfg.everySeconds ? 'in 1 hour' : null } : p)))
      toast.success('First version published', { id })
    }, 3500)
    nav(`/sync/${id}`)
  }

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight">New pipeline</h1>
      <p className="mt-1.5 text-muted-foreground">Publish a PostgreSQL branch as Delta tables.</p>

      <ol className="my-6 flex items-center gap-2 text-[13px]">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <button disabled={i > step} onClick={() => setStep(i)} className={cn('flex items-center gap-2 rounded-md py-1 pr-2 pl-1', i === step ? 'font-semibold' : i < step ? 'text-foreground hover:bg-muted' : 'text-muted-foreground')}>
              <span className={cn('tabular flex size-5.5 items-center justify-center rounded-full border text-xs', i < step && 'border-primary bg-primary text-primary-foreground', i === step && 'border-primary text-primary')}>{i < step ? <Check className="size-3" /> : i + 1}</span>
              {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="size-3.5 text-border" />}
          </li>
        ))}
      </ol>

      <div className="min-h-80">
        {step === 0 && (
          <div className="grid gap-5">
            <div className="grid max-w-2xl grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Database</Label>
                <Select value={dbId} onValueChange={(v) => { setDbId(v); setBranch('main') }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{databases.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Branch</Label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="w-full font-mono text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{dbBranches.map((x) => <SelectItem key={x.id} value={x.name}>{x.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="max-w-2xl rounded-lg border">
              <div className="border-b bg-muted/50 px-4 py-2 text-[13px] text-muted-foreground">Checks on this branch</div>
              <ul className="divide-y text-[13px]">
                {[
                  [!taken, taken ? 'This branch already has a pipeline. A branch can have one.' : 'No pipeline exists on this branch yet'],
                  [true, b?.state === 'running' ? 'Compute is running' : 'Compute is suspended; it will be woken to read the tables'],
                  [true, 'Change capture is available (logical decoding enabled)'],
                  [true, `About ${fmtN(TABLES.reduce((n, t) => n + t.rows, 0))} rows across ${TABLES.length} tables`],
                ].map(([pass, text]) => (
                  <li key={text as string} className="flex items-center gap-2.5 px-4 py-2.5">
                    {pass ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-destructive" />}{text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3">
            <p className="max-w-[78ch] text-[13px] text-muted-foreground">Every column must map to a Delta type without losing information. Incremental modes also need a primary key on each table. <BackingTag id="SY-02b" className="ml-1" /> <BackingTag id="SY-02c" /></p>
            {blocking.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/8 px-4 py-3 text-[13px]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div><span className="font-medium">{blocking.length} selected table{blocking.length > 1 ? 's have' : ' has'} columns that cannot be synced.</span> Leave them out to continue, or change the column type in PostgreSQL.</div>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border">
              {tables.map(({ t, key, bad }) => {
                const on = !excluded.has(key)
                return (
                  <label key={key} className={cn('flex cursor-pointer items-start gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40', !on && 'opacity-60')}>
                    <Checkbox className="mt-0.5" checked={on} onCheckedChange={(c) => setExcluded((s) => { const n = new Set(s); if (c) n.delete(key); else n.add(key); return n })} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3"><span className="font-mono text-[13px] font-medium">{key}</span><span className="tabular text-xs text-muted-foreground">about {fmtN(t.rows)} rows, {t.columns.length} columns</span></div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {t.columns.map((c) => {
                          const d = deltaType(c.type)
                          return (
                            <span key={c.name} title={d.delta ? `${c.type} becomes ${d.delta}` : d.why} className={cn('rounded border px-1.5 py-0.5 font-mono text-[11.5px]', d.delta ? 'text-muted-foreground' : 'border-destructive/50 bg-destructive/8 text-destructive')}>
                              {c.name} <span className="opacity-70">{d.delta ?? c.type}</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <span className={cn('shrink-0 text-[13px]', bad.length ? 'text-destructive' : 'text-success')}>{bad.length ? `${bad.length} unsupported` : 'Ready'}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && <ModeCards value={cfg.mode} onChange={(mode) => set({ mode })} />}

        {step === 3 && (
          <div className="grid max-w-3xl gap-6">
            <div className="text-[13px] text-muted-foreground">Settings for <span className="font-medium text-foreground">{MODES.find((m) => m.id === cfg.mode)!.title.toLowerCase()}</span> sync. You can change these later without rebuilding the pipeline.</div>
            <ModeSettings cfg={cfg} set={set} />
          </div>
        )}

        {step === 4 && (
          <div className="grid max-w-3xl gap-5">
            <dl className="divide-y rounded-lg border text-[13px] [&>div]:flex [&>div]:gap-4 [&>div]:px-4 [&>div]:py-2.5 [&_dt]:w-40 [&_dt]:shrink-0 [&_dt]:text-muted-foreground">
              <div><dt>Pipeline</dt><dd><Route db={db.name} branch={branch} /></dd></div>
              <div><dt>Tables</dt><dd>{included.map((x) => x.key).join(', ')}{excluded.size > 0 && <span className="text-muted-foreground"> ({excluded.size} left out)</span>}</dd></div>
              <div><dt>Mode</dt><dd>{MODES.find((m) => m.id === cfg.mode)!.title}</dd></div>
              <div><dt>{cfg.mode === 'continuous' ? 'Freshness target' : 'Schedule'}</dt><dd>{cfg.mode === 'continuous' ? `${cfg.freshnessMs / 1000} s, batches at least ${cfg.batchMs / 1000} s apart` : fmtEvery(cfg.everySeconds)}</dd></div>
              <div><dt>First run</dt><dd>Copies every selected table in full, then {incremental ? 'follows changes' : 'waits for the next run'}</dd></div>
            </dl>
            {incremental && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3.5 text-[13px]">
                <Checkbox className="mt-0.5" checked={ack} onCheckedChange={(c) => setAck(!!c)} />
                <span>
                  <span className="font-medium">I understand what this pipeline uses.</span>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>The compute for <span className="font-mono text-[12.5px] text-foreground">{branch}</span> stays awake while change capture runs, including when the pipeline is paused.</li>
                    <li>Up to 512 MiB of change history and 512 MiB of write-ahead log are kept on disk.</li>
                    <li>If history is lost, a full resync is needed, and you review it first.</li>
                    {cfg.mode === 'continuous' && <li>The freshness target is a goal, not a guarantee.</li>}
                  </ul>
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <Button variant="outline" onClick={() => (step ? setStep(step - 1) : nav('/sync'))}>{step ? 'Back' : 'Cancel'}</Button>
        {step < 4 ? <Button disabled={!ok} onClick={() => setStep(step + 1)}>Continue</Button> : <Button disabled={!ok} onClick={create}>Create pipeline</Button>}
      </div>
    </div>
  )
}
