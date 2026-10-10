import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, CircleDashed, Download, FileCode2, FolderTree, GitFork, ListOrdered, Loader2, Network, PackageOpen, Rocket, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, CopyField, Section, Stat } from '@/components/common'
import { highlight } from '@/components/sql'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { fmtN, TABLES } from '@/lib/data'
import { APPLIES, CHECKPOINTS, EXCLUSIONS, FILES, fmtSize, layers, NOT_PACKAGED, RESOURCES, RUNTIME_ONLY, TOML } from '@/lib/project'
import type { Resource, ResState } from '@/lib/project'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const STATE: Record<ResState, { label: string; cls: string }> = {
  installed: { label: 'Installed', cls: 'text-muted-foreground' },
  changed: { label: 'Changed since install', cls: 'text-warning' },
  new: { label: 'Not installed yet', cls: 'text-info' },
  retained: { label: 'No longer declared, kept', cls: 'text-muted-foreground' },
}
const ACTION: Record<string, string> = { retain: 'Keep', prepare_offline: 'Prepare', transactional_migration: 'Run migration', load_new_table: 'Load table', install: 'Install', retained: 'Keep' }
const tone = (r: Resource) => (r.engine === 'pg' ? 'var(--oltp)' : r.engine === 'spark' ? 'var(--olap)' : 'var(--border)')

function useResources() {
  const { installedRev } = useStore()
  const done = installedRev > 3
  const rs = RESOURCES.map((r) => (done && (r.state === 'new' || r.state === 'changed') ? { ...r, state: 'installed' as ResState, actionDetail: r.group === 'migration' ? 'Already applied just now; receipt verified' : r.actionDetail } : r))
  return { rs, done, pending: rs.filter((r) => r.state === 'new' || r.state === 'changed') }
}

const NW = 208, NH = 46, CW = 250, RG = 10
function Graph({ rs, sel, onSel }: { rs: Resource[]; sel: string | null; onSel: (k: string) => void }) {
  const cols = layers(rs.filter((r) => r.state !== 'retained'))
  const pos = new Map<string, { x: number; y: number }>()
  cols.forEach((c, i) => c.forEach((r, j) => pos.set(r.key, { x: i * CW, y: j * (NH + RG) })))
  const H = Math.max(...cols.map((c) => c.length)) * (NH + RG) - RG, W = (cols.length - 1) * CW + NW
  const selRes = rs.find((r) => r.key === sel)
  const lit = (a: string, b: string) => sel === a || sel === b
  return (
    <div className="overflow-x-auto rounded-lg border bg-muted/30 p-5">
      <div className="mb-3 flex gap-0 text-xs text-muted-foreground" style={{ width: W }}>
        {cols.map((_, i) => <div key={i} style={{ width: i === cols.length - 1 ? NW : CW }}>{i === 0 ? 'Applied first' : i === cols.length - 1 ? 'Applied last' : ''}</div>)}
      </div>
      <div className="relative" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0" aria-hidden>
          {rs.flatMap((r) => r.dependsOn.map((d) => {
            const a = pos.get(d), b = pos.get(r.key)
            if (!a || !b) return null
            const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2
            const on = lit(d, r.key)
            return <path key={`${d}>${r.key}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none" stroke={on ? 'var(--primary)' : 'color-mix(in oklab, var(--foreground) 22%, transparent)'} strokeWidth={on ? 2 : 1.25} />
          }))}
        </svg>
        {[...pos].map(([k, p]) => {
          const r = rs.find((x) => x.key === k)!
          const dim = selRes && sel !== k && !selRes.dependsOn.includes(k) && !r.dependsOn.includes(sel!)
          return (
            <button key={k} onClick={() => onSel(k)} style={{ left: p.x, top: p.y, width: NW, height: NH, boxShadow: `inset 3px 0 0 ${tone(r)}` }}
              className={cn('absolute rounded-md border bg-card px-3 text-left transition-opacity hover:bg-muted/60', sel === k && 'border-primary ring-1 ring-primary', dim && 'opacity-45', r.state === 'new' && 'border-dashed border-info', r.state === 'changed' && 'border-warning')}>
              <div className="truncate font-mono text-[12.5px] font-medium">{k}</div>
              <div className={cn('truncate text-[11.5px]', r.state === 'installed' ? 'text-muted-foreground' : STATE[r.state].cls)}>{r.state === 'installed' ? r.kind : STATE[r.state].label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Definition() {
  const { rs } = useResources()
  const [view, setView] = useState('graph')
  const [sel, setSel] = useState<string | null>(null)
  const r = rs.find((x) => x.key === sel)
  const order = layers(rs.filter((x) => x.state !== 'retained')).flat()
  const retained = rs.filter((x) => x.state === 'retained')
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        <span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-oltp" />PostgreSQL</span>
        <span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-olap" />Analytics</span>
        <span className="text-muted-foreground">{order.length} resources. Lines show what must exist before each one is applied.</span>
        <BackingTag id="PJ-07" />
        <ToggleGroup type="single" variant="outline" size="sm" className="ml-auto" value={view} onValueChange={(v) => v && setView(v)}>
          <ToggleGroupItem value="graph" className="px-2.5"><Network /> Graph</ToggleGroupItem>
          <ToggleGroupItem value="list" className="px-2.5"><ListOrdered /> Apply order</ToggleGroupItem>
          <ToggleGroupItem value="file" className="px-2.5"><FileCode2 /> supabricks.toml</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {view === 'graph' && <Graph rs={rs} sel={sel} onSel={(k) => setSel(k)} />}
      {view === 'list' && (
        <div className="overflow-hidden rounded-lg border bg-card [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
          <Table>
            <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead className="w-10">#</TableHead><TableHead>Resource</TableHead><TableHead>Kind</TableHead><TableHead>File</TableHead><TableHead>Needs</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {order.map((x, i) => (
                <TableRow key={x.key} className="cursor-pointer" onClick={() => setSel(x.key)}>
                  <TableCell className="tabular text-muted-foreground">{i + 1}</TableCell>
                  <TableCell><span className="inline-flex items-center gap-2 font-mono text-[13px] font-medium"><span className="size-2 rounded-sm" style={{ background: tone(x) }} />{x.key}</span></TableCell>
                  <TableCell>{x.kind}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{x.file ?? ''}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{x.dependsOn.join(', ')}</TableCell>
                  <TableCell className={STATE[x.state].cls}>{STATE[x.state].label}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {view === 'file' && <pre className="max-h-[560px] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-[12.5px] leading-relaxed">{TOML}</pre>}

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Kept from earlier versions" flush description="Resources that were installed and are no longer declared. Applying a project never deletes anything." tag={<BackingTag id="PJ-10" />}>
          <ul className="divide-y text-[13px]">{retained.map((x) => <li key={x.key} className="flex items-center gap-3 px-4 py-2.5"><span className="font-mono font-medium">{x.key}</span><span className="text-muted-foreground">{x.kind}, {x.file}</span></li>)}</ul>
        </Section>
        <Section title="In this installation, not in the definition" flush description="These exist here but would not come along if you moved the project." tag={<BackingTag id="PJ-08" />}>
          <ul className="divide-y text-[13px]">{RUNTIME_ONLY.map(([what, why, to]) => <li key={what}><Link to={to} className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-muted/50"><span className="shrink-0 font-medium">{what}</span><span className="text-muted-foreground">{why}</span></Link></li>)}</ul>
        </Section>
      </div>

      <Sheet open={!!r} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {r && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-mono"><span className="size-2.5 rounded-sm" style={{ background: tone(r) }} />{r.key}</SheetTitle>
                <SheetDescription>{r.kind}. <span className={STATE[r.state].cls}>{STATE[r.state].label}</span></SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-6 text-[13px]">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  {r.file && <><dt className="text-muted-foreground">File</dt><dd className="font-mono text-[12.5px]">{r.file}</dd></>}
                  {r.fields.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono text-[12.5px]">{v}</dd></div>)}
                  <dt className="text-muted-foreground">Needs</dt><dd className="font-mono text-[12.5px]">{r.dependsOn.join(', ') || 'nothing'}</dd>
                  <dt className="text-muted-foreground">Needed by</dt><dd className="font-mono text-[12.5px]">{RESOURCES.filter((x) => x.dependsOn.includes(r.key)).map((x) => x.key).join(', ') || 'nothing'}</dd>
                </dl>
                {r.bound && <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">In this installation it is</div><div className="mt-0.5 font-medium">{r.bound}</div><p className="mt-1 text-xs text-muted-foreground">The definition only names this resource. Which real {r.group === 'dataset' ? 'publication' : 'database'} it means is decided here, and again on any machine the project moves to.</p></div>}
                {r.body && <div><div className="mb-1 text-muted-foreground">Contents</div><pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">{highlight(r.body)}</pre></div>}
                <div><div className="mb-1 text-muted-foreground">On the next apply</div><div><span className="font-medium">{ACTION[r.action]}.</span> {r.actionDetail}</div></div>
                {r.to && <Button asChild variant="outline"><Link to={r.to}>Open {r.kind.toLowerCase()} <ArrowRight /></Link></Button>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Files() {
  const total = FILES.reduce((n, f) => n + f.bytes, 0), source = FILES.filter((f) => !f.path.startsWith('dependencies/')).reduce((n, f) => n + f.bytes, 0)
  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Files that travel" value={FILES.length} sub="of 1,024 allowed" />
        <Stat label="Source size" value={fmtSize(source)} sub="of 32 MiB allowed" />
        <Stat label="Dependency bundles" value={fmtSize(total - source)} sub="of 256 MiB allowed" />
        <Stat label="Package size" value={fmtSize(total * 0.97)} sub="of 300 MiB allowed" />
      </div>
      <Section title="Files that travel" flush description="Exactly what a package contains: the project file, and every file a resource names or an include pattern matches. Nothing else is read.">
        <Table>
          <TableHeader><TableRow><TableHead>Path</TableHead><TableHead>Included by</TableHead><TableHead className="text-right">Size</TableHead><TableHead>Since last install</TableHead></TableRow></TableHeader>
          <TableBody>{FILES.map((f) => <TableRow key={f.path}><TableCell className="font-mono text-[13px]">{f.path}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{f.by}</TableCell><TableCell className="tabular text-right">{fmtSize(f.bytes)}</TableCell><TableCell className={f.changed === 'new' ? 'text-info' : f.changed ? 'text-warning' : 'text-muted-foreground'}>{f.changed === 'new' ? 'New' : f.changed ? 'Changed' : 'Unchanged'}</TableCell></TableRow>)}</TableBody>
        </Table>
      </Section>
      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="In the folder, left behind" flush>
          <ul className="divide-y text-[13px]">{NOT_PACKAGED.map(([p, why]) => <li key={p} className="flex items-baseline gap-3 px-4 py-2.5"><span className="shrink-0 font-mono">{p}</span><span className="text-muted-foreground">{why}</span></li>)}</ul>
        </Section>
        <Section title="What never travels">
          <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-muted-foreground">{EXCLUSIONS.map((e) => <li key={e}>{e}</li>)}</ul>
        </Section>
      </div>
    </div>
  )
}

function Deploy() {
  const { rs, done, pending } = useResources()
  const { installedRev, setInstalledRev } = useStore()
  const [phase, setPhase] = useState<'idle' | 'planned' | 'applying' | 'cancelled'>('idle')
  const [cp, setCp] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const steps = [...rs.filter((r) => r.group === 'environment'), ...layers(rs.filter((r) => r.state !== 'retained' && r.group !== 'environment')).flat()]
  const apply = () => {
    setPhase('applying'); setCp(0)
    let c = 0
    timer.current = setInterval(() => {
      c++
      if (c >= CHECKPOINTS.length) { clearInterval(timer.current!); setInstalledRev(installedRev + 1); setPhase('idle'); setCp(0); toast.success(`Revision ${installedRev + 1} is active`) }
      else setCp(c)
    }, 1100)
  }
  const cancel = () => { if (timer.current) clearInterval(timer.current); setPhase('cancelled') }
  const history = done ? [{ revision: installedRev, version: '0.4.0', when: 'Just now', state: 'succeeded', steps: steps.length, key: 'apply-2026-10-10', note: 'Added migration.add_loyalty_points, updated notebook.churn_features' }, ...APPLIES] : APPLIES

  return (
    <div className="grid gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="This deployment" description="A deployment is one installed copy of the project. The same project can be deployed more than once, here or on another machine.">
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[13px]">
            <dt className="text-muted-foreground">Folder</dt><dd className="font-mono text-[12.5px]">~/projects/sales-analytics</dd>
            <dt className="text-muted-foreground">Target</dt><dd>local <span className="text-muted-foreground">(development)</span></dd>
            <dt className="text-muted-foreground">Installed</dt><dd>Revision {installedRev}, package {done ? '0.4.0' : '0.3.0'}, {done ? 'just now' : 'Oct 8, 16:02'}</dd>
            <dt className="text-muted-foreground">Folder status</dt><dd className={done ? 'text-success' : 'text-warning'}>{done ? 'Matches what is installed' : `${pending.length} resources differ from what is installed`}</dd>
            <dt className="text-muted-foreground">Deployment ID</dt><dd className="truncate font-mono text-xs text-muted-foreground">dep_5b1e77c2-0a41-4f6e-9d3b-2c8f41a9e610</dd>
            <dt className="text-muted-foreground">Access</dt><dd>Local owner</dd>
          </dl>
        </Section>
        <Section title="What the names mean here" flush description="The definition uses names. Each deployment decides which real database or dataset a name refers to.">
          <ul className="divide-y text-[13px]">
            {rs.filter((r) => r.bound).map((r) => <li key={r.key} className="flex items-center gap-3 px-4 py-2.5"><span className="inline-flex shrink-0 items-center gap-2 font-mono font-medium"><span className="size-2 rounded-sm" style={{ background: tone(r) }} />{r.key}</span><ArrowRight className="size-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 truncate">{r.bound}</span></li>)}
          </ul>
        </Section>
      </div>

      <Section
        title={phase === 'applying' ? 'Applying' : phase === 'planned' ? 'Review the plan' : 'Install changes'}
        tag={<BackingTag id="PJ-02b" />}
        description={phase === 'idle' ? (done ? 'The folder and the installation match. Edit the project to plan again.' : 'Planning reads the folder and lists every step it would take. Nothing changes until you apply.') : phase === 'planned' ? 'These steps run in order. A plan is tied to this exact folder and installation; if either changes, plan again.' : undefined}
        actions={phase === 'idle' ? <Button disabled={done} onClick={() => setPhase('planned')}><Rocket /> Plan changes</Button> : phase === 'planned' ? <><Button variant="outline" onClick={() => setPhase('idle')}>Discard plan</Button><Button onClick={apply}>Apply plan</Button></> : phase === 'applying' ? <Button variant="outline" onClick={cancel}><X /> Cancel</Button> : <Button onClick={() => setPhase('planned')}>Plan again</Button>}
        flush={phase !== 'idle' || !done}
      >
        {phase === 'idle' && done && <div className="flex items-center gap-2 text-[13px] text-success"><Check className="size-4" /> Nothing to install.</div>}
        {phase === 'idle' && !done && (
          <ul className="divide-y text-[13px]">{pending.map((r) => <li key={r.key} className="flex items-center gap-3 px-4 py-2.5"><span className="inline-flex items-center gap-2 font-mono font-medium"><span className="size-2 rounded-sm" style={{ background: tone(r) }} />{r.key}</span><span className={STATE[r.state].cls}>{STATE[r.state].label}</span><span className="ml-auto font-mono text-xs text-muted-foreground">{r.file}</span></li>)}</ul>
        )}
        {phase === 'cancelled' && <div className="px-4 py-4 text-[13px]"><span className="font-medium">Apply cancelled.</span> Steps that had finished are kept and revision {installedRev} stays active. Plan again to continue.</div>}
        {phase === 'applying' && (
          <ol className="divide-y text-[13px]">
            {CHECKPOINTS.map((c, i) => (
              <li key={c} className={cn('flex items-center gap-3 px-4 py-2.5', i > cp && 'text-muted-foreground')}>
                {i < cp ? <Check className="size-4 text-success" /> : i === cp ? <Loader2 className="size-4 animate-spin text-primary" /> : <CircleDashed className="size-4" />}
                <span className={i === cp ? 'font-medium' : ''}>{c}</span>
                {i === 3 && i === cp && <span className="tabular ml-auto text-xs text-muted-foreground">migration.add_loyalty_points</span>}
              </li>
            ))}
          </ol>
        )}
        {phase === 'planned' && (
          <>
            <Table>
              <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Resource</TableHead><TableHead>Action</TableHead><TableHead>What happens</TableHead></TableRow></TableHeader>
              <TableBody>
                {steps.map((r, i) => {
                  const active = r.state === 'new' || r.state === 'changed'
                  return (
                    <TableRow key={r.key} className={active ? 'bg-accent/40' : undefined}>
                      <TableCell className="tabular text-muted-foreground">{i + 1}</TableCell>
                      <TableCell><span className="inline-flex items-center gap-2 font-mono text-[13px] font-medium"><span className="size-2 rounded-sm" style={{ background: tone(r) }} />{r.key}</span></TableCell>
                      <TableCell className={active ? 'font-medium' : 'text-muted-foreground'}>{ACTION[r.action]}</TableCell>
                      <TableCell className={cn('whitespace-normal', !active && 'text-muted-foreground')}>{r.actionDetail}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="grid gap-1 border-t bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
              <div><span className="font-medium text-foreground">Kept, not deleted:</span> query.find_customer is no longer declared. Its installed copy stays.</div>
              <div><span className="font-medium text-foreground">Not undone on failure:</span> a migration that has committed stays committed. The previous revision remains active until the last step.</div>
              <div><span className="font-medium text-foreground">Never run:</span> notebook cells and saved queries are installed, not executed.</div>
              <div className="font-mono text-xs">Plan 7c1f…a92e for source 41be…0d73</div>
            </div>
          </>
        )}
      </Section>

      <Section title="History" flush tag={<BackingTag id="PJ-03b" />}>
        <Table>
          <TableHeader><TableRow><TableHead>Revision</TableHead><TableHead>Package</TableHead><TableHead>Applied</TableHead><TableHead>Result</TableHead><TableHead>What changed</TableHead></TableRow></TableHeader>
          <TableBody>{history.map((a) => <TableRow key={a.key}><TableCell className="tabular font-medium">{a.state === 'failed' ? '' : a.revision}{a.revision === installedRev && a.state !== 'failed' && <span className="ml-2 rounded border px-1 text-[11px] font-normal text-muted-foreground">active</span>}</TableCell><TableCell className="tabular">{a.version}</TableCell><TableCell className="tabular text-muted-foreground">{a.when}</TableCell><TableCell className={a.state === 'failed' ? 'text-destructive' : 'text-success'}>{a.state === 'failed' ? 'Failed' : 'Succeeded'}</TableCell><TableCell className="whitespace-normal text-muted-foreground">{a.note}</TableCell></TableRow>)}</TableBody>
        </Table>
      </Section>
    </div>
  )
}

function Package() {
  const [preview, setPreview] = useState(false)
  const [inspected, setInspected] = useState(false)
  const [tables, setTables] = useState<Set<string>>(new Set(['public.customers']))
  const rows = TABLES.filter((t) => tables.has(`${t.schema}.${t.name}`)).reduce((n, t) => n + t.rows, 0)
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Section title="Export this project" description="A package is one file holding the project's definition and files. Building it twice from the same folder gives the same bytes." actions={<Button size="sm" variant={preview ? 'outline' : 'default'} onClick={() => setPreview(!preview)}><PackageOpen /> {preview ? 'Hide preview' : 'Preview export'}</Button>}>
        {preview ? (
          <div className="grid gap-4 text-[13px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
              <dt className="text-muted-foreground">File</dt><dd className="font-mono text-[12.5px]">sales-analytics-0.4.0.sbproj</dd>
              <dt className="text-muted-foreground">Contains</dt><dd>{RESOURCES.filter((r) => r.state !== 'retained').length} resources, {FILES.length} files, 58.6 MiB</dd>
              <dt className="text-muted-foreground">Needs at destination</dt><dd>PostgreSQL 17, Spark SQL, notebooks, shared datasets</dd>
              <dt className="text-muted-foreground">Must be supplied there</dt><dd>Which databases mean database.app and database.billing, and which publication satisfies finance.billing.v1</dd>
              <dt className="text-muted-foreground">Content hash</dt><dd className="truncate font-mono text-xs text-muted-foreground">sha256:9d41c07be2…f3a81</dd>
            </dl>
            <div className="flex gap-2"><Button onClick={() => toast.success('Downloaded sales-analytics-0.4.0.sbproj (simulated)')}><Download /> Download package</Button></div>
            <p className="text-xs text-muted-foreground">Notebook outputs are removed from the packaged copies. Your working files are not touched. A hash proves the file is intact, not who made it.</p>
          </div>
        ) : <p className="text-[13px] text-muted-foreground">Preview shows exactly what would be packaged before anything is written.</p>}
      </Section>

      <Section title="Open a package" description="Inspect a package before trusting it. Inspecting and unpacking never run SQL, Python or any script." actions={<Button size="sm" variant="outline" onClick={() => setInspected(true)}><Upload /> Choose package</Button>}>
        {inspected ? (
          <div className="grid gap-4 text-[13px]">
            <div className="flex items-center gap-2 text-success"><Check className="size-4" /> Verified: growth-0.2.1.sbproj is intact.</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
              <dt className="text-muted-foreground">Project</dt><dd>growth, package 0.2.1</dd>
              <dt className="text-muted-foreground">Contains</dt><dd>1 database, 2 migrations, 3 saved queries, 2 notebooks, 1 environment</dd>
              <dt className="text-muted-foreground">Needs</dt><dd>PostgreSQL 17, Spark SQL, notebooks</dd>
              <dt className="text-muted-foreground">Size</dt><dd className="tabular">4.2 MiB, 19 files</dd>
            </dl>
            <div className="flex gap-2"><Button onClick={() => toast.success('Unpacked to ~/projects/growth-1 as a new, unconnected project (simulated)')}>Unpack as a new project</Button><Button variant="ghost" onClick={() => setInspected(false)}>Discard</Button></div>
            <p className="text-xs text-muted-foreground">Unpacking writes a new folder and never overwrites one. The new project is not connected to any database until you create a deployment and apply a plan.</p>
          </div>
        ) : <p className="text-[13px] text-muted-foreground">Packages up to 300 MiB. The file is checked against its own hash and limits before its contents are shown.</p>}
      </Section>

      <Section title="Table data" tag={<BackingTag id="PJ-05" />} description="A package carries definitions, not rows. To move a small set of real rows, export them as a separate data file." actions={<Button size="sm" variant="outline" disabled={!tables.size || rows > 100000} onClick={() => toast.success(`Exported ${tables.size} table${tables.size > 1 ? 's' : ''} to sales-analytics.sbdata (simulated)`)}><Download /> Export data</Button>}>
        <div className="grid gap-2 text-[13px]">
          {TABLES.filter((t) => t.schema === 'public').map((t) => {
            const key = `${t.schema}.${t.name}`
            return (
              <label key={key} className="flex cursor-pointer items-center gap-3">
                <Checkbox checked={tables.has(key)} onCheckedChange={(c) => setTables((s) => { const n = new Set(s); if (c) n.add(key); else n.delete(key); return n })} />
                <span className="font-mono">{key}</span><span className="tabular ml-auto text-muted-foreground">about {fmtN(t.rows)} rows</span>
              </label>
            )
          })}
          <p className={cn('mt-2 text-xs', rows > 100000 ? 'text-destructive' : 'text-muted-foreground')}>{fmtN(rows)} of 100,000 rows allowed in one data file. Up to 16 tables and 32 MiB. Importing always creates new tables; it never overwrites or appends.</p>
        </div>
      </Section>

      <Section title="Fork" tag={<BackingTag id="PJ-06" />} description="Start a separate project from this one. The fork gets its own identity and is not connected to this installation's databases." actions={<Button size="sm" variant="outline" onClick={() => toast.success('Forked to ~/projects/sales-analytics-fork (simulated)')}><GitFork /> Fork project</Button>}>
        <CopyField label="From the command line" value="supabricks project fork --destination ~/projects/sales-analytics-fork --name sales-analytics-fork" />
      </Section>
    </div>
  )
}

export default function Project() {
  const { tab = 'definition' } = useParams()
  const nav = useNavigate()
  const { done, pending } = useResources()
  const { installedRev } = useStore()
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-5">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight">Project</h1>
          <p className="mt-1.5 max-w-[76ch] text-muted-foreground">Everything that makes up sales-analytics, declared in one folder: its databases, migrations, saved queries, notebooks and Python environment. The folder is what you version, package and move.</p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {[['Folder', '~/projects/sales-analytics'], ['Package version', '0.4.0'], ['Installed', `Revision ${installedRev}`], ['Targets', 'local (default), staging'], ['Needs', 'PostgreSQL 17, Spark SQL, notebooks, shared datasets']].map(([k, v]) => <div key={k} className="flex gap-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => nav('/project/package')}><Download /> Export</Button>
          <Button disabled={done} onClick={() => nav('/project/deploy')}><Rocket /> {done ? 'Up to date' : `Install ${pending.length} changes`}</Button>
        </div>
      </div>
      {!done && tab !== 'deploy' && (
        <Link to="/project/deploy" className="mb-5 flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/8 px-4 py-2.5 text-[13px] hover:bg-warning/12">
          <span className="size-2 rounded-full bg-warning" /><span><span className="font-medium">The folder has changed since revision {installedRev} was installed.</span> {pending.map((r) => r.key).join(' and ')} {pending.length > 1 ? 'are' : 'is'} not in effect yet.</span><span className="ml-auto shrink-0 font-medium text-primary">Review and install</span>
        </Link>
      )}
      <Tabs value={tab} onValueChange={(t) => nav(`/project/${t}`)}>
        <TabsList variant="line" className="mb-6 h-10 w-full justify-start gap-1 border-b p-0">
          <TabsTrigger value="definition" className="flex-none px-2.5"><Network /> Definition</TabsTrigger>
          <TabsTrigger value="files" className="flex-none px-2.5"><FolderTree /> Files</TabsTrigger>
          <TabsTrigger value="deploy" className="flex-none px-2.5"><Rocket /> Deploy</TabsTrigger>
          <TabsTrigger value="package" className="flex-none px-2.5"><PackageOpen /> Package</TabsTrigger>
        </TabsList>
        <TabsContent value="definition"><Definition /></TabsContent>
        <TabsContent value="files"><Files /></TabsContent>
        <TabsContent value="deploy"><Deploy /></TabsContent>
        <TabsContent value="package"><Package /></TabsContent>
      </Tabs>
    </>
  )
}
