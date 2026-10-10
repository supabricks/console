import type { ReactNode } from 'react'
import { Camera, Radio, Zap } from 'lucide-react'
import { BackingTag } from '@/components/common'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtBytes } from '@/lib/data'
import type { Pipeline, SyncMode } from '@/lib/data'
import { cn } from '@/lib/utils'

export type SyncConfig = Pick<Pipeline, 'mode' | 'everySeconds' | 'freshnessMs' | 'batchMs' | 'storage'>
export const BUDGET = 512 * 1024 * 1024

export const MODES: { id: SyncMode; icon: typeof Camera; title: string; line: string; rows: [string, string][] }[] = [
  { id: 'snapshot', icon: Camera, title: 'Snapshot', line: 'Copy every table in full, on a schedule or on demand.',
    rows: [['Freshness', 'As of the last run'], ['Each run', 'Reads the whole branch'], ['Between runs', 'Nothing runs; compute can suspend'], ['Best for', 'Small or slow-changing data, nightly reporting']] },
  { id: 'triggered', icon: Zap, title: 'Triggered', line: 'Capture changes as they happen; publish them on a schedule or on demand.',
    rows: [['Freshness', 'As of the last run'], ['Each run', 'Applies only what changed'], ['Between runs', 'Keeps change history; compute stays awake'], ['Best for', 'Large tables, hourly or ad hoc refresh']] },
  { id: 'continuous', icon: Radio, title: 'Continuous', line: 'Publish changes within seconds of each commit.',
    rows: [['Freshness', 'Seconds behind, to a target you set'], ['Each run', 'Small batches, all the time'], ['Between runs', 'Always running; compute stays awake'], ['Best for', 'Dashboards and agents that need current data']] },
]

export function ModeCards({ value, onChange }: { value: SyncMode; onChange: (m: SyncMode) => void }) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as SyncMode)} className="grid gap-3 lg:grid-cols-3">
      {MODES.map((m) => (
        <label key={m.id} className={cn('flex cursor-pointer flex-col rounded-lg border p-4 transition-colors', value === m.id ? 'border-primary bg-accent/50 shadow-[inset_0_0_0_1px_var(--primary)]' : 'hover:bg-muted/50')}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value={m.id} />
            <m.icon className="size-4 text-olap" />
            <span className="text-[15px] font-semibold">{m.title}</span>
          </div>
          <p className="mt-2 min-h-11 text-[13px] text-muted-foreground">{m.line}</p>
          <dl className="mt-3 grid gap-2 border-t pt-3 text-[13px]">
            {m.rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </label>
      ))}
    </RadioGroup>
  )
}

const SCHEDULES: [string, string][] = [['0', 'Manual only'], ['300', 'Every 5 minutes'], ['900', 'Every 15 minutes'], ['3600', 'Every hour'], ['21600', 'Every 6 hours'], ['86400', 'Every day']]

function Field({ label, hint, children, tag }: { label: string; hint?: string; children: ReactNode; tag?: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label className="gap-2">{label}{tag}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Settings that depend on the mode. Bounds match the platform's sync command schema. */
export function ModeSettings({ cfg, set }: { cfg: SyncConfig; set: (p: Partial<SyncConfig>) => void }) {
  const bad = cfg.batchMs > cfg.freshnessMs
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {cfg.mode !== 'continuous' ? (
        <Field label="Schedule" hint="Times are UTC. If runs are missed while the database is down, one catch-up run replaces them.">
          <Select value={String(cfg.everySeconds ?? 0)} onValueChange={(v) => set({ everySeconds: Number(v) || null })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{SCHEDULES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      ) : (
        <>
          <Field label="Freshness target, seconds" hint="How far behind PostgreSQL the published data may be. A target, not a guarantee. 1 to 300.">
            <Input type="number" min={1} max={300} value={cfg.freshnessMs / 1000} onChange={(e) => set({ freshnessMs: Math.round(Number(e.target.value) * 1000) })} />
          </Field>
          <Field label="Minimum time between batches, seconds" hint={bad ? undefined : 'Smaller batches publish sooner and create more files. 0.2 to 60.'}>
            <Input type="number" min={0.2} max={60} step={0.1} value={cfg.batchMs / 1000} aria-invalid={bad} onChange={(e) => set({ batchMs: Math.round(Number(e.target.value) * 1000) })} />
            {bad && <p className="text-xs text-destructive">Must not exceed the freshness target.</p>}
          </Field>
        </>
      )}
      <Field label="Storage profile" tag={<BackingTag id="SY-02d" />} hint="Compact suits data up to about 1 GiB per version. Large allows up to 128 GiB.">
        <Select value={cfg.storage} onValueChange={(v) => set({ storage: v as SyncConfig['storage'] })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent>
        </Select>
      </Field>
    </div>
  )
}

/** Usage against a fixed budget, with the 80% pressure line marked. */
export function Budget({ label, used, total = BUDGET }: { label: string; used: number; total?: number }) {
  const pct = Math.min(100, (used / total) * 100)
  const pressure = pct >= 80
  return (
    <div className="border-l py-0.5 pl-4">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-[1.55rem] leading-none font-semibold tracking-tight">{fmtBytes(used)}</div>
      <div className="relative mt-2.5 h-1.5 rounded-full bg-muted">
        <div className={cn('h-full rounded-full', pressure ? 'bg-destructive' : 'bg-olap')} style={{ width: `${Math.max(pct, 1)}%` }} />
        <div className="absolute -top-0.5 h-2.5 w-px bg-foreground/40" style={{ left: '80%' }} title="Pressure begins at 80%" />
      </div>
      <div className={cn('mt-1.5 text-xs', pressure ? 'font-medium text-destructive' : 'text-muted-foreground')}>{pressure ? `${pct.toFixed(0)}% of ${fmtBytes(total)}: under pressure` : `of ${fmtBytes(total)}`}</div>
    </div>
  )
}

/** Source and destination, coloured by engine. */
export function Route({ db, branch, version }: { db: string; branch: string; version?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="size-2 shrink-0 rounded-sm bg-oltp" />
      <span className="truncate"><span className="font-medium">{db}</span><span className="text-muted-foreground"> / </span><span className="font-mono text-[12.5px]">{branch}</span></span>
      <svg width="22" height="8" viewBox="0 0 22 8" className="shrink-0 text-muted-foreground" aria-label="syncs to"><path d="M0 4h19M16 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="size-2 shrink-0 rounded-sm bg-olap" />
      <span className="whitespace-nowrap">{version !== undefined ? <>Delta <span className="tabular text-muted-foreground">v{version}</span></> : 'Delta'}</span>
    </span>
  )
}
