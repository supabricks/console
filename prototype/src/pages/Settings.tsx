import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, Play, RotateCcw, ShieldCheck, Square, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, CodeBlock, ConfirmDelete, CopyField, PageHeader, Section, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { PROJECT } from '@/lib/access'
import { SERVICES } from '@/lib/data'
import { useStore } from '@/lib/store'

const row = 'grid grid-cols-[200px_1fr] items-center gap-3 py-2.5 text-[13px] [&>dt]:text-muted-foreground'
const pref = (k: string, d: string) => { try { return localStorage.getItem(`sb-pref-${k}`) ?? d } catch { return d } }
const save = (k: string, v: string) => { try { localStorage.setItem(`sb-pref-${k}`, v) } catch { /* storage unavailable */ } }

export default function ProjectSettings() {
  const { databases, pipelines, notebooks, jobs } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState(PROJECT)
  const [desc, setDesc] = useState('Orders, customers and revenue reporting for the sales team.')
  const [services, setServices] = useState(SERVICES.map(([n, d, s]) => ({ n, d, s })))
  const [stopped, setStopped] = useState(false)
  const [del, setDel] = useState(false)
  const [prefs, setPrefs] = useState({ db: pref('db', 'app'), readonly: pref('readonly', '1'), tz: pref('tz', 'utc'), rows: pref('rows', '200') })
  const setPref = (k: keyof typeof prefs, v: string) => { setPrefs({ ...prefs, [k]: v }); save(k, v) }
  const restart = (n: string) => { setServices((ss) => ss.map((x) => (x.n === n ? { ...x, s: 'starting' } : x))); setTimeout(() => setServices((ss) => ss.map((x) => (x.n === n ? { ...x, s: 'running' } : x))), 1500) }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Project settings" description={`How ${PROJECT} is named, how it behaves for you, and the services that run it.`} />
      <div className="grid grid-cols-1 gap-9 [&>*]:min-w-0">
        <Section title="General">
          <div className="grid gap-5">
            <div className="flex items-end gap-3">
              <div className="grid flex-1 gap-1.5"><Label htmlFor="ps-name" className="flex items-center gap-2">Name <BackingTag id="HM-01b" /></Label><Input id="ps-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <Button variant="outline" disabled={name === PROJECT || !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/.test(name)} onClick={() => toast.success(`Project renamed to ${name}`, { description: 'Its ID and the datasets other projects read from it are unchanged.' })}>Rename</Button>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="ps-desc" className="flex items-center gap-2">Description <BackingTag id="ST-02" /></Label><Textarea id="ps-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /><div><Button variant="outline" size="sm" onClick={() => toast.success('Description saved')}>Save</Button></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><CopyField label="Project ID" value="prj_sales_8f2a91c4" /><CopyField label="Folder on the server" value="/srv/supabricks/projects/sales-analytics" /></div>
            <dl className="divide-y border-t"><div className={row}><dt>Created</dt><dd className="tabular">2026-08-14</dd></div><div className={row}><dt>Definition</dt><dd>supabricks.toml, format 2, installed revision 3</dd></div><div className={row}><dt>Contains</dt><dd>{databases.length} databases, {pipelines.length} sync pipelines, {notebooks.length} notebooks, {jobs.length} jobs</dd></div></dl>
          </div>
        </Section>

        <Section title="Your preferences" description="These apply to you in this project and are kept in this browser.">
          <dl className="divide-y">
            <div className={row}><dt>Open the SQL editor on</dt><dd><Select value={prefs.db} onValueChange={(v) => setPref('db', v)}><SelectTrigger size="sm" className="w-56" aria-label="Default database"><SelectValue /></SelectTrigger><SelectContent>{databases.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select></dd></div>
            <div className={row}><dt>SQL editor starts read-only</dt><dd className="flex items-center gap-3"><Switch checked={prefs.readonly === '1'} onCheckedChange={(v) => setPref('readonly', v ? '1' : '0')} aria-label="Read-only by default" /><span className="text-muted-foreground">Writing needs a switch in the editor each time.</span></dd></div>
            <div className={row}><dt>Rows shown when browsing a table</dt><dd><Select value={prefs.rows} onValueChange={(v) => setPref('rows', v)}><SelectTrigger size="sm" className="w-56" aria-label="Rows shown"><SelectValue /></SelectTrigger><SelectContent>{['50', '100', '200', '500', '1000'].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></dd></div>
            <div className={row}><dt>Show times in</dt><dd><Select value={prefs.tz} onValueChange={(v) => setPref('tz', v)}><SelectTrigger size="sm" className="w-56" aria-label="Time zone"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="utc">UTC</SelectItem><SelectItem value="local">My time zone</SelectItem></SelectContent></Select></dd></div>
          </dl>
        </Section>

        <Section flush title="Services" tag={<BackingTag id="HM-04" />} description="The processes that run this project. They start on demand and restart themselves if they stop answering."
          actions={<Button variant="outline" onClick={() => { setStopped(!stopped); setServices((ss) => ss.map((x) => ({ ...x, s: stopped ? 'running' : 'stopped' }))); toast.success(stopped ? 'Project started' : 'Project stopped', { description: stopped ? undefined : 'Data is kept. Connections, sync and jobs are paused until you start it again.' }) }}>{stopped ? <><Play /> Start project</> : <><Square /> Stop project</>} <BackingTag id="HM-01b" compact /></Button>}>
          <Table>
            <TableBody>{services.map((x) => <TableRow key={x.n} className="h-12"><TableCell className="font-medium">{x.n}</TableCell><TableCell className="text-muted-foreground">{x.s === 'stopped' ? 'Not running' : x.d.replace('on this device', 'on the server')}</TableCell><TableCell className="w-32"><StatusBadge status={x.s} /></TableCell><TableCell className="w-28 text-right"><Button variant="ghost" size="sm" disabled={x.s !== 'running'} onClick={() => restart(x.n)}><RotateCcw /> Restart</Button></TableCell></TableRow>)}</TableBody>
          </Table>
        </Section>

        <div className="rounded-lg border border-destructive/30">
          <div className="flex items-center justify-between gap-4 p-4">
            <div><div className="flex items-center gap-2 font-medium">Delete this project <BackingTag id="HM-01b" /></div><div className="text-[13px] text-muted-foreground">Removes its databases and every branch, its analytical tables, notebooks, jobs and secrets. finance-ops reads a dataset this project publishes and would lose it.</div></div>
            <Button variant="outline" className="shrink-0 text-destructive hover:text-destructive" onClick={() => setDel(true)}>Delete project</Button>
          </div>
        </div>
      </div>
      <ConfirmDelete open={del} onOpenChange={setDel} name={PROJECT} kind="project" consequence={`${databases.length} databases, ${pipelines.length} sync pipelines, ${notebooks.length} notebooks and ${jobs.length} jobs are removed and cannot be recovered. Backups stored on this server are removed too. finance-ops loses the dataset it reads from this project.`} onConfirm={() => { toast.success(`${PROJECT} deleted (simulated)`); nav('/home') }} />
    </div>
  )
}

const LIMITS: [string, string, string][] = [
  ['Analytical session slots', '2 at a time', 'Shared by Spark SQL, notebooks and jobs in every project. A session ends after 15 minutes without use.'],
  ['Notebook and job runs', '2 at a time', 'Each gets 2 CPUs, 2 GiB of memory and 512 MiB of scratch space, with no outside network.'],
  ['Incremental sync capture', '1 for the server', 'Triggered and continuous sync share it. Snapshot sync does not need it.'],
  ['Change buffer and PostgreSQL log kept for sync', '512 MiB each', 'Sync warns at 80% and pauses capture at the limit.'],
  ['Database connections', '256', 'Across every database and branch.'],
  ['File import', '100 MiB a file', '512 MiB of upload space in total.'],
  ['SQL result shown', '1,000 rows or 256 KiB', 'One statement at a time, 8 tabs.'],
]
const CHECKS: [boolean, string, string][] = [
  [true, 'Installed files match the release', '1,284 files checked'],
  [true, 'PostgreSQL storage answers and is writable', '3 services'],
  [true, 'Analytical engine starts and reads a table', 'Started in 2.1 s'],
  [true, 'Catalog answers', '6 tables'],
  [true, 'Notebook sandbox starts', 'Isolated runtime present, images match'],
  [true, 'Identity provider reachable', '84 ms'],
  [false, 'Disk space', '54% used. At the current rate the disk is full in about 5 weeks.'],
]

export function InstallationSettings() {
  const [verify, setVerify] = useState<'idle' | 'running' | 'done'>('idle')
  const [doctor, setDoctor] = useState<'idle' | 'running' | 'done'>('done')
  const run = (set: typeof setVerify) => { set('running'); setTimeout(() => set('done'), 1600) }
  return (
    <div className="max-w-4xl">
      <PageHeader title="Server" description="The installation every project runs on. Most of this is set by whoever operates the server and is shown here so you can see it." />
      <div className="grid grid-cols-1 gap-9 [&>*]:min-w-0">
        <Section title="Version" tag={<BackingTag id="ST-01" />} actions={<Button variant="outline" disabled={verify === 'running'} onClick={() => run(setVerify)}>{verify === 'running' ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify installation</Button>}>
          <dl className="divide-y">
            <div className={row}><dt>Release</dt><dd className="flex items-center gap-3"><span className="font-mono font-medium">0.1.0-alpha.14</span><span className="text-muted-foreground">Installed 2026-10-01</span></dd></div>
            <div className={row}><dt>Runs on</dt><dd>Linux x86_64, governed profile</dd></div>
            <div className={row}><dt>Engines</dt><dd>PostgreSQL 17.8, Spark-compatible engine 0.7.1, Delta Lake, Unity Catalog</dd></div>
            <div className={row}><dt>Installed files</dt><dd>{verify === 'running' ? <span className="inline-flex items-center gap-2 text-info"><Loader2 className="size-3.5 animate-spin" />Checking every file against the release</span> : verify === 'done' ? <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-success" />All 1,284 files match the release, checked just now</span> : <span className="text-muted-foreground">Last verified Oct 1 at install</span>}</dd></div>
          </dl>
          <div className="mt-4 border-t pt-4">
            <div className="mb-1 text-[13px] font-medium">Upgrading</div>
            <p className="mb-2.5 max-w-[78ch] text-[13px] text-muted-foreground">An upgrade is run on the server from the new release, after a backup. It cannot be started from here, on purpose: it stops every project while it runs.</p>
            <CodeBlock code={'supabricks backup create /var/backups/supabricks/pre-upgrade\nsupabricks installation upgrade \\\n  --prefix /opt/supabricks \\\n  --previous /opt/supabricks-alpha.14 \\\n  --backup /var/backups/supabricks/pre-upgrade'} />
          </div>
        </Section>

        <Section title="Address" description="Where people reach this console. Only this address is exposed; the databases and engines behind it are private.">
          <dl className="divide-y">
            <div className={row}><dt>Console address</dt><dd className="font-mono text-[12.5px]">https://analytics.internal.example:8443</dd></div>
            <div className={row}><dt>Listens on</dt><dd className="font-mono text-[12.5px]">0.0.0.0:8443, TLS</dd></div>
            <div className={row}><dt>Data folder</dt><dd className="font-mono text-[12.5px]">/srv/supabricks/data</dd></div>
          </dl>
        </Section>

        <Section flush title="Diagnostics" tag={<BackingTag id="ST-01" />} description="The same checks the operator runs from the command line." actions={<Button variant="outline" disabled={doctor === 'running'} onClick={() => run(setDoctor)}>{doctor === 'running' ? <Loader2 className="animate-spin" /> : <Stethoscope />} Run checks</Button>}>
          <Table>
            <TableBody>{CHECKS.map(([ok, name, detail]) => <TableRow key={name} className="h-11"><TableCell className="w-10">{doctor === 'running' ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : ok ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}</TableCell><TableCell className="font-medium">{name}</TableCell><TableCell className="text-muted-foreground">{doctor === 'running' ? '' : detail}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Section>

        <Section flush title="Fixed limits" tag={<BackingTag id="UQ-03" />} description="Built into this release. They cannot be changed here or divided between projects yet.">
          <Table>
            <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>Limit</TableHead><TableHead>Value</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
            <TableBody>{LIMITS.map(([n, v, d]) => <TableRow key={n} className="h-12"><TableCell className="font-medium">{n}</TableCell><TableCell className="tabular whitespace-nowrap">{v}</TableCell><TableCell className="text-[13px] whitespace-normal text-muted-foreground">{d}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Section>
      </div>
    </div>
  )
}
