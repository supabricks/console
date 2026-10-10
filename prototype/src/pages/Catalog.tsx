import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ChevronRight, Database, FileText, FolderClosed, Library, Search, Share2, Sparkles, Table2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, ConfirmDelete, PageHeader, Section, StatusBadge } from '@/components/common'
import { DataGrid } from '@/components/data-grid'
import { Route } from '@/components/sync-parts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { fmtN, MODE_LABEL, OWN_TABLES, sampleFor, versionsFor } from '@/lib/data'
import type { CatTable, Publication, SharedDataset } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { freshness } from './Sync'

const full = (t: CatTable) => `${t.catalog}.${t.schema}.${t.name}`

function Arrow() {
  return <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
}
function Node({ tone, kind, title, sub, to }: { tone: 'oltp' | 'olap' | 'plain'; kind: string; title: React.ReactNode; sub?: string; to?: string }) {
  const body = (
    <div className={cn('w-52 rounded-lg border bg-card p-3', tone === 'oltp' && 'shadow-[inset_3px_0_0_var(--oltp)]', tone === 'olap' && 'shadow-[inset_3px_0_0_var(--olap)]', to && 'hover:bg-muted/50')}>
      <div className="text-xs text-muted-foreground">{kind}</div>
      <div className="mt-0.5 truncate text-[13px] font-medium">{title}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Detail({ t }: { t: CatTable }) {
  const { pipelines, publications, shared, notebooks, sessions } = useStore()
  const nav = useNavigate()
  const [desc, setDesc] = useState(t.comment ?? '')
  const [editing, setEditing] = useState(false)
  const pl = pipelines.find((p) => p.id === 'pl_7c41e0a2')
  const pub = t.kind === 'own' ? publications.find((p) => p.state === 'published') : undefined
  const ds = t.kind === 'shared' ? shared.find((d) => d.tables.includes(t)) : undefined
  const readers = notebooks.filter((n) => n.kernel !== 'stopped')
  const sample = sampleFor(t)

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h2 className="truncate font-mono text-lg font-semibold">{full(t)}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-2"><span className="size-2 rounded-sm bg-olap" />Delta table</span>
            {t.kind === 'own'
              ? <><span className="text-muted-foreground">Owned by this project</span>{pub ? <span className="text-success">Published, revision {pub.revision}</span> : <span className="text-muted-foreground">Not published</span>}{pl && <span className="text-muted-foreground">{freshness(pl)}</span>}</>
              : <><span className="text-muted-foreground">Shared by {ds?.owner}</span><span>Revision {ds?.revision}</span>{ds && ds.latest > ds.revision && <span className="text-warning">Update available</span>}</>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => nav('/notebooks?new=1')}><BookOpen /> New notebook</Button>
          <Button size="sm" onClick={() => nav('/analytics/sql')}><Sparkles /> Query</Button>
        </div>
      </div>
      <Tabs defaultValue="overview" key={full(t)}>
        <TabsList variant="line" className="mb-5 h-10 w-full justify-start gap-1 border-b p-0">
          {['overview', 'columns', 'sample', 'history', 'lineage', 'permissions'].map((x) => <TabsTrigger key={x} value={x} className="flex-none px-2.5 capitalize">{x}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="grid gap-6">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">Description <BackingTag id="UC-02a" /></div>
            {editing ? (
              <div className="grid gap-2"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} aria-label="Description" /><div className="flex gap-2"><Button size="sm" onClick={() => { setEditing(false); toast.success('Description saved') }}>Save</Button><Button size="sm" variant="ghost" onClick={() => { setDesc(t.comment ?? ''); setEditing(false) }}>Cancel</Button></div></div>
            ) : (
              <button className="block w-full rounded-md border border-transparent py-1 text-left hover:border-border hover:px-2" onClick={() => t.kind === 'own' && setEditing(true)}>{desc || <span className="text-muted-foreground">{t.kind === 'own' ? 'Add a description so others know what this table is for.' : 'No description.'}</span>}</button>
            )}
          </div>
          <dl className="grid gap-x-8 gap-y-2.5 text-[13px] sm:grid-cols-2 [&>div]:flex [&>div]:gap-3 [&_dt]:w-32 [&_dt]:shrink-0 [&_dt]:text-muted-foreground">
            <div><dt>Rows</dt><dd className="tabular">about {fmtN(t.rows)}</dd></div>
            <div><dt>Columns</dt><dd className="tabular">{t.columns.length}</dd></div>
            <div><dt>Format</dt><dd>Delta Lake on Parquet</dd></div>
            <div><dt>Writable</dt><dd>No. Analytical tables are read only.</dd></div>
            {t.kind === 'own' && pl ? <>
              <div><dt>Source</dt><dd><span className="inline-flex items-center gap-2"><span className="size-2 rounded-sm bg-oltp" /><span className="font-mono text-[12.5px]">{t.source}</span> on app / main</span></dd></div>
              <div><dt>Kept current by</dt><dd><Link className="text-primary hover:underline" to={`/sync/${pl.id}`}>{MODE_LABEL[pl.mode]} sync</Link></dd></div>
              <div><dt>Current version</dt><dd className="tabular">{fmtN(pl.version)}</dd></div>
              <div><dt>Stored at</dt><dd className="truncate font-mono text-xs">~/.supabricks/analytics/incremental/…/{t.name}</dd></div>
            </> : <>
              <div><dt>Owner project</dt><dd>{ds?.owner}</dd></div>
              <div><dt>Published</dt><dd>{ds?.published}</dd></div>
              <div><dt>Bound since</dt><dd>{ds?.bound}</dd></div>
              <div><dt>Copied here</dt><dd>No. Read in place from the owner's publication.</dd></div>
            </>}
          </dl>
        </TabsContent>

        <TabsContent value="columns">
          <div className="overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
            <Table>
              <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>Column</TableHead><TableHead>Type</TableHead><TableHead>Nullable</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
              <TableBody>{t.columns.map((c) => <TableRow key={c.name}><TableCell className="font-mono text-[13px]">{c.name}</TableCell><TableCell className="font-mono text-[13px] text-olap">{c.type}</TableCell><TableCell>{c.nullable ? 'Yes' : 'No'}</TableCell><TableCell className={c.comment ? 'whitespace-normal' : 'text-muted-foreground'}>{c.comment ?? 'None'}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="sample">
          <p className="mb-2 text-[13px] text-muted-foreground">The first {sample.length} rows{t.kind === 'own' && pl ? ` of version ${fmtN(pl.version)}` : ` of revision ${ds?.revision}`}. Reading a sample starts a short session.</p>
          <div className="overflow-hidden rounded-lg border"><DataGrid className="max-h-[420px]" columns={t.columns.map((c) => ({ name: c.name, type: c.type }))} rows={sample} /></div>
        </TabsContent>

        <TabsContent value="history">
          <div className="overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
            <Table>
              <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>{t.kind === 'own' ? 'Version' : 'Revision'}</TableHead><TableHead>Published</TableHead><TableHead>Change</TableHead></TableRow></TableHeader>
              <TableBody>
                {t.kind === 'own' && pl
                  ? versionsFor(pl, 8).map((v) => <TableRow key={v.n}><TableCell className="tabular font-medium">{fmtN(v.n)}</TableCell><TableCell className="tabular text-muted-foreground">{v.published}</TableCell><TableCell>{v.by}, {fmtN(Math.round(v.rowsChanged / 3))} rows changed</TableCell></TableRow>)
                  : Array.from({ length: 5 }, (_, i) => <TableRow key={i}><TableCell className="tabular font-medium">{(ds?.latest ?? 0) - i}{(ds?.latest ?? 0) - i === ds?.revision && <span className="ml-2 rounded border px-1 text-[11px] font-normal text-muted-foreground">bound</span>}</TableCell><TableCell className="tabular text-muted-foreground">Oct {9 - i}, 02:00</TableCell><TableCell>{i === 0 ? 'Schema change: column added' : 'Nightly refresh'}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
          {t.kind === 'own' && <p className="mt-2 text-xs text-muted-foreground"><Link to="/analytics/versions" className="text-primary hover:underline">All versions</Link></p>}
        </TabsContent>

        <TabsContent value="lineage">
          <div className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-muted/30 p-5">
            {t.kind === 'own' ? <>
              <Node tone="oltp" kind="PostgreSQL table" title={<span className="font-mono text-[12.5px]">{t.source}</span>} sub="app / main" to="/tables" /><Arrow />
              <Node tone="plain" kind="Sync pipeline" title={pl ? MODE_LABEL[pl.mode] : 'None'} sub={pl ? freshness(pl) : undefined} to={pl ? `/sync/${pl.id}` : undefined} /><Arrow />
              <Node tone="olap" kind="This table" title={<span className="font-mono text-[12.5px]">{t.schema}.{t.name}</span>} sub={pl ? `version ${fmtN(pl.version)}` : undefined} /><Arrow />
              <div className="grid content-start gap-2">
                {pub && <Node tone="plain" kind="Publication" title={pub.name} sub={`revision ${pub.revision}, read by ${pub.consumers.join(', ') || 'nobody'}`} to="/catalog/publications" />}
                {readers.map((n) => <Node key={n.name} tone="plain" kind="Notebook" title={n.name} sub={`reads version ${fmtN(n.version ?? 0)}`} to={`/notebooks/${n.name}`} />)}
                {sessions.some((s) => s.ownerKind === 'sql') && <Node tone="plain" kind="Spark SQL" title="SQL editor tab" to="/analytics/sql" />}
                {!pub && !readers.length && <div className="self-center text-[13px] text-muted-foreground">Nothing reads this table yet.</div>}
              </div>
            </> : <>
              <Node tone="plain" kind="Project" title={ds?.owner} sub="owns and refreshes the data" /><Arrow />
              <Node tone="plain" kind="Publication" title={ds?.name} sub={`revision ${ds?.revision}`} /><Arrow />
              <Node tone="olap" kind="This table" title={<span className="font-mono text-[12.5px]">{t.schema}.{t.name}</span>} sub="bound, read in place" /><Arrow />
              <div className="self-center text-[13px] text-muted-foreground">Nothing in this project reads it yet.</div>
            </>}
          </div>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">Lineage is recorded from sync, publication and open sessions. It is not traced through Python code or individual columns. <BackingTag id="UC-02b" /></p>
        </TabsContent>

        <TabsContent value="permissions" className="grid gap-3">
          <div className="overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
            <Table>
              <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>Who</TableHead><TableHead>Can</TableHead><TableHead>Through</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell className="font-medium">Local owner</TableCell><TableCell>Read, publish, withdraw</TableCell><TableCell className="text-muted-foreground">Owner of this installation</TableCell></TableRow>
                {t.kind === 'own' && pub?.consumers.map((c) => <TableRow key={c}><TableCell className="font-medium">Project {c}</TableCell><TableCell>Read revision {pub.revision}</TableCell><TableCell className="text-muted-foreground">Bound to publication {pub.name}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
          <p className="max-w-[80ch] text-[13px] text-muted-foreground">This installation has one owner, so there is nobody else to grant access to. On a shared server, read access is granted per person or group and enforced by Unity Catalog. <BackingTag id="UC-07" className="ml-1" /></p>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Explorer() {
  const { shared } = useStore()
  const [q, setQ] = useState('')
  const bound = shared.filter((d) => d.bound)
  const groups = [{ label: 'This project', catalog: 'sales_analytics', schema: 'app', tables: OWN_TABLES }, ...bound.map((d) => ({ label: `Shared by ${d.owner}`, catalog: d.tables[0].catalog, schema: d.tables[0].schema, tables: d.tables }))]
  const [sel, setSel] = useState<CatTable>(OWN_TABLES[1])
  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="self-start rounded-lg border bg-sidebar/40 p-2">
        <div className="relative mb-2"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-7 pl-8 text-[13px]" placeholder="Search tables" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {groups.map((g) => {
          const ts = g.tables.filter((t) => full(t).includes(q.toLowerCase()))
          if (!ts.length) return null
          return (
            <div key={g.catalog + g.schema} className="mb-2">
              <div className="px-1.5 pb-0.5 text-xs text-muted-foreground">{g.label}</div>
              <div className="flex h-7 items-center gap-1.5 px-1.5 text-[13px]"><Library className="size-3.5 text-muted-foreground" /><span className="font-mono">{g.catalog}</span></div>
              <div className="flex h-7 items-center gap-1.5 pr-1.5 pl-5 text-[13px]"><FolderClosed className="size-3.5 text-muted-foreground" /><span className="font-mono">{g.schema}</span></div>
              {ts.map((t) => (
                <button key={full(t)} onClick={() => setSel(t)} className={cn('flex h-7 w-full items-center gap-1.5 rounded-md pr-1.5 pl-9 text-left text-[13px] hover:bg-accent', sel === t && 'bg-accent font-medium')}>
                  <Table2 className="size-3.5 shrink-0 text-olap" /><span className="truncate font-mono">{t.name}</span>
                </button>
              ))}
            </div>
          )
        })}
        <p className="mt-1 px-1.5 text-xs text-muted-foreground">PostgreSQL tables are in the <Link to="/explorer" className="text-primary hover:underline">object explorer</Link>.</p>
      </aside>
      <Detail t={sel} />
    </div>
  )
}

function PublishDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pipelines, databases, setPublications, publications } = useStore()
  const [plId, setPlId] = useState(pipelines[0]?.id ?? '')
  const [follows, setFollows] = useState<'fixed' | 'latest'>('fixed')
  const [step, setStep] = useState(0)
  const pl = pipelines.find((p) => p.id === plId)
  const existing = publications.find((p) => p.pipeline === plId && p.state === 'published')
  const dbName = databases.find((d) => d.id === pl?.db)?.name ?? ''
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); setStep(0) }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{step === 0 ? 'Publish to the catalog' : 'Review publication'}</DialogTitle>
          <DialogDescription>{step === 0 ? 'Publishing makes a version of your analytical tables discoverable by other projects. They can read it once they bind it.' : 'Check what will be published before confirming.'}</DialogDescription>
        </DialogHeader>
        {step === 0 ? (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Tables from</Label>
              <Select value={plId} onValueChange={setPlId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{pipelines.filter((p) => p.version > 0).map((p) => <SelectItem key={p.id} value={p.id}>{databases.find((d) => d.id === p.db)?.name} / <span className="font-mono text-[12.5px]">{p.branch}</span>, version {fmtN(p.version)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <RadioGroup value={follows} onValueChange={(v) => setFollows(v as typeof follows)} className="grid gap-2">
              {[['fixed', `Version ${fmtN(pl?.version ?? 0)} only`, 'Readers get exactly this version until you publish again.'], ['latest', 'Always the latest version', 'Readers see new versions as sync publishes them.']].map(([v, title, sub]) => (
                <label key={v} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', follows === v ? 'border-primary bg-accent/50' : 'hover:bg-muted/50')}>
                  <RadioGroupItem value={v} className="mt-0.5" /><span><span className="font-medium">{title}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
                </label>
              ))}
            </RadioGroup>
          </div>
        ) : (
          <div className="grid gap-3 text-[13px]">
            <dl className="divide-y rounded-lg border [&>div]:flex [&>div]:gap-4 [&>div]:px-3 [&>div]:py-2 [&_dt]:w-28 [&_dt]:shrink-0 [&_dt]:text-muted-foreground">
              <div><dt>Name</dt><dd className="font-mono">sales_analytics.{dbName}</dd></div>
              <div><dt>Contents</dt><dd>{follows === 'fixed' ? `Version ${fmtN(pl?.version ?? 0)}` : 'The latest version, kept up to date'}</dd></div>
              <div><dt>Tables</dt><dd className="font-mono text-[12.5px]">{pl?.tables.join(', ')}</dd></div>
              <div><dt>Revision</dt><dd>{existing ? `${existing.revision + 1}, replacing revision ${existing.revision}` : '1'}</dd></div>
            </dl>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>All {pl?.tables.length} tables are published together. <BackingTag id="UC-03b" className="ml-1" /></li>
              <li>No data is copied. The published version is kept until you withdraw it and its readers finish.</li>
              <li>Publishing does not give anyone access. Another project must bind the dataset to read it.</li>
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => (step ? setStep(0) : onOpenChange(false))}>{step ? 'Back' : 'Cancel'}</Button>
          {step === 0 ? <Button disabled={!pl} onClick={() => setStep(1)}>Review</Button> : <Button onClick={() => {
            const id = `pub_${Math.random().toString(16).slice(2, 10)}`
            setPublications((ps) => [{ id, name: `sales_analytics.${dbName}`, pipeline: plId, revision: (existing?.revision ?? 0) + 1, version: pl!.version, follows, state: 'publishing', published: 'Just now', consumers: existing?.consumers ?? [] }, ...ps.filter((p) => p.id !== existing?.id)])
            setTimeout(() => setPublications((ps) => ps.map((p) => (p.id === id ? { ...p, state: 'published' } : p))), 1600)
            onOpenChange(false); setStep(0); toast.success('Publication started')
          }}>Publish</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Publications({ onPublish }: { onPublish: () => void }) {
  const { publications, setPublications, pipelines, databases } = useStore()
  const [del, setDel] = useState<Publication | null>(null)
  return (
    <>
      <Section title="Published by this project" flush description="Each publication is a complete set of tables at one version. Other projects find it in their catalog and bind it to read it." actions={<Button size="sm" onClick={onPublish}><Upload /> Publish</Button>}>
        {publications.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>Publication</TableHead><TableHead>Source</TableHead><TableHead>Revision</TableHead><TableHead>Contents</TableHead><TableHead>Status</TableHead><TableHead>Read by</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {publications.map((p) => {
                const pl = pipelines.find((x) => x.id === p.pipeline)
                return (
                  <TableRow key={p.id} className="h-12">
                    <TableCell><div className="font-mono text-[13px] font-medium">{p.name}</div><div className="text-xs text-muted-foreground">Published {p.published.toLowerCase()}</div></TableCell>
                    <TableCell>{pl ? <Route db={databases.find((d) => d.id === pl.db)?.name ?? ''} branch={pl.branch} /> : 'Deleted pipeline'}</TableCell>
                    <TableCell className="tabular">{p.revision}</TableCell>
                    <TableCell>{p.follows === 'fixed' ? <>Version <span className="tabular">{fmtN(p.version)}</span>{pl && pl.version > p.version && <div className="text-xs text-muted-foreground">{fmtN(pl.version - p.version)} newer versions not published</div>}</> : 'Always the latest'}</TableCell>
                    <TableCell><StatusBadge status={p.state === 'published' ? 'active' : p.state === 'publishing' ? 'starting' : 'idle'} /></TableCell>
                    <TableCell className={p.consumers.length ? '' : 'text-muted-foreground'}>{p.consumers.length ? p.consumers.map((c) => `Project ${c}`).join(', ') : 'Nobody yet'}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" disabled={p.state !== 'published'} onClick={() => setDel(p)}>Withdraw</Button></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">Nothing is published. Publish a version to share it with other projects.</div>}
      </Section>
      <ConfirmDelete open={!!del} onOpenChange={(o) => !o && setDel(null)} name={del?.name ?? ''} kind="publication"
        consequence={del?.consumers.length ? `${del.consumers.map((c) => `Project ${c}`).join(', ')} reads this publication. Its open sessions finish on the version they hold, then lose access. The data stays in your project.` : 'The publication is removed from the catalog. The data stays in your project.'}
        onConfirm={() => { if (del) { setPublications((ps) => ps.filter((p) => p.id !== del.id)); toast.success('Publication withdrawn') } }} />
    </>
  )
}

function SharedTab() {
  const { shared, setShared } = useStore()
  const [bind, setBind] = useState<SharedDataset | null>(null)
  const [upd, setUpd] = useState<SharedDataset | null>(null)
  const [rm, setRm] = useState<SharedDataset | null>(null)
  const [name, setName] = useState('')
  const bound = shared.filter((d) => d.bound), avail = shared.filter((d) => !d.bound)
  const Tables = ({ d }: { d: SharedDataset }) => <span className="font-mono text-[12.5px]">{d.tables.map((t) => t.name).join(', ')}</span>
  return (
    <div className="grid gap-8">
      <Section title="Bound to this project" flush description="Datasets other projects published that this project has chosen to use. They appear in the catalog and can be queried from Spark and notebooks.">
        {bound.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>Dataset</TableHead><TableHead>Shared by</TableHead><TableHead>Tables</TableHead><TableHead>Revision</TableHead><TableHead className="w-56" /></TableRow></TableHeader>
            <TableBody>
              {bound.map((d) => (
                <TableRow key={d.id} className="h-12">
                  <TableCell><div className="font-mono text-[13px] font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.comment}</div></TableCell>
                  <TableCell>Project {d.owner}</TableCell>
                  <TableCell><Tables d={d} /></TableCell>
                  <TableCell><span className="tabular">{d.revision}</span>{d.latest > d.revision && <div className="text-xs text-warning">Revision {d.latest} is available</div>}</TableCell>
                  <TableCell><div className="flex justify-end gap-1">{d.latest > d.revision && <Button size="sm" variant="outline" onClick={() => setUpd(d)}>Review update</Button>}<Button size="sm" variant="ghost" onClick={() => setRm(d)}>Remove</Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No shared datasets are bound to this project.</div>}
      </Section>
      <Section title="Available to bind" flush description="Published by other projects on this installation. Seeing a dataset here does not give you its data; binding it does.">
        {avail.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>Dataset</TableHead><TableHead>Shared by</TableHead><TableHead>Tables</TableHead><TableHead>Published</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {avail.map((d) => (
                <TableRow key={d.id} className="h-12">
                  <TableCell><div className="font-mono text-[13px] font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.comment}</div></TableCell>
                  <TableCell>Project {d.owner}</TableCell>
                  <TableCell><Tables d={d} /></TableCell>
                  <TableCell className="text-muted-foreground">{d.published}, revision {d.revision}</TableCell>
                  <TableCell className="text-right"><Button size="sm" onClick={() => { setBind(d); setName(d.name) }}><Share2 /> Bind</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">Every available dataset is already bound.</div>}
      </Section>

      <Dialog open={!!bind} onOpenChange={(o) => !o && setBind(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bind {bind?.name}</DialogTitle><DialogDescription>Review what binding does before applying.</DialogDescription></DialogHeader>
          <div className="grid gap-4 text-[13px]">
            <div className="grid gap-1.5"><Label htmlFor="bind-name">Name in this project</Label><Input id="bind-name" className="font-mono" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Adds {bind?.tables.length} read-only table{(bind?.tables.length ?? 0) > 1 ? 's' : ''} to this project's catalog: <Tables d={bind ?? shared[0]} />.</li>
              <li>Binds revision {bind?.revision}. You review each later revision before moving to it.</li>
              <li>No data is copied. Project {bind?.owner} can see that this project reads the dataset.</li>
              <li>The binding is recorded in the project, so it travels when the project is packaged.</li>
            </ul>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBind(null)}>Cancel</Button><Button disabled={!/^[a-z_][a-z0-9_.]*$/.test(name)} onClick={() => { setShared((s) => s.map((d) => (d.id === bind!.id ? { ...d, bound: 'Just now' } : d))); toast.success(`${name} is bound. Find it in the catalog.`); setBind(null) }}>Apply binding</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!upd} onOpenChange={(o) => !o && setUpd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update {upd?.name} to revision {upd?.latest}?</DialogTitle><DialogDescription>What changed since revision {upd?.revision}.</DialogDescription></DialogHeader>
          <ul className="divide-y rounded-lg border font-mono text-[13px]">
            <li className="flex gap-3 px-3 py-2"><span className="font-bold text-success">+</span><span>payments.reference</span><span className="ml-auto text-xs text-muted-foreground">string, nullable</span></li>
            <li className="flex gap-3 px-3 py-2"><span className="font-bold text-warning">~</span><span>invoices</span><span className="ml-auto text-xs text-muted-foreground">+214 rows</span></li>
            <li className="flex gap-3 px-3 py-2"><span className="font-bold text-warning">~</span><span>payments</span><span className="ml-auto text-xs text-muted-foreground">+388 rows</span></li>
          </ul>
          <p className="text-[13px] text-muted-foreground">Open sessions and notebooks keep revision {upd?.revision} until they restart. No columns were removed, so existing queries keep working.</p>
          <DialogFooter><Button variant="outline" onClick={() => setUpd(null)}>Keep revision {upd?.revision}</Button><Button onClick={() => { setShared((s) => s.map((d) => (d.id === upd!.id ? { ...d, revision: d.latest } : d))); toast.success(`Now on revision ${upd!.latest}`); setUpd(null) }}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDelete open={!!rm} onOpenChange={(o) => !o && setRm(null)} name={rm?.name ?? ''} kind="binding" consequence="The dataset's tables leave this project's catalog. Queries and notebooks that use them will fail. The owner's data is not affected, and you can bind it again."
        onConfirm={() => { if (rm) { setShared((s) => s.map((d) => (d.id === rm.id ? { ...d, bound: null } : d))); toast.success('Binding removed') } }} />
    </div>
  )
}

export default function Catalog() {
  const { tab = 'explorer' } = useParams()
  const nav = useNavigate()
  const [publish, setPublish] = useState(false)
  const [service, setService] = useState(false)
  return (
    <>
      <PageHeader
        title="Catalog"
        description="Every analytical table this project owns or has been given, in one place. Backed by open-source Unity Catalog, so other engines that speak its protocol can find the same tables."
        actions={<>
          <button onClick={() => setService(true)} className="flex h-8 items-center gap-2 rounded-md border px-2.5 text-[13px] hover:bg-muted"><span className="size-2 rounded-full bg-success" />Unity Catalog ready</button>
          <Button onClick={() => setPublish(true)}><Upload /> Publish</Button>
        </>}
      />
      <Tabs value={tab} onValueChange={(t) => nav(`/catalog/${t}`)}>
        <TabsList variant="line" className="mb-6 h-10 w-full justify-start gap-1 border-b p-0">
          <TabsTrigger value="explorer" className="flex-none px-2.5"><Database /> Tables</TabsTrigger>
          <TabsTrigger value="publications" className="flex-none px-2.5"><Upload /> Publications</TabsTrigger>
          <TabsTrigger value="shared" className="flex-none px-2.5"><Share2 /> Shared datasets</TabsTrigger>
        </TabsList>
        <TabsContent value="explorer"><Explorer /></TabsContent>
        <TabsContent value="publications"><Publications onPublish={() => setPublish(true)} /></TabsContent>
        <TabsContent value="shared"><SharedTab /></TabsContent>
      </Tabs>
      <PublishDialog open={publish} onOpenChange={setPublish} />
      <Sheet open={service} onOpenChange={setService}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader><SheetTitle className="flex items-center gap-2">Catalog service <BackingTag id="UC-06" /></SheetTitle><SheetDescription>The Unity Catalog server this installation runs for you.</SheetDescription></SheetHeader>
          <div className="grid gap-5 px-4 pb-6 text-[13px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Status</dt><dd><StatusBadge status="running" /></dd>
              <dt className="text-muted-foreground">Kind</dt><dd>Local, bundled with Supabricks</dd>
              <dt className="text-muted-foreground">Version</dt><dd>Unity Catalog (open source) 0.3</dd>
              <dt className="text-muted-foreground">Address</dt><dd className="font-mono">127.0.0.1:8743</dd>
              <dt className="text-muted-foreground">Reachable from</dt><dd>This device only</dd>
              <dt className="text-muted-foreground">Objects</dt><dd>3 catalogs, 4 schemas, 6 tables</dd>
            </dl>
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => toast.success('Catalog service restarted (simulated)')}>Restart</Button><Button variant="outline" size="sm" onClick={() => toast.success('Access key rotated (simulated)')}>Rotate access key</Button></div>
            <div className="rounded-lg border p-3"><div className="flex items-center gap-2 font-medium"><FileText className="size-4 text-muted-foreground" />Use an existing Unity Catalog</div><p className="mt-1 text-muted-foreground">Point Supabricks at a Unity Catalog server you already run instead of the bundled one. Set up from the command line: <code className="font-mono text-xs">supabricks catalog service configure external</code>.</p></div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
