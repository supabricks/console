import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Bot, ChevronDown, Code2, Database, FileText, FolderOpen, GitBranchPlus, Plus, RefreshCw, Search, Table2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, CodeBlock, CopyField, PageHeader, Section, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ACTIVITY, fmtMb, fmtN, MODE_LABEL, PROJECTS, RECENT, SERVICES, SIZES, SLOTS, slotsOf } from '@/lib/data'
import type { Database as Db, Pipeline, Project } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { freshness } from './Sync'

const KIND_ICON = { notebook: FileText, query: Code2, table: Table2, pipeline: RefreshCw }

/** One row of the project map: a database branch, how it is synced, and what that produces. */
function MapRow({ db, pl, first, branches }: { db: Db; pl?: Pipeline; first: boolean; branches: number }) {
  const size = SIZES.find((s) => s.id === db.size)!
  const stopped = pl && (pl.state === 'blocked' || pl.state === 'paused')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,1.1fr)_minmax(0,1fr)] items-center">
      {first ? (
        <Link to={`/databases/${db.name}`} className="rounded-lg border bg-card p-3 shadow-[inset_3px_0_0_var(--oltp)] hover:bg-muted/50">
          <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{db.name}</span><StatusBadge status={db.state} /></div>
          <div className="mt-1 text-xs text-muted-foreground">{branches} branch{branches === 1 ? '' : 'es'}, {size.vcpu} vCPU, {fmtMb(db.storageMb)}</div>
        </Link>
      ) : <div className="flex justify-end" aria-hidden><div className="h-10 w-10 -translate-y-1/2 rounded-bl-lg border-b border-l border-dashed" /></div>}
      {pl ? (
        <Link to={`/sync/${pl.id}`} className="group flex flex-col items-center px-3 text-center">
          <div className="text-xs"><span className="font-mono text-[12px]">{pl.branch}</span><span className="text-muted-foreground">, {MODE_LABEL[pl.mode].toLowerCase()}</span></div>
          <div className="relative my-1.5 h-px w-full bg-border">
            <div className={cn('absolute inset-0', stopped ? '' : 'bg-gradient-to-r from-oltp to-olap')} />
            <span className={cn('absolute top-1/2 right-0 size-0 -translate-y-1/2 border-y-4 border-l-[6px] border-y-transparent', stopped ? 'border-l-border' : 'border-l-olap')} />
          </div>
          <div className={cn('text-xs group-hover:underline', pl.state === 'blocked' ? 'font-medium text-destructive' : 'text-muted-foreground')}>{pl.state === 'blocked' ? 'Blocked: needs a resync' : pl.state === 'paused' ? 'Paused' : freshness(pl)}</div>
        </Link>
      ) : (
        <div className="flex flex-col items-center px-3 text-center">
          <div className="my-1.5 h-px w-full border-t border-dashed" />
          <Link to="/sync/new" className="text-xs text-primary hover:underline">Not synced. Set up sync</Link>
        </div>
      )}
      {pl ? (
        <Link to="/catalog" className="rounded-lg border bg-card p-3 shadow-[inset_3px_0_0_var(--olap)] hover:bg-muted/50">
          <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{pl.tables.length} Delta tables</span><span className="tabular text-xs text-muted-foreground">version {fmtN(pl.version)}</span></div>
          <div className="mt-1 truncate font-mono text-[11.5px] text-muted-foreground">{pl.tables.map((t) => t.split('.')[1]).join(', ')}</div>
        </Link>
      ) : <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No analytical tables</div>}
    </div>
  )
}

export function Overview() {
  const { databases, branches, pipelines, sessions, notebooks, publications, shared } = useStore()
  const nav = useNavigate()
  const [agent, setAgent] = useState(false)
  const used = sessions.reduce((n, s) => n + slotsOf(s), 0)
  const kernels = notebooks.filter((n) => n.kernel !== 'stopped').length
  const blocked = pipelines.filter((p) => p.state === 'blocked')

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-6">
        <div className="min-w-0">
          <h1 className="truncate text-[1.6rem] leading-tight font-semibold tracking-tight">sales-analytics</h1>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {[['Runs', 'On this device'], ['Folder', '~/projects/sales-analytics'], ['Created', '2026-08-14'], ['Supabricks', '0.1.0-alpha.36']].map(([k, v]) => <div key={k} className="flex gap-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAgent(true)}><Bot /> Connect an agent</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button><Plus /> New <ChevronDown className="opacity-70" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => nav('/databases')}><Database /> Database</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav('/branches')}><GitBranchPlus /> Branch</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav('/sync/new')}><RefreshCw /> Sync pipeline</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav('/sql')}><Code2 /> SQL query</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav('/notebooks?new=1')}><BookOpen /> Notebook</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {blocked.map((p) => (
        <Link key={p.id} to={`/sync/${p.id}`} className="mb-5 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/6 px-4 py-2.5 text-[13px] hover:bg-destructive/10">
          <span className="size-2 rounded-full bg-destructive" /><span><span className="font-medium">Sync is blocked on {databases.find((d) => d.id === p.db)?.name} / <span className="font-mono text-[12.5px]">{p.branch}</span>.</span> {p.blocked?.title}. Its analytical tables have not updated since {p.lastSuccess.toLowerCase()}.</span><span className="ml-auto shrink-0 font-medium text-primary">Review</span>
        </Link>
      ))}

      <section className="mb-8 rounded-lg border bg-muted/30 p-5">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_minmax(180px,1.1fr)_minmax(0,1fr)] text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-oltp" />PostgreSQL <BackingTag id="HM-05" /></div>
          <div className="text-center">Sync</div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-olap" />Analytics</div>
        </div>
        <div className="grid gap-2.5">
          {databases.map((db) => {
            const pls = pipelines.filter((p) => p.db === db.id)
            const n = branches.filter((b) => b.db === db.id).length
            return pls.length
              ? pls.map((pl, i) => <MapRow key={pl.id} db={db} pl={pl} first={i === 0} branches={n} />)
              : <MapRow key={db.id} db={db} first branches={n} />
          })}
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Link to="/analytics/sessions" className="hover:opacity-80"><Stat label="Spark sessions" value={`${used} of ${SLOTS}`} sub="analytical slots in use" /></Link>
        <Link to="/notebooks" className="hover:opacity-80"><Stat label="Notebooks" value={notebooks.length} sub={`${kernels} with a running kernel`} /></Link>
        <Link to="/catalog/publications" className="hover:opacity-80"><Stat label="Published" value={publications.filter((p) => p.state === 'published').length} sub="datasets other projects can bind" /></Link>
        <Link to="/catalog/shared" className="hover:opacity-80"><Stat label="Shared with you" value={shared.filter((d) => d.bound).length} sub={`${shared.filter((d) => !d.bound).length} more available to bind`} /></Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.9fr)]">
        <Section title="Pick up where you left off" flush tag={<BackingTag id="HM-02" compact />}>
          <ul className="divide-y text-[13px]">
            {RECENT.map((r) => { const Icon = KIND_ICON[r.kind]; return (
              <li key={r.name}><Link to={r.to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                <Icon className={cn('size-4 shrink-0', r.kind === 'query' || r.kind === 'table' ? 'text-oltp' : 'text-olap')} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-xs text-muted-foreground">{r.where}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.when}</span>
              </Link></li>) })}
          </ul>
        </Section>
        <Section title="Activity" flush tag={<BackingTag id="HM-03" compact />}>
          <ul className="divide-y text-[13px]">
            {ACTIVITY.map((a) => (
              <li key={a.what}><Link to={a.to} className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-muted/50">
                <span className="tabular w-16 shrink-0 text-xs text-muted-foreground">{a.when}</span>
                <span className={cn('min-w-0 flex-1', a.status === 'failed' && 'text-destructive')}>{a.what}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.area}</span>
              </Link></li>
            ))}
          </ul>
        </Section>
        <Section title="Services" flush tag={<BackingTag id="HM-04" compact />}>
          <ul className="divide-y text-[13px]">
            {SERVICES.map(([name, detail, state]) => (
              <li key={name} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn('size-2 shrink-0 rounded-full', state === 'running' ? 'bg-success' : 'bg-destructive')} />
                <span className="min-w-0 flex-1"><span className="block font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Dialog open={agent} onOpenChange={setAgent}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Connect a coding agent</DialogTitle><DialogDescription>Agents work with this project through the same operations as this console: create a branch, run a query, start a sync, read the catalog.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <CopyField label="Start the MCP server for this project" value="supabricks mcp --project ~/projects/sales-analytics" />
            <div><div className="mb-1 text-[13px] text-muted-foreground">Or add it to your agent's configuration</div><CodeBlock code={`{\n  "mcpServers": {\n    "supabricks": {\n      "command": "supabricks",\n      "args": ["mcp", "--project", "~/projects/sales-analytics"]\n    }\n  }\n}`} /></div>
            <p className="text-[13px] text-muted-foreground">The agent is bound to this one project. Branches it creates are marked as agent-created in the branch list and can be given an expiry.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function Home() {
  const nav = useNavigate()
  const [projects, setProjects] = useState(PROJECTS)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [start, setStart] = useState('empty')
  const valid = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?$/.test(name) && !projects.some((p) => p.name === name)
  const rows = projects.filter((p) => p.name.includes(q.toLowerCase()))
  const openProject = (p: Project) => (p.current ? nav('/overview') : toast.message(`${p.name} opens in its own window`, { description: 'Only sales-analytics has data in this prototype.' }))

  return (
    <>
      <PageHeader
        title="Projects"
        description="A project holds databases, sync pipelines, notebooks and saved queries that belong together. Its definition lives in a folder you can put under version control."
        actions={<><Button variant="outline" onClick={() => toast.message('Choose a .sbproj package to import (simulated)')}><Upload /> Import package</Button><Button onClick={() => setOpen(true)}><Plus /> New project</Button></>}
      />
      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-64"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="Filter projects" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-xs text-muted-foreground">{rows.length} projects on this device</span>
        <BackingTag id="HM-01b" className="ml-1" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <button key={p.id} onClick={() => openProject(p)} className={cn('rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40', p.current && 'border-primary/60')}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[15px] font-semibold">{p.name}</span>
              <StatusBadge status={p.state} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-muted-foreground"><FolderOpen className="size-3.5 shrink-0" />{p.path}</div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-[13px]">
              <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-sm bg-oltp" />Databases</dt><dd className="tabular mt-0.5 font-medium">{p.databases}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Pipelines</dt><dd className="tabular mt-0.5 font-medium">{p.pipelines}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-sm bg-olap" />Notebooks</dt><dd className="tabular mt-0.5 font-medium">{p.notebooks}</dd></div>
            </dl>
            <div className="mt-3 text-xs text-muted-foreground">Last active {p.lastActive.toLowerCase()}</div>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New project</DialogTitle><DialogDescription>Creates a project folder and a first PostgreSQL database called main.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="prj-name">Name</Label>
              <Input id="prj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-project" autoComplete="off" />
              <p className="font-mono text-xs text-muted-foreground">~/projects/{name || 'my-project'}</p>
            </div>
            <RadioGroup value={start} onValueChange={setStart} className="grid gap-2">
              {[['empty', 'Empty', 'One empty database, ready for your tables.'], ['sample', 'Sample data', 'An orders and customers dataset with a sync pipeline and a notebook, to explore the product.']].map(([v, title, sub]) => (
                <label key={v} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', start === v ? 'border-primary bg-accent/50' : 'hover:bg-muted/50')}>
                  <RadioGroupItem value={v} className="mt-0.5" /><span><span className="font-medium">{title}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!valid} onClick={() => { setProjects((ps) => [...ps, { id: `prj_${name}`, name, path: `~/projects/${name}`, databases: 1, pipelines: start === 'sample' ? 1 : 0, notebooks: start === 'sample' ? 1 : 0, lastActive: 'Now', created: '2026-10-10', state: 'running' }]); setOpen(false); setName(''); toast.success(`Project ${name} created`) }}>Create project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
