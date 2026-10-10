import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Clock, Code2, Diff, GitBranchPlus, List, MoreHorizontal, Network, Pause, Play, Search, Star } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, ConfirmDelete, CopyField, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BranchLanes, depthOf, treeOrder } from '@/components/branch-graph'
import { fmtMb } from '@/lib/data'
import type { Branch } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const EXPIRY: Record<string, string | null> = { none: null, '1d': '2026-10-10 14:05', '7d': '2026-10-16 14:05', '30d': '2026-11-08 14:05' }

function CreateBranch({ open, onOpenChange, parent }: { open: boolean; onOpenChange: (o: boolean) => void; parent: string }) {
  const { db, dbBranches, setBranches, setBranchName } = useStore()
  const [from, setFrom] = useState(parent)
  const [name, setName] = useState('')
  const [point, setPoint] = useState('head')
  const [time, setTime] = useState('2026-10-09T12:00')
  const [lsn, setLsn] = useState('0/4A3F2E18')
  const [expiry, setExpiry] = useState('none')
  const taken = dbBranches.some((b) => b.name === name)
  const valid = /^[a-z0-9][a-z0-9/_-]{0,62}$/.test(name) && !taken && (point !== 'lsn' || /^[0-9A-F]+\/[0-9A-F]+$/i.test(lsn))

  const create = () => {
    const p = point === 'head' ? `Head of ${from}` : point === 'time' ? `${time.replace('T', ' ')} UTC` : `LSN ${lsn}`
    setBranches((b) => [...b, { id: `br_${Math.random().toString(16).slice(2, 10)}`, db: db.id, name, parent: from, state: 'running', isDefault: false, created: '2026-10-09 14:05', expires: EXPIRY[expiry], point: p, deltaMb: 0, lsn: point === 'lsn' ? lsn : '0/4A3F2E18', createdBy: 'you' }])
    toast.success(`Branch ${name} created from ${from}`, { description: 'Ready in 0.4 s. No data was copied.', action: { label: 'Use branch', onClick: () => setBranchName(name) } })
    onOpenChange(false); setName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New branch</DialogTitle>
          <DialogDescription>A branch is an instant, isolated copy of a database. It shares storage with its parent until either one changes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Parent branch</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{dbBranches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="br-name">Branch name</Label>
              <Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="feature/checkout-v2" autoComplete="off" aria-invalid={taken} />
              {taken && <p className="text-xs text-destructive">A branch with this name exists.</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Branch from</Label>
            <RadioGroup value={point} onValueChange={setPoint} className="grid gap-2">
              {[
                ['head', 'Current data', `Everything committed on ${from} up to now.`, null],
                ['time', 'A point in time', 'The parent as it was at a past moment, within the 7-day history window.', 'BR-02b'],
                ['lsn', 'A log position (LSN)', 'An exact write-ahead log position, for precise recovery.', 'BR-02b'],
              ].map(([v, title, desc, tag]) => (
                <label key={v} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', point === v ? 'border-primary bg-primary/8' : 'hover:bg-muted/50')}>
                  <RadioGroupItem value={v!} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">{title}{tag && <BackingTag id={tag} />}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                    {point === v && v === 'time' && <Input type="datetime-local" className="mt-2 w-60" value={time} onChange={(e) => setTime(e.target.value)} min="2026-10-02T14:05" max="2026-10-09T14:05" aria-label="Timestamp (UTC)" />}
                    {point === v && v === 'lsn' && <Input className="mt-2 w-60 font-mono" value={lsn} onChange={(e) => setLsn(e.target.value)} aria-label="Log position" />}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="grid gap-1.5">
            <Label>Delete automatically <BackingTag id="BR-02b" /></Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Never</SelectItem><SelectItem value="1d">After 1 day</SelectItem><SelectItem value="7d">After 7 days</SelectItem><SelectItem value="30d">After 30 days</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={create}>Create branch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const DIFF = [
  { kind: 'added', obj: 'column', name: 'customers.loyalty_points', detail: 'integer NOT NULL DEFAULT 0' },
  { kind: 'added', obj: 'table', name: 'loyalty_ledger', detail: '5 columns, primary key (id)' },
  { kind: 'added', obj: 'index', name: 'loyalty_ledger_customer_id_idx', detail: 'btree (customer_id)' },
  { kind: 'changed', obj: 'column', name: 'orders.coupon_code', detail: 'text → varchar(32)' },
  { kind: 'removed', obj: 'index', name: 'customers_region_idx', detail: 'btree (region)' },
]

function SchemaDiff({ open, onOpenChange, a }: { open: boolean; onOpenChange: (o: boolean) => void; a: string }) {
  const { dbBranches } = useStore()
  const [left, setLeft] = useState(a)
  const [right, setRight] = useState('main')
  const same = left === right
  const tone: Record<string, string> = { added: 'text-success', removed: 'text-destructive', changed: 'text-warning' }
  const sign: Record<string, string> = { added: '+', removed: '−', changed: '~' }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Schema diff <BackingTag id="BR-05" /></DialogTitle>
          <DialogDescription>Structural differences between two branches. Row data is not compared.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          {[[left, setLeft], [right, setRight]].map(([v, set], i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              {i === 1 && <span className="text-xs text-muted-foreground">compared with</span>}
              <Select value={v as string} onValueChange={set as (s: string) => void}>
                <SelectTrigger className="w-full font-mono text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>{dbBranches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {same ? (
          <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">Pick two different branches.</p>
        ) : (
          <>
            <div className="flex gap-3 text-xs"><span className="text-success">3 added</span><span className="text-warning">1 changed</span><span className="text-destructive">1 removed</span></div>
            <ul className="divide-y rounded-md border font-mono text-[13px]">
              {DIFF.map((d) => (
                <li key={d.name} className="flex items-baseline gap-3 px-3 py-2">
                  <span className={cn('w-3 font-bold', tone[d.kind])}>{sign[d.kind]}</span>
                  <span className="w-14 font-sans text-xs text-muted-foreground">{d.obj}</span>
                  <span>{d.name}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{d.detail}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={same} onClick={() => toast.success('Migration SQL copied (simulated)')}>Copy as migration SQL</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ROW_H = 40
const GRAPH_W = 260

export default function Branches() {
  const { db, dbBranches, setBranches, branchName, setBranchName } = useStore()
  const nav = useNavigate()
  const [view, setView] = useState('tree')
  const [q, setQ] = useState('')
  const [create, setCreate] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [del, setDel] = useState<Branch | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [rename, setRename] = useState<Branch | null>(null)
  const [newName, setNewName] = useState('')
  const [fresh, setFresh] = useState<string | null>(null)
  const known = useRef(new Set(dbBranches.map((b) => b.id)))
  useEffect(() => {
    const added = dbBranches.find((b) => !known.current.has(b.id))
    dbBranches.forEach((b) => known.current.add(b.id))
    if (added) setFresh(added.id)
  }, [dbBranches])

  const patch = (id: string, p: Partial<Branch>) => setBranches((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)))
  const rows = (view === 'tree' ? treeOrder(dbBranches) : [...dbBranches].sort((a, b) => b.created.localeCompare(a.created))).filter((b) => b.name.includes(q.toLowerCase()))
  const graph = view === 'tree' && !q
  const d = dbBranches.find((b) => b.id === detail)
  const children = (name: string) => dbBranches.filter((b) => b.parent === name)

  const menu = (b: Branch) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${b.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => { setBranchName(b.name); nav('/sql') }}><Code2 /> Open in SQL editor</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setCreate(b.name)}><GitBranchPlus /> Branch from here</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDiff(b.name)}><Diff /> Compare schema…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { patch(b.id, { state: b.state === 'running' ? 'suspended' : 'running' }); toast.success(`${b.name} ${b.state === 'running' ? 'suspended' : 'resumed'}`) }}>
          {b.state === 'running' ? <><Pause /> Suspend</> : <><Play /> Resume</>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setRename(b); setNewName(b.name) }}>Rename…</DropdownMenuItem>
        <DropdownMenuItem disabled={b.isDefault} onClick={() => { setBranches((bs) => bs.map((x) => (x.db === db.id ? { ...x, isDefault: x.id === b.id } : x))); toast.success(`${b.name} is now the default branch`) }}><Star /> Set as default</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { patch(b.id, { expires: b.expires ? null : '2026-10-16 14:05' }); toast.success(b.expires ? 'Expiry cleared' : 'Expires in 7 days') }}><Clock /> {b.expires ? 'Clear expiry' : 'Expire in 7 days'}</DropdownMenuItem>
        <DropdownMenuItem disabled={!b.parent} onClick={() => { patch(b.id, { deltaMb: 0, point: `Head of ${b.parent}` }); toast.success(`${b.name} reset to the current state of ${b.parent}`) }}>Reset from parent</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={b.isDefault} onClick={() => setDel(b)}>Delete…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <PageHeader
        title="Branches"
        description={<>Branches of <span className="font-medium text-foreground">{db.name}</span>. Create one in under a second to test a migration, reproduce a bug or give an agent a safe copy.</>}
        actions={
          <>
            <Button variant="outline" onClick={() => setDiff(branchName)}><Diff /> Compare schema</Button>
            <Button onClick={() => setCreate(branchName)}><GitBranchPlus /> New branch</Button>
          </>
        }
      />
      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-64"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="Filter branches" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-xs text-muted-foreground">{rows.length} branches, {rows.filter((b) => b.state === 'running').length} running</span>
        <ToggleGroup type="single" variant="outline" size="sm" className="ml-auto" value={view} onValueChange={(v) => v && setView(v)}>
          <ToggleGroupItem value="tree" aria-label="Graph view" className="px-2.5"><Network /> Graph</ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className="px-2.5"><List /> Recent</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="relative min-w-[900px]">
          <div className="flex h-9 items-center border-b bg-muted/50 text-[13px] text-muted-foreground">
            <div className="w-[300px] shrink-0 px-4">Branch</div>
            {graph && <div className="flex shrink-0 justify-between pr-3 pl-2.5" style={{ width: GRAPH_W }}><span>Forked</span><span>Now</span></div>}
            <div className="w-28 shrink-0 px-3">Status</div>
            <div className="min-w-0 flex-1 px-3">Created from</div>
            <div className="w-40 shrink-0 px-3">Expires</div>
            <div className="flex w-36 shrink-0 items-center justify-end gap-1.5 px-3">Changed data <BackingTag id="BR-01b" compact /></div>
            <div className="w-12 shrink-0" />
          </div>
          {rows.map((b) => {
            const depth = graph ? depthOf(b, dbBranches) : 0
            return (
              <div key={b.id} className={cn('group flex items-center border-b text-[13px] last:border-b-0 hover:bg-muted/40', b.name === branchName && 'bg-accent/50')} style={{ height: ROW_H }}>
                <div className="flex w-[300px] shrink-0 items-center gap-2 px-4" style={{ paddingLeft: 16 + depth * 16 }}>
                  <button className="min-w-0 truncate font-mono text-[12.5px] font-medium hover:text-primary hover:underline" onClick={() => setDetail(b.id)}>{b.name}</button>
                  {b.isDefault && <span className="rounded border px-1 text-[11px] text-muted-foreground">default</span>}
                  {b.name === branchName && <span className="rounded bg-primary px-1 text-[11px] font-medium text-primary-foreground">in use</span>}
                  {b.createdBy.startsWith('agent') && <span title={`Created by ${b.createdBy}`}><Bot className="size-3.5 text-muted-foreground" /></span>}
                </div>
                {graph && <div className="shrink-0" style={{ width: GRAPH_W }} />}
                <div className="w-28 shrink-0 px-3"><StatusBadge status={b.state} /></div>
                <div className="min-w-0 flex-1 truncate px-3 text-muted-foreground">{b.point}</div>
                <div className={cn('tabular w-40 shrink-0 px-3', !b.expires && 'text-muted-foreground')}>{b.expires ?? 'Never'}</div>
                <div className="tabular w-36 shrink-0 px-3 text-right">{b.parent ? `+${fmtMb(b.deltaMb)}` : fmtMb(b.deltaMb)}</div>
                <div className="w-12 shrink-0">{menu(b)}</div>
              </div>
            )
          })}
          {graph && (
            <div className="absolute" style={{ left: 300, top: 36 }}>
              <BranchLanes rows={rows} all={dbBranches} rowH={ROW_H} width={GRAPH_W} inUse={branchName} fresh={fresh} />
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Each line runs from the moment a branch forked to now. A dashed fork was taken from an earlier point in time. Paused lines are suspended branches.</p>

      {create && <CreateBranch key={create} open onOpenChange={(o) => !o && setCreate(null)} parent={create} />}
      {diff && <SchemaDiff key={diff} open onOpenChange={(o) => !o && setDiff(null)} a={diff} />}
      <ConfirmDelete
        open={!!del} onOpenChange={(o) => !o && setDel(null)} name={del?.name ?? ''} kind="branch"
        consequence={del && children(del.name).length ? `This branch has ${children(del.name).length} child branch(es). They are deleted too.` : 'Data that exists only on this branch is deleted. The parent branch is not affected.'}
        onConfirm={() => { if (!del) return; const names = [del.name, ...children(del.name).map((c) => c.name)]; setBranches((bs) => bs.filter((b) => !(b.db === db.id && names.includes(b.name)))); if (names.includes(branchName)) setBranchName('main'); toast.success(`Branch ${del.name} deleted`) }}
      />
      <Dialog open={!!rename} onOpenChange={(o) => !o && setRename(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2">Rename branch <BackingTag id="BR-04b" /></DialogTitle><DialogDescription>Connection strings that name this branch must be updated.</DialogDescription></DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New branch name" className="font-mono" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRename(null)}>Cancel</Button>
            <Button disabled={!newName || newName === rename?.name || dbBranches.some((b) => b.name === newName)} onClick={() => {
              if (!rename) return
              setBranches((bs) => bs.map((b) => (b.db !== db.id ? b : b.id === rename.id ? { ...b, name: newName } : b.parent === rename.name ? { ...b, parent: newName } : b)))
              if (branchName === rename.name) setBranchName(newName)
              setRename(null); toast.success('Branch renamed')
            }}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!d} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {d && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-mono">{d.name} <StatusBadge status={d.state} /></SheetTitle>
                <SheetDescription>{d.parent ? `Child of ${d.parent}` : 'Root branch'}, created by {d.createdBy}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-6">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => { setBranchName(d.name); toast.success(`Now using ${d.name}`) }} disabled={d.name === branchName}>Use this branch</Button>
                  <Button size="sm" variant="outline" onClick={() => { setBranchName(d.name); nav('/sql') }}><Code2 /> SQL editor</Button>
                  <Button size="sm" variant="outline" onClick={() => { setDetail(null); setCreate(d.name) }}><GitBranchPlus /> Branch</Button>
                  <Button size="sm" variant="outline" onClick={() => patch(d.id, { state: d.state === 'running' ? 'suspended' : 'running' })}>{d.state === 'running' ? <><Pause /> Suspend</> : <><Play /> Resume</>}</Button>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                  <dt className="text-muted-foreground">Branch ID</dt><dd className="font-mono">{d.id}</dd>
                  <dt className="text-muted-foreground">Created from</dt><dd>{d.point}</dd>
                  <dt className="text-muted-foreground">Log position</dt><dd className="font-mono">{d.lsn}</dd>
                  <dt className="text-muted-foreground">Created</dt><dd>{d.created} UTC</dd>
                  <dt className="text-muted-foreground">Expires</dt><dd>{d.expires ? `${d.expires} UTC` : 'Never'}</dd>
                  <dt className="text-muted-foreground">Changed data</dt><dd>{fmtMb(d.deltaMb)} {d.parent && 'not shared with parent'}</dd>
                  <dt className="text-muted-foreground">Compute</dt><dd>{d.isDefault ? 'Small, 0.5 vCPU, 2 GB' : 'Extra small, 0.25 vCPU, 1 GB'}</dd>
                  <dt className="text-muted-foreground">Children</dt><dd>{children(d.name).map((c) => c.name).join(', ') || 'None'}</dd>
                </dl>
                <CopyField label="Connection string" value={`postgresql://app_owner:npg_T4kq9WzLm2Xc@127.0.0.1:${db.port}/${db.name}?options=branch%3D${d.name}`} secret="npg_T4kq9WzLm2Xc" />
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Recent operations</div>
                  <ul className="divide-y rounded-md border text-[13px]">
                    {[['Created', d.created], ['Compute started', d.created], ...(d.state === 'suspended' ? [['Suspended after idle timeout', '2026-10-09 09:10']] : [])].map(([what, when]) => (
                      <li key={what} className="flex justify-between px-3 py-2"><span>{what}</span><span className="tabular text-muted-foreground">{when}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
