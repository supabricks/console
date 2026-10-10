import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, FileText, Loader2, MoreHorizontal, Package, Plus, Search, Square, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, ConfirmDelete, PageHeader, Section, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtN } from '@/lib/data'
import { newCell } from '@/lib/notebooks'
import type { Notebook } from '@/lib/notebooks'
import { useStore } from '@/lib/store'

export default function Notebooks() {
  const { notebooks, setNotebooks, setSessions, pipelines, databases } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [del, setDel] = useState<Notebook | null>(null)
  const create = () => {
    let i = 1, name = 'Untitled.ipynb'
    while (notebooks.some((n) => n.name === name)) name = `Untitled${i++}.ipynb`
    setNotebooks((ns) => [...ns, { name, modified: 'Just now', dirty: false, kernel: 'stopped', version: null, execCount: 0, cells: [newCell()] }])
    nav(`/notebooks/${name}`, { replace: params.has('new') })
  }
  useEffect(() => { if (params.has('new')) create() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = notebooks.filter((n) => n.name.toLowerCase().includes(q.toLowerCase()))
  const src = (n: Notebook) => { const p = pipelines.find((x) => x.id === 'pl_7c41e0a2') ?? pipelines[0]; return p && n.version ? `version ${fmtN(n.version)} of ${databases.find((d) => d.id === p.db)?.name} / ${p.branch}` : '' }

  return (
    <>
      <PageHeader
        title="Notebooks"
        description="Jupyter notebooks that belong to this project. Each one runs Python with a Spark session already connected to your synced tables."
        actions={<>
          <Button variant="outline" asChild><Link to="/notebooks/environment"><Package /> Environment</Link></Button>
          <Button variant="outline" onClick={() => toast.message('Upload a .ipynb file (simulated)')}><Upload /> Upload</Button>
          <Button onClick={create}><Plus /> New notebook</Button>
        </>}
      />
      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-64"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="Filter notebooks" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-xs text-muted-foreground">{rows.length} notebooks, {notebooks.filter((n) => n.kernel !== 'stopped').length} running</span>
        <BackingTag id="NB-01b" className="ml-1" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
        <Table>
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>Name</TableHead><TableHead>Kernel</TableHead><TableHead>Reading</TableHead><TableHead>Last saved</TableHead><TableHead className="text-right">Cells</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((n) => (
              <TableRow key={n.name} className="h-11">
                <TableCell><Link to={`/notebooks/${n.name}`} className="inline-flex items-center gap-2 font-medium hover:text-primary"><FileText className="size-4 text-olap" />{n.name}</Link></TableCell>
                <TableCell><StatusBadge status={n.kernel === 'stopped' ? 'idle' : n.kernel === 'idle' ? 'running' : n.kernel} /></TableCell>
                <TableCell className={n.version ? '' : 'text-muted-foreground'}>{n.version ? <span className="inline-flex items-center gap-2"><span className="size-2 rounded-sm bg-olap" />{src(n)}</span> : 'No kernel'}</TableCell>
                <TableCell className="text-muted-foreground">{n.modified}</TableCell>
                <TableCell className="tabular text-right">{n.cells.length}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${n.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => nav(`/notebooks/${n.name}`)}>Open</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { const name = n.name.replace('.ipynb', '-copy.ipynb'); setNotebooks((ns) => (ns.some((x) => x.name === name) ? ns : [...ns, { ...n, name, kernel: 'stopped', session: undefined, version: null, modified: 'Just now' }])); toast.success(`Created ${name}`) }}>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`Downloaded ${n.name} (simulated)`)}>Download</DropdownMenuItem>
                      <DropdownMenuItem disabled={n.kernel === 'stopped'} onClick={() => { setSessions((s) => s.filter((x) => x.id !== n.session)); setNotebooks((ns) => ns.map((x) => (x.name === n.name ? { ...x, kernel: 'stopped', session: undefined, version: null } : x))); toast.success('Kernel stopped') }}><Square /> Stop kernel</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDel(n)}>Delete…</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">A running kernel holds one of the installation's two analytical slots until it is stopped or expires.</p>
      <ConfirmDelete open={!!del} onOpenChange={(o) => !o && setDel(null)} name={del?.name ?? ''} kind="notebook" consequence="The file is removed from the project and its kernel is stopped. This cannot be undone."
        onConfirm={() => { if (del) { setSessions((s) => s.filter((x) => x.id !== del.session)); setNotebooks((ns) => ns.filter((x) => x.name !== del.name)); toast.success('Notebook deleted') } }} />
    </>
  )
}

export function Environment() {
  const { packages, setPackages, notebooks } = useStore()
  const [req, setReq] = useState('')
  const [offline, setOffline] = useState(true)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<[string, string, string][]>([['Oct 7, 10:12', 'Prepared', 'matplotlib 3.9.1 to 3.9.2'], ['Sep 30, 13:05', 'Initialised', 'base template, 4 packages']])
  const declared = packages.filter((p) => !p.runtime)
  const pending = packages.filter((p) => p.prepared !== p.running || p.spec === 'remove')
  const unprepared = packages.filter((p) => p.prepared === null || p.spec === 'remove')
  const running = notebooks.filter((n) => n.kernel !== 'stopped')
  const m = req.trim().match(/^([A-Za-z0-9_.-]+)\s*((?:==|>=|<=|~=|>|<).+)?$/)
  const state = busy ? 'Preparing' : unprepared.length ? 'Preparation needed' : pending.length ? 'Prepared, not yet in use' : 'Ready'
  const VERS: Record<string, string> = { polars: '1.9.0', 'scikit-learn': '1.5.2', seaborn: '0.13.2', requests: '2.32.3', duckdb: '1.1.1' }

  const prepare = () => {
    setBusy(true)
    setTimeout(() => {
      const changes = unprepared.map((p) => (p.spec === 'remove' ? `removed ${p.name}` : `added ${p.name} ${VERS[p.name] ?? '1.0.0'}`)).join(', ')
      setPackages((ps) => ps.filter((p) => p.spec !== 'remove' || p.running).map((p) => (p.spec === 'remove' ? { ...p, prepared: null } : p.prepared === null ? { ...p, prepared: VERS[p.name] ?? '1.0.0' } : p)))
      setLog((l) => [['Today 14:06', 'Prepared', changes], ...l]); setBusy(false); toast.success('Environment prepared', { description: 'Restart a kernel to use it.' })
    }, 2600)
  }

  return (
    <>
      <PageHeader
        title="Python environment"
        description="The packages every notebook in this project can import. Changes are prepared first, then picked up by a kernel when it restarts, so running work is never changed underneath you."
        actions={<Button variant="outline" asChild><Link to="/notebooks">Back to notebooks</Link></Button>}
      />
      <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="State" value={<span className="text-[1.3rem]">{state}</span>} sub={busy ? 'Resolving and installing' : unprepared.length ? `${unprepared.length} change${unprepared.length > 1 ? 's' : ''} to prepare` : 'Lock file matches the declaration'} />
        <Stat label="Python" value="3.12.6" sub="Bundled with this installation" />
        <Stat label="Packages" value={packages.filter((p) => p.prepared).length} sub={`${declared.filter((p) => p.spec !== 'remove').length} declared, the rest are dependencies`} />
        <Stat label="Kernels using it" value={running.length} sub={running.length ? (pending.length ? 'On the previous environment' : 'On the current environment') : 'None running'} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-8">
          <Section title="Packages" flush description="Declared packages are yours to change. Runtime packages come with the installation."
            actions={<Button size="sm" disabled={busy || !unprepared.length} onClick={prepare}>{busy ? <><Loader2 className="animate-spin" /> Preparing</> : 'Prepare changes'}</Button>}>
            <form className="flex items-end gap-2 border-b px-4 py-3" onSubmit={(e) => { e.preventDefault(); if (!m || packages.some((p) => p.name === m[1])) return; setPackages((ps) => [...ps, { name: m[1], spec: m[2]?.trim() ?? 'latest', prepared: null, running: null }]); setReq('') }}>
              <div className="grid flex-1 gap-1.5"><Label htmlFor="pkg">Add a package</Label><Input id="pkg" className="font-mono text-[13px]" placeholder="polars or scikit-learn==1.5.2" value={req} onChange={(e) => setReq(e.target.value)} /></div>
              <Button type="submit" variant="outline" disabled={!m || packages.some((p) => p.name === m[1])}><Plus /> Add</Button>
            </form>
            <Table>
              <TableHeader><TableRow><TableHead>Package</TableHead><TableHead>Declared</TableHead><TableHead>Prepared</TableHead><TableHead>In running kernels</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {packages.map((p) => (
                  <TableRow key={p.name} className={p.spec === 'remove' ? 'opacity-60' : undefined}>
                    <TableCell className="font-mono text-[13px]">{p.name}{p.runtime && <span className="ml-2 font-sans text-xs text-muted-foreground">runtime</span>}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.spec === 'remove' ? 'to be removed' : p.spec}</TableCell>
                    <TableCell className="tabular font-mono text-xs">{p.prepared ?? <span className="font-sans text-warning">Not prepared</span>}</TableCell>
                    <TableCell className="tabular font-mono text-xs">{p.running ?? <span className="font-sans text-muted-foreground">After restart</span>}</TableCell>
                    <TableCell>{!p.runtime && p.spec !== 'remove' && <Button variant="ghost" size="icon-xs" aria-label={`Remove ${p.name}`} onClick={() => setPackages((ps) => (p.prepared === null ? ps.filter((x) => x.name !== p.name) : ps.map((x) => (x.name === p.name ? { ...x, spec: 'remove' } : x))))}><X /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </div>
        <div className="grid content-start gap-8">
          <Section title="How packages are fetched">
            <label className="flex items-start gap-3">
              <Switch checked={offline} onCheckedChange={setOffline} className="mt-0.5" />
              <span><span className="font-medium">Offline packages only</span><span className="mt-0.5 block text-[13px] text-muted-foreground">{offline ? 'Only packages already on this machine or in an imported bundle are used. Nothing is downloaded.' : 'Packages are downloaded from the registry, then locked to exact versions and hashes.'}</span></span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => toast.message('Import an offline bundle from an absolute path (simulated)')}>Import offline bundle</Button>
              <Button variant="outline" size="sm" onClick={() => toast.success('Bundle exported (simulated)')}>Export offline bundle</Button>
            </div>
          </Section>
          <Section title="Kernels" flush>
            {running.length ? (
              <ul className="divide-y text-[13px]">{running.map((n) => (
                <li key={n.name} className="flex items-center gap-3 px-4 py-2.5">
                  <FileText className="size-4 text-olap" /><Link to={`/notebooks/${n.name}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">{n.name}</Link>
                  {pending.length ? <span className="text-warning">Restart to adopt</span> : <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="size-3.5" />Current</span>}
                </li>))}</ul>
            ) : <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No kernels are running. The next one to start uses the prepared environment.</div>}
          </Section>
          <Section title="History" flush>
            <ul className="divide-y text-[13px]">{log.map(([t, what, detail], i) => <li key={i} className="flex items-baseline gap-3 px-4 py-2.5"><span className="w-28 shrink-0 text-xs text-muted-foreground">{t}</span><span className="font-medium">{what}</span><span className="min-w-0 flex-1 truncate text-muted-foreground">{detail}</span></li>)}</ul>
          </Section>
        </div>
      </div>
    </>
  )
}
