import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, CheckCircle2, GitBranch, History, Loader2, MoreHorizontal, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, Section, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// The restorable window, in minutes. "Now" in the prototype is Oct 10, 14:05 UTC.
const NOW = Date.UTC(2026, 9, 10, 14, 5)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const p2 = (n: number) => String(n).padStart(2, '0')
const at = (ms: number) => { const d = new Date(ms); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}` }
const slug = (ms: number) => { const d = new Date(ms); return `${MONTHS[d.getUTCMonth()].toLowerCase()}-${p2(d.getUTCDate())}-${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}` }

type Backup = { id: string; ms: number; trigger: 'Scheduled' | 'Manual'; sizeGb: number; state: 'verified' | 'unverified' | 'running' | 'verifying'; progress?: number }
type Restore = { when: string; to: string; mode: string; by: string; result: string }
const EVENTS: { ms: number; label: string; tone: 'schema' | 'write' }[] = [
  { ms: Date.UTC(2026, 9, 6, 18, 30), label: 'Schema change: index added on orders (placed_at)', tone: 'schema' },
  { ms: Date.UTC(2026, 9, 9, 11, 42), label: 'Schema change: orders.loyalty_points added', tone: 'schema' },
  { ms: Date.UTC(2026, 9, 10, 9, 17), label: 'Large write: 48,210 rows deleted from order_items', tone: 'write' },
]
const daily = (dayBack: number, sizeGb: number, state: Backup['state'] = 'verified'): Backup => ({ id: `bk_${dayBack}`, ms: Date.UTC(2026, 9, 10 - dayBack, 2, 0), trigger: 'Scheduled', sizeGb, state })
const SEED: Backup[] = [daily(0, 4.31), daily(1, 4.28), daily(2, 4.22), { id: 'bk_m1', ms: Date.UTC(2026, 9, 7, 16, 48), trigger: 'Manual', sizeGb: 4.19, state: 'verified' }, daily(3, 4.18), daily(4, 4.11), daily(5, 4.06, 'unverified'), daily(6, 4.02)]

export function Backups() {
  const { db, dbBranches, setBranches, pipelines } = useStore()
  const nav = useNavigate()
  const [days, setDays] = useState(7)
  const [retention, setRetention] = useState('7')
  const span = days * 1440
  const start = NOW - span * 60000
  const [pos, setPos] = useState(span - 360)
  const [backups, setBackups] = useState(SEED)
  const [restores, setRestores] = useState<Restore[]>([{ when: 'Oct 6, 18:31', to: 'Oct 6, 18:30', mode: 'New branch restore-oct-06', by: 'Daniel Reyes', result: 'succeeded' }])
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'branch' | 'replace'>('branch')
  const [name, setName] = useState('')
  const [typed, setTyped] = useState('')
  const [sched, setSched] = useState({ on: true, every: 'daily', at: '02:00', keep: '14', dest: 'local' })
  const target = start + pos * 60000
  const left = (ms: number) => `${Math.max(0, Math.min(100, ((ms - start) / (span * 60000)) * 100))}%`
  const def = dbBranches.find((b) => b.isDefault)?.name ?? 'main'
  const children = dbBranches.filter((b) => b.parent === def).map((b) => b.name)
  const hasSync = pipelines.some((p) => p.db === db.id && p.branch === def)
  const running = backups.find((b) => b.state === 'running' || b.state === 'verifying')
  const latest = backups.find((b) => b.state === 'verified')
  const undone = EVENTS.filter((e) => e.ms > target)

  // A running backup advances on its own, then verifies.
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setBackups((bs) => bs.map((b) => (b.id !== running.id ? b : (b.progress ?? 0) >= 100 ? { ...b, state: b.state === 'running' ? 'verifying' : 'verified', progress: b.state === 'running' ? 0 : undefined } : { ...b, progress: (b.progress ?? 0) + 20 }))), 500)
    return () => clearInterval(t)
  }, [running])

  const begin = (ms?: number) => { if (ms !== undefined) setPos(Math.round((ms - start) / 60000)); setMode('branch'); setName(`restore-${slug(ms ?? target)}`); setTyped(''); setOpen(true) }
  const restore = () => {
    const kept = `${def}-before-restore-${slug(NOW)}`
    const bname = mode === 'branch' ? name : kept
    setBranches((b) => [...b, { id: `br_${Math.random().toString(16).slice(2, 10)}`, db: db.id, name: bname, parent: def, state: mode === 'branch' ? 'running' : 'suspended', isDefault: false, created: '2026-10-10 14:05', expires: mode === 'branch' ? null : '2026-10-17 14:05', point: mode === 'branch' ? `${at(target)} UTC` : 'Head before restore', deltaMb: 0, lsn: '0/4A2F0000', createdBy: 'you' }])
    setRestores((r) => [{ when: at(NOW), to: at(target), mode: mode === 'branch' ? `New branch ${name}` : `Replaced ${def}`, by: 'Maya Okafor', result: 'succeeded' }, ...r])
    setOpen(false)
    toast.success(mode === 'branch' ? `Branch ${name} created at ${at(target)} UTC` : `${db.name} / ${def} restored to ${at(target)} UTC`, { description: mode === 'replace' ? `The previous state is kept as ${kept} for 7 days.` : undefined, action: { label: 'View branches', onClick: () => nav('/branches') } })
  }
  const ok = mode === 'branch' ? !!name && !dbBranches.some((b) => b.name === name) : typed === db.name

  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="Earliest restore point" value={at(start)} sub={`${days} days of history kept`} />
        <Stat label="Latest restore point" value="Now" sub="History is continuous" />
        <Stat label="Last backup" value={latest ? at(latest.ms) : 'None'} sub={latest ? `${latest.sizeGb.toFixed(2)} GB, verified` : undefined} tag={<BackingTag id="DB-10e" compact />} />
        <Stat label="Next backup" value={sched.on ? `Oct 11, ${sched.at}` : 'Not scheduled'} sub={sched.on ? `${sched.every === 'daily' ? 'Daily' : sched.every === 'hourly' ? 'Hourly' : 'Weekly'}, keeps ${sched.keep}` : 'Turn on a schedule below'} tag={<BackingTag id="DB-10e" compact />} />
      </div>

      <Section title="Restore to a point in time" description="Every change is kept continuously, so you can go back to any minute in the window, not only to a backup. Choose the moment just before the mistake.">
        <div className="px-1 pt-9 pb-1">
          <div className="relative">
            {backups.filter((b) => b.ms >= start && b.state !== 'running').map((b) => (
              <Tooltip key={b.id}><TooltipTrigger asChild><button aria-label={`Backup ${at(b.ms)}`} onClick={() => setPos(Math.round((b.ms - start) / 60000))} className="absolute -top-5 size-2 -translate-x-1/2 rounded-sm bg-oltp hover:scale-150" style={{ left: left(b.ms) }} /></TooltipTrigger><TooltipContent>Backup, {at(b.ms)}</TooltipContent></Tooltip>
            ))}
            {EVENTS.filter((e) => e.ms >= start).map((e) => (
              <Tooltip key={e.ms}><TooltipTrigger asChild><button aria-label={e.label} onClick={() => setPos(Math.round((e.ms - start) / 60000) - 1)} className={cn('absolute -top-9 h-7 w-0.5 -translate-x-1/2 hover:w-1', e.tone === 'write' ? 'bg-destructive' : 'bg-warning')} style={{ left: left(e.ms) }} /></TooltipTrigger><TooltipContent><div className="font-medium">{at(e.ms)}</div>{e.label}<div className="opacity-70">Click to select the minute before</div></TooltipContent></Tooltip>
            ))}
            <Slider aria-label="Restore point" min={0} max={span} step={1} value={[pos]} onValueChange={([v]) => setPos(v)} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span className="tabular">{at(start)}</span><span className="flex items-center gap-4"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-oltp" />Backup</span><span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-warning" />Schema change</span><span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-destructive" />Large write <BackingTag id="DB-10g" compact /></span></span><span>Now</span></div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t pt-4">
          <div>
            <div className="text-[13px] text-muted-foreground">Restore {db.name} / <span className="font-mono text-[12.5px]">{def}</span> as it was at</div>
            <div className="tabular mt-0.5 text-[1.35rem] leading-tight font-semibold tracking-tight">{at(target)} UTC</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{pos >= span ? 'This is the current state.' : undone.length ? `Before: ${undone.map((e) => e.label.split(': ')[1]).join('; ')}.` : 'No schema changes or large writes happened after this moment.'}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPos(Math.max(0, pos - 1))}>1 min earlier</Button>
            <Button variant="outline" size="sm" onClick={() => setPos(Math.min(span, pos + 1))}>1 min later</Button>
            <Button disabled={pos >= span} onClick={() => begin()}><History /> Restore</Button>
          </div>
        </div>
      </Section>

      <Section flush title="Backups" tag={<BackingTag id="DB-10e" />} description="Complete copies taken while the database stays online. They outlive the history window and can be stored away from this server."
        actions={<Button variant="outline" disabled={!!running} onClick={() => { setBackups((b) => [{ id: `bk_${Date.now()}`, ms: NOW, trigger: 'Manual', sizeGb: 4.31, state: 'running', progress: 0 }, ...b]); toast.message('Backup started. The database stays available.') }}><Archive /> Back up now</Button>}>
        <Table>
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>Taken</TableHead><TableHead>Started by</TableHead><TableHead className="text-right">Size</TableHead><TableHead>Contains</TableHead><TableHead>Checked</TableHead><TableHead>Stored at</TableHead><TableHead className="w-36" /></TableRow></TableHeader>
          <TableBody>
            {backups.map((b) => (
              <TableRow key={b.id} className="h-12">
                <TableCell className="tabular font-medium">{at(b.ms)}</TableCell>
                <TableCell className="text-muted-foreground">{b.trigger === 'Manual' ? 'Maya Okafor' : 'Schedule'}</TableCell>
                <TableCell className="tabular text-right">{b.state === 'running' ? '' : `${b.sizeGb.toFixed(2)} GB`}</TableCell>
                <TableCell className="text-muted-foreground">All {dbBranches.length} branches</TableCell>
                <TableCell>
                  {b.state === 'verified' && <span className="inline-flex items-center gap-1.5 text-[13px]"><CheckCircle2 className="size-3.5 text-success" />Verified</span>}
                  {b.state === 'unverified' && <span className="text-[13px] text-warning">Not verified</span>}
                  {(b.state === 'running' || b.state === 'verifying') && <span className="inline-flex items-center gap-2 text-[13px] text-info"><Loader2 className="size-3.5 animate-spin" />{b.state === 'running' ? 'Copying' : 'Verifying'} <span className="tabular">{b.progress ?? 0}%</span></span>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{sched.dest === 'local' ? '/var/backups/supabricks' : 's3://company-backups/supabricks'}/{db.name}/{slug(b.ms)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" disabled={b.state !== 'verified' && b.state !== 'unverified'} onClick={() => begin(b.ms)}><RotateCcw /> Restore</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for backup ${at(b.ms)}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!!running} onClick={() => setBackups((bs) => bs.map((x) => (x.id === b.id ? { ...x, state: 'verifying', progress: 0 } : x)))}>Verify again</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success('Backup marked to keep', { description: 'It is not removed when the schedule trims older backups.' })}>Keep indefinitely</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => { setBackups((bs) => bs.filter((x) => x.id !== b.id)); toast.success('Backup deleted') }}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Backup schedule" tag={<BackingTag id="DB-10e" />} actions={<Switch checked={sched.on} onCheckedChange={(on) => setSched({ ...sched, on })} aria-label="Scheduled backups" />}>
          <div className={cn('grid gap-4', !sched.on && 'pointer-events-none opacity-50')}>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label htmlFor="bk-every">How often</Label><Select value={sched.every} onValueChange={(every) => setSched({ ...sched, every })}><SelectTrigger id="bk-every" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hourly">Every hour</SelectItem><SelectItem value="daily">Every day</SelectItem><SelectItem value="weekly">Every week, on Sunday</SelectItem></SelectContent></Select></div>
              <div className="grid gap-1.5"><Label htmlFor="bk-at">At (UTC)</Label><Input id="bk-at" type="time" disabled={sched.every === 'hourly'} value={sched.at} onChange={(e) => setSched({ ...sched, at: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label htmlFor="bk-keep">Keep the last</Label><Select value={sched.keep} onValueChange={(keep) => setSched({ ...sched, keep })}><SelectTrigger id="bk-keep" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{['7', '14', '30', '90'].map((n) => <SelectItem key={n} value={n}>{n} backups</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label htmlFor="bk-dest">Store in</Label><Select value={sched.dest} onValueChange={(dest) => setSched({ ...sched, dest })}><SelectTrigger id="bk-dest" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="local">A folder on this server</SelectItem><SelectItem value="s3">Object storage (S3-compatible)</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{sched.dest === 'local' ? 'A backup on the same server does not protect against losing the server.' : 'Credentials for the bucket are set by the server operator.'}</p><Button variant="outline" onClick={() => toast.success('Backup schedule saved')}>Save</Button></div>
          </div>
        </Section>
        <Section title="History retention" tag={<BackingTag id="DB-10c" />} description="How far back the restore timeline and branching reach. Longer retention uses more storage.">
          <div className="flex items-end gap-3">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="bk-ret">Keep history for</Label>
              <Select value={retention} onValueChange={setRetention}><SelectTrigger id="bk-ret" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 day</SelectItem><SelectItem value="7">7 days</SelectItem><SelectItem value="14">14 days</SelectItem><SelectItem value="30">30 days</SelectItem></SelectContent></Select>
            </div>
            <Button variant="outline" disabled={+retention === days} onClick={() => { const d = +retention; setPos(Math.max(0, pos + (d - days) * 1440)); setDays(d); toast.success(`History is now kept for ${d} ${d === 1 ? 'day' : 'days'}`, { description: d > days ? 'The window grows from today; older history was already removed.' : undefined }) }}>Save</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Currently storing 1.2 GB of history for {db.name}.</p>
        </Section>
      </div>

      <Section flush title="Restore history" tag={<BackingTag id="DB-10d" />} description="Every restore of this database, whether to a new branch or in place.">
        <Table>
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>When</TableHead><TableHead>Restored to</TableHead><TableHead>How</TableHead><TableHead>By</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
          <TableBody>{restores.map((r) => <TableRow key={r.when + r.mode} className="h-11"><TableCell className="tabular">{r.when}</TableCell><TableCell className="tabular">{r.to} UTC</TableCell><TableCell>{r.mode}</TableCell><TableCell className="text-muted-foreground">{r.by}</TableCell><TableCell><StatusBadge status={r.result} /></TableCell></TableRow>)}</TableBody>
        </Table>
      </Section>

      <div className="rounded-lg border border-dashed p-4 text-[13px]">
        <div className="flex items-center gap-2 font-medium">Whole-installation recovery bundle <BackingTag id="DB-10b" /></div>
        <p className="mt-1 max-w-[78ch] text-muted-foreground">To move everything to another machine, the server operator can capture one verified bundle of the whole installation from the command line. It stops every database while it runs, so it is not a substitute for the backups above.</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Restore {db.name} to <span className="tabular">{at(target)} UTC</span></DialogTitle><DialogDescription>Choose where the restored data goes.</DialogDescription></DialogHeader>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="gap-2">
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', mode === 'branch' && 'border-foreground/40 bg-muted/40')}>
              <RadioGroupItem value="branch" className="mt-0.5" />
              <span><span className="flex items-center gap-2 font-medium"><GitBranch className="size-3.5" />Into a new branch <span className="rounded border px-1 text-[11px] font-normal text-muted-foreground">safest</span><BackingTag id="DB-10a" /></span><span className="block text-[13px] text-muted-foreground">Nothing is replaced. Look at the old data, copy back what you need, and delete the branch when you are done.</span></span>
            </label>
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', mode === 'replace' && 'border-destructive/50 bg-destructive/5')}>
              <RadioGroupItem value="replace" className="mt-0.5" />
              <span><span className="flex items-center gap-2 font-medium"><RotateCcw className="size-3.5" />Replace <span className="font-mono text-[13px]">{def}</span> <BackingTag id="DB-10d" /></span><span className="block text-[13px] text-muted-foreground">The application sees the old data at once, with the same connection string.</span></span>
            </label>
          </RadioGroup>
          {mode === 'branch' ? (
            <div className="grid gap-1.5"><Label htmlFor="rs-name">New branch name</Label><Input id="rs-name" value={name} onChange={(e) => setName(e.target.value)} className="font-mono text-[13px]" />{dbBranches.some((b) => b.name === name) && <p className="text-xs text-destructive">A branch with this name already exists.</p>}</div>
          ) : (
            <div className="grid gap-3">
              <ul className="grid gap-1.5 rounded-md border bg-muted/40 p-3 text-[13px] [&>li]:flex [&>li]:gap-2 [&>li>span:first-child]:mt-[7px] [&>li>span:first-child]:size-1 [&>li>span:first-child]:shrink-0 [&>li>span:first-child]:rounded-full [&>li>span:first-child]:bg-foreground">
                <li><span /><span>Everything written to <span className="font-mono text-[12.5px]">{def}</span> after {at(target)} is removed from it.</span></li>
                <li><span /><span>The current state is kept as branch <span className="font-mono text-[12.5px]">{def}-before-restore-{slug(NOW)}</span> for 7 days, so this can be undone.</span></li>
                <li><span /><span>{db.connections} open {db.connections === 1 ? 'connection is' : 'connections are'} closed. Applications reconnect on their own.</span></li>
                {hasSync && <li><span /><span>The sync pipeline on this branch takes a new full copy. Analytical versions already published stay readable.</span></li>}
                {children.length > 0 && <li><span /><span>Branches made from it ({children.slice(0, 3).join(', ')}{children.length > 3 ? ` and ${children.length - 3} more` : ''}) are not changed.</span></li>}
              </ul>
              <div className="grid gap-1.5"><Label htmlFor="rs-confirm">Type <span className="font-mono">{db.name}</span> to confirm</Label><Input id="rs-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant={mode === 'replace' ? 'destructive' : 'default'} disabled={!ok} onClick={restore}>{mode === 'branch' ? 'Create restore branch' : `Replace ${def}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
