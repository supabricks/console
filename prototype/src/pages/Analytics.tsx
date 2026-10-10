import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pin, PinOff, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, PageHeader, Section, StatusBadge } from '@/components/common'
import { Route } from '@/components/sync-parts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { deltaType, fmtN, SLOTS, slotsOf, TABLES, versionsFor } from '@/lib/data'
import type { Pipeline, Version } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function PipelinePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { pipelines, databases } = useStore()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-72" aria-label="Source"><SelectValue /></SelectTrigger>
      <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{databases.find((d) => d.id === p.db)?.name} / <span className="font-mono text-[12.5px]">{p.branch}</span></SelectItem>)}</SelectContent>
    </Select>
  )
}

export function Versions() {
  const { pipelines, databases, sessions } = useStore()
  const [plId, setPlId] = useState(pipelines[0]?.id ?? '')
  const [pinned, setPinned] = useState<Set<number>>(new Set([4169]))
  const [keep, setKeep] = useState('all')
  const [detail, setDetail] = useState<Version | null>(null)
  const [cleanup, setCleanup] = useState(false)
  const p = pipelines.find((x) => x.id === plId) as Pipeline | undefined
  if (!p) return <PageHeader title="Versions" description={<>Nothing is synced yet. <Link to="/sync/new" className="text-primary hover:underline">Create a pipeline</Link> to publish a first version.</>} />
  const dbName = databases.find((d) => d.id === p.db)?.name ?? ''
  const readers = (n: number) => sessions.filter((s) => s.pipeline === p.id && s.version === n)
  const all = versionsFor(p)
  const kept = keep === 'all' ? all : all.filter((v, i) => i < Number(keep) || pinned.has(v.n) || readers(v.n).length)
  const removable = all.length - (keep === 'all' ? all.length : kept.length)

  return (
    <>
      <PageHeader
        title="Versions"
        description="Every sync run publishes a complete, unchanging version of the analytical tables. Queries and notebooks read one version from start to finish, so a result can always be reproduced."
        actions={<><PipelinePicker value={plId} onChange={setPlId} /><Button variant="outline" onClick={() => setCleanup(true)}><Trash2 /> Clean up</Button></>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        <Route db={dbName} branch={p.branch} version={p.version} />
        <span className="text-muted-foreground">{fmtN(p.version)} versions published since {p.created}</span>
        <BackingTag id="AN-02a" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Version</TableHead><TableHead>Published</TableHead><TableHead>Produced by</TableHead><TableHead>PostgreSQL position</TableHead>
              <TableHead className="text-right"><span className="inline-flex items-center gap-1.5">Rows changed <BackingTag id="AN-02c" compact /></span></TableHead>
              <TableHead>Read by</TableHead><TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {kept.map((v, i) => {
              const r = readers(v.n)
              return (
                <TableRow key={v.n} className="h-11">
                  <TableCell>
                    <button className="inline-flex items-center gap-2 font-medium hover:text-primary" onClick={() => setDetail(v)}>
                      <span className="size-2 rounded-sm bg-olap" /><span className="tabular">{fmtN(v.n)}</span>
                    </button>
                    {i === 0 && v.n === p.version && <span className="ml-2 rounded border px-1 text-[11px] text-muted-foreground">latest</span>}
                    {pinned.has(v.n) && <Pin className="ml-2 inline size-3 text-olap" aria-label="Pinned" />}
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">{v.published}</TableCell>
                  <TableCell>{v.by}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{v.lsn}</TableCell>
                  <TableCell className="tabular text-right">{fmtN(v.rowsChanged)}</TableCell>
                  <TableCell className={r.length ? '' : 'text-muted-foreground'}>{r.length ? r.map((s) => s.owner.split(': ')[0]).join(', ') : 'Nobody'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild><Link to="/analytics/sql"><Sparkles className="text-olap" /> Query</Link></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={pinned.has(v.n) ? `Unpin version ${v.n}` : `Pin version ${v.n}`} title={pinned.has(v.n) ? 'Unpin' : 'Pin: keep this version through clean-up'} onClick={() => setPinned((s) => { const n = new Set(s); if (n.has(v.n)) n.delete(v.n); else n.add(v.n); return n })}>
                        {pinned.has(v.n) ? <PinOff /> : <Pin />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Showing the {kept.length} most recent. A version in use by a session, or pinned, is never removed by clean-up. <BackingTag id="AN-02b" className="ml-1" /></p>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-olap" />Version <span className="tabular">{fmtN(detail.n)}</span></SheetTitle>
                <SheetDescription>{dbName} / {p.branch}, published {detail.published.toLowerCase()}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-6">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                  <dt className="text-muted-foreground">Produced by</dt><dd>{detail.by}</dd>
                  <dt className="text-muted-foreground">Contains PostgreSQL up to</dt><dd className="font-mono">{detail.lsn}</dd>
                  <dt className="text-muted-foreground">Rows changed</dt><dd className="tabular">{fmtN(detail.rowsChanged)} since version {fmtN(detail.n - 1)}</dd>
                  <dt className="text-muted-foreground">Format</dt><dd>Delta Lake on Parquet, readable by any Delta reader</dd>
                  <dt className="text-muted-foreground">Read by</dt><dd>{readers(detail.n).map((s) => s.owner).join(', ') || 'Nobody right now'}</dd>
                </dl>
                <div>
                  <div className="mb-2 text-[13px] text-muted-foreground">Tables in this version</div>
                  <div className="divide-y rounded-md border">
                    {p.tables.map((key) => {
                      const t = TABLES.find((x) => `${x.schema}.${x.name}` === key)
                      return (
                        <details key={key} className="group px-3 py-2 text-[13px]">
                          <summary className="flex cursor-pointer list-none items-center justify-between"><span className="font-mono font-medium">{key}</span><span className="tabular text-xs text-muted-foreground">{t ? `about ${fmtN(t.rows)} rows` : ''}</span></summary>
                          <div className="mt-2 grid gap-0.5 font-mono text-xs">{t?.columns.map((c) => <div key={c.name} className="flex justify-between"><span>{c.name}</span><span className="text-olap">{deltaType(c.type).delta}</span></div>)}</div>
                        </details>
                      )
                    })}
                  </div>
                </div>
                <Button asChild><Link to="/analytics/sql"><Sparkles /> Query this version</Link></Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={cleanup} onOpenChange={setCleanup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clean up old versions</DialogTitle>
            <DialogDescription>Removes the files of versions nobody needs. Pinned versions and versions in use are always kept.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Keep the most recent</Label>
            <Select value={keep === 'all' ? '5' : keep} onValueChange={setKeep}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="2">2 versions</SelectItem><SelectItem value="5">5 versions</SelectItem><SelectItem value="10">10 versions</SelectItem></SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{pinned.size} pinned and {sessions.filter((s) => s.pipeline === p.id).length} in use will be kept as well.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setKeep('all'); setCleanup(false) }}>Cancel</Button>
            <Button onClick={() => { if (keep === 'all') setKeep('5'); setCleanup(false); toast.success(`Old versions removed${removable ? '' : ''}`) }}>Remove old versions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function Sessions() {
  const { sessions, setSessions, pipelines, databases } = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [plId, setPlId] = useState(pipelines[0]?.id ?? '')
  const [profile, setProfile] = useState<'compact' | 'analytical'>('compact')
  const used = sessions.reduce((n, s) => n + slotsOf(s), 0)
  const need = profile === 'analytical' ? 2 : 1
  const name = (id: string) => { const p = pipelines.find((x) => x.id === id); return p ? { db: databases.find((d) => d.id === p.db)?.name ?? '', branch: p.branch, latest: p.version } : { db: '', branch: 'deleted pipeline', latest: 0 } }

  return (
    <>
      <PageHeader
        title="Sessions"
        description="A session is a running Spark engine reading one version. SQL tabs, notebooks and the command-line shell each open their own, and they share this installation's capacity."
        actions={<Button onClick={() => setOpen(true)}><Plus /> Open session</Button>}
      />
      <div className="mb-8 max-w-xl">
        <div className="mb-2 flex items-baseline justify-between text-[13px]"><span className="font-medium">Capacity</span><span className="tabular text-muted-foreground">{used} of {SLOTS} slots in use</span></div>
        <div className="flex gap-1.5">
          {Array.from({ length: SLOTS }, (_, i) => <div key={i} className={cn('h-2.5 flex-1 rounded-sm', i < used ? 'bg-olap' : 'bg-muted')} />)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">A compact session takes one slot and an analytical session takes two. When capacity is full, new sessions are refused until one closes.</p>
      </div>
      <Section title="Open sessions" flush tag={<BackingTag id="AN-03c" />}>
        {sessions.length ? (
          <Table>
            <TableHeader><TableRow><TableHead>Opened by</TableHead><TableHead>Reading</TableHead><TableHead>Compute</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Expires</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {sessions.map((s) => {
                const n = name(s.pipeline)
                return (
                  <TableRow key={s.id} className="h-12">
                    <TableCell><div className="font-medium">{s.owner}</div><div className="font-mono text-xs text-muted-foreground">{s.id}</div></TableCell>
                    <TableCell>
                      <Route db={n.db} branch={n.branch} version={s.version} />
                      {n.latest > s.version && <div className="mt-0.5 text-xs text-muted-foreground">{fmtN(n.latest - s.version)} newer versions exist. This session keeps the one it opened.</div>}
                    </TableCell>
                    <TableCell className="capitalize">{s.profile} <span className="text-muted-foreground">({slotsOf(s)} slot{slotsOf(s) > 1 ? 's' : ''})</span></TableCell>
                    <TableCell><StatusBadge status={s.state === 'ready' ? 'idle' : s.state} /></TableCell>
                    <TableCell className="tabular text-muted-foreground">{s.started}</TableCell>
                    <TableCell className="tabular">in {s.expiresMin} min</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => { setSessions((x) => x.filter((y) => y.id !== s.id)); toast.success('Session closed') }}><X /> Close</Button></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No sessions are open. One starts when you run a Spark query or start a notebook kernel.</div>
        )}
      </Section>
      <p className="mt-2 text-xs text-muted-foreground">Sessions close after 15 minutes, or two minutes after the tab that opened them goes away. Closing a session cancels its running query.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Open a session</DialogTitle><DialogDescription>Starts a Spark engine on the latest version, ready for queries.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>Source</Label><PipelinePicker value={plId} onChange={setPlId} /></div>
            <div className="grid gap-1.5">
              <Label>Compute <BackingTag id="AN-03b" /></Label>
              <Select value={profile} onValueChange={(v) => setProfile(v as typeof profile)}>
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="compact">Compact, 1 slot</SelectItem><SelectItem value="analytical">Analytical, 2 slots</SelectItem></SelectContent>
              </Select>
            </div>
            {used + need > SLOTS && <p className="text-[13px] text-destructive">Not enough capacity: this needs {need} slot{need > 1 ? 's' : ''} and {SLOTS - used} {SLOTS - used === 1 ? 'is' : 'are'} free. Close a session first.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={used + need > SLOTS || !plId} onClick={() => {
              const id = `ses_${Math.random().toString(16).slice(2, 10)}`
              setSessions((s) => [...s, { id, owner: 'SQL editor: new tab', ownerKind: 'sql', pipeline: plId, version: name(plId).latest, profile, state: 'starting', started: '14:05', expiresMin: 15 }])
              setTimeout(() => setSessions((s) => s.map((x) => (x.id === id ? { ...x, state: 'ready' } : x))), 1400)
              setOpen(false); nav('/analytics/sql')
            }}>Open session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
