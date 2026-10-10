import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, BellOff, Check, ChevronDown, Mail, MoreHorizontal, Plus, Send, Users, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, CodeBlock, PageHeader, Section, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAccess } from '@/lib/access'
import { useAlerts } from '@/lib/alerts'
import type { Alert, Area, Destination, Severity } from '@/lib/alerts'
import { cn } from '@/lib/utils'

const HEAD = 'bg-muted/50 hover:bg-muted/50'
const BOX = 'overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-3'
const AREAS: Area[] = ['Sync', 'Database', 'Jobs', 'Backups', 'Analytics', 'Services']
const KIND = { webhook: { icon: Webhook, label: 'Webhook' }, email: { icon: Mail, label: 'Email' }, people: { icon: Users, label: 'In the console' } }

/** Severity is a word and a shape: a filled square for critical, a hollow one for a warning. */
function Sev({ s, muted }: { s: Severity; muted?: boolean }) {
  return <span className={cn('inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap capitalize', muted && 'opacity-50')}><span className={cn('size-2 rounded-[2px]', s === 'critical' ? 'bg-destructive' : 'border-[1.5px] border-warning')} />{s}</span>
}

function useActions() {
  const { setAlerts } = useAlerts()
  const patch = (id: string, fn: (a: Alert) => Alert) => setAlerts((as) => as.map((a) => (a.id === id ? fn(a) : a)))
  return {
    ack: (a: Alert) => { patch(a.id, (x) => ({ ...x, state: 'acknowledged', ackBy: 'Maya Okafor', mutedUntil: undefined, events: [...x.events, { at: 'Oct 10, 14:05', text: 'Acknowledged by Maya Okafor' }] })); toast.success('Acknowledged', { description: 'No more reminders are sent. It stays open until the condition clears.' }) },
    mute: (a: Alert, label: string, until: string) => { patch(a.id, (x) => ({ ...x, mutedUntil: until, events: [...x.events, { at: 'Oct 10, 14:05', text: `Muted for ${label} by Maya Okafor` }] })); toast.success(`Muted for ${label}`) },
    unmute: (a: Alert) => patch(a.id, (x) => ({ ...x, mutedUntil: undefined, events: [...x.events, { at: 'Oct 10, 14:05', text: 'Unmuted by Maya Okafor' }] })),
  }
}

/** The bell in the top bar. Counts open alerts nobody has acknowledged or muted. */
export function AlertBell() {
  const { unseen } = useAlerts()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`${unseen.length} alerts need attention`} className="relative text-muted-foreground">
          <Bell />{unseen.length > 0 && <span className="tabular absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">{unseen.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2 text-[13px]"><span className="font-medium">Needs attention</span><span className="text-muted-foreground">{unseen.length} open</span></div>
        <div className="max-h-80 divide-y overflow-y-auto">
          {unseen.map((a) => (
            <button key={a.id} className="block w-full px-3 py-2.5 text-left hover:bg-muted/60" onClick={() => { setOpen(false); nav(`/alerts?open=${a.id}`) }}>
              <div className="flex items-center justify-between gap-3"><span className="truncate text-[13px] font-medium">{a.title}</span><Sev s={a.severity} /></div>
              <div className="mt-0.5 flex justify-between gap-3 text-xs text-muted-foreground"><span className="truncate">{a.resource}</span><span className="tabular shrink-0">{a.opened}</span></div>
            </button>
          ))}
          {unseen.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">Nothing needs attention.</div>}
        </div>
        <div className="border-t p-1.5"><Button variant="ghost" size="sm" className="w-full" onClick={() => { setOpen(false); nav('/alerts') }}>All alerts</Button></div>
      </PopoverContent>
    </Popover>
  )
}

export default function Alerts() {
  const { alerts, rules, destinations } = useAlerts()
  const { ack, mute, unmute } = useActions()
  const [view, setView] = useState<'open' | 'resolved' | 'all'>('open')
  const [area, setArea] = useState('all')
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.hash.split('?')[1]).get('open'))
  const live = alerts.filter((a) => a.state !== 'resolved')
  const rows = alerts.filter((a) => (view === 'all' || (view === 'open') === (a.state !== 'resolved')) && (area === 'all' || rules.find((r) => r.id === a.rule)?.area === area))
  const sel = alerts.find((a) => a.id === openId)
  const rule = sel && rules.find((r) => r.id === sel.rule)

  return (
    <div>
      <PageHeader title="Alerts" tag={<BackingTag id="AL-01" />} description="Things in this project that need someone: a pipeline that stopped, a job that failed, a backup that cannot be trusted. An alert closes by itself when the condition clears."
        actions={<Button variant="outline" asChild><Link to="/alerts/rules">Change what alerts</Link></Button>} />
      <div className="mb-7 grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="Open" value={live.length} sub={`${live.filter((a) => a.state === 'acknowledged').length} acknowledged, ${live.filter((a) => a.mutedUntil).length} muted`} />
        <Stat label="Critical" value={live.filter((a) => a.severity === 'critical').length} sub="Open now" />
        <Stat label="Resolved" value={alerts.filter((a) => a.state === 'resolved').length} sub="In the last 7 days" />
        <Stat label="Rules on" value={`${rules.filter((r) => r.enabled).length} of ${rules.length}`} sub={`${destinations.length} places to send to`} />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">{(['open', 'resolved', 'all'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={cn('h-7 rounded px-3 text-[13px] capitalize', view === v ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>{v}</button>)}</div>
        <Select value={area} onValueChange={setArea}><SelectTrigger size="sm" className="w-40" aria-label="Area"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Every area</SelectItem>{AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
        <span className="text-xs text-muted-foreground">{rows.length} alerts</span>
      </div>
      <div className={BOX}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead className="w-28">Severity</TableHead><TableHead>Alert</TableHead><TableHead>On</TableHead><TableHead>Since</TableHead><TableHead>Status</TableHead><TableHead className="w-56" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} className="h-14 cursor-pointer" onClick={() => setOpenId(a.id)}>
                <TableCell><Sev s={a.severity} muted={a.state === 'resolved'} /></TableCell>
                <TableCell><div className={cn('font-medium', a.state === 'resolved' && 'font-normal text-muted-foreground')}>{a.title}</div>{a.reading && <div className="tabular text-xs text-muted-foreground">{a.reading}</div>}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}><Link to={a.to} className="text-[13px] hover:text-primary hover:underline">{a.resource}</Link></TableCell>
                <TableCell className="tabular text-[13px] text-muted-foreground">{a.opened}</TableCell>
                <TableCell><span className="grid leading-tight"><StatusBadge status={a.state} />{a.mutedUntil && <span className="text-xs text-muted-foreground">Muted until {a.mutedUntil}</span>}{a.ackBy && a.state === 'acknowledged' && <span className="text-xs text-muted-foreground">{a.ackBy}</span>}{a.resolved && <span className="tabular text-xs text-muted-foreground">{a.resolved}</span>}</span></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {a.state !== 'resolved' && (
                    <div className="flex justify-end gap-1">
                      {a.state === 'open' && <Button variant="ghost" size="sm" onClick={() => ack(a)}><Check /> Acknowledge</Button>}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`More for ${a.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {a.mutedUntil ? <DropdownMenuItem onClick={() => unmute(a)}><Bell /> Unmute</DropdownMenuItem> : <>
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Mute reminders for</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => mute(a, '1 hour', 'Oct 10, 15:05')}>1 hour</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => mute(a, '1 day', 'Oct 11, 14:05')}>1 day</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => mute(a, '1 week', 'Oct 17, 14:05')}>1 week</DropdownMenuItem>
                          </>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild><Link to={a.to}>Go to {a.resource}</Link></DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">{view === 'open' ? 'Nothing is open. Everything being watched is healthy.' : 'No alerts match.'}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 max-w-[90ch] text-xs text-muted-foreground">Acknowledging says someone is on it and stops reminders. Muting stops reminders for a while without claiming it. Neither closes the alert: only the condition clearing does.</p>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {sel && rule && (
            <>
              <SheetHeader><SheetTitle className="pr-6">{sel.title}</SheetTitle><SheetDescription className="flex items-center gap-3"><Sev s={sel.severity} /><StatusBadge status={sel.state} /></SheetDescription></SheetHeader>
              <div className="grid min-w-0 grid-cols-1 gap-6 px-4 pb-6 [&>*]:min-w-0">
                <p className="text-[13px] leading-relaxed">{sel.detail}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[13px] [&_dt]:text-muted-foreground">
                  <dt>On</dt><dd><Link to={sel.to} className="text-primary hover:underline">{sel.resource}</Link></dd>
                  {sel.reading && <><dt>Reading</dt><dd className="tabular">{sel.reading}</dd></>}
                  <dt>Opened</dt><dd className="tabular">{sel.opened} UTC</dd>
                  {sel.resolved && <><dt>Resolved</dt><dd className="tabular">{sel.resolved} UTC</dd></>}
                  <dt>Rule</dt><dd><Link to="/alerts/rules" className="hover:underline">{rule.name}</Link><span className="block text-xs text-muted-foreground">{rule.when}{rule.value !== undefined && ` ${rule.value} ${rule.unit}`}.</span></dd>
                  <dt>Sent to</dt><dd>{rule.notify.length ? rule.notify.map((n) => destinations.find((d) => d.id === n)?.name).join(', ') : <span className="text-muted-foreground">Nobody. Shown here only.</span>}</dd>
                </dl>
                <div>
                  <div className="mb-2 text-[13px] font-medium">What happened</div>
                  <ol>{sel.events.map((e, i) => (
                    <li key={i} className="flex gap-3 text-[13px]"><span className="flex flex-col items-center"><span className="mt-1.5 size-2 rounded-full bg-muted-foreground/60" />{i < sel.events.length - 1 && <span className="w-px flex-1 bg-border" />}</span><span className="pb-3"><span className="tabular block text-xs text-muted-foreground">{e.at}</span>{e.text}</span></li>
                  ))}</ol>
                </div>
                {sel.state !== 'resolved' && <div className="flex gap-2">{sel.state === 'open' && <Button onClick={() => ack(sel)}><Check /> Acknowledge</Button>}{sel.mutedUntil ? <Button variant="outline" onClick={() => unmute(sel)}><Bell /> Unmute</Button> : <Button variant="outline" onClick={() => mute(sel, '1 day', 'Oct 11, 14:05')}><BellOff /> Mute for a day</Button>}<Button variant="outline" asChild><Link to={sel.to}>Go to it</Link></Button></div>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function AlertRules() {
  const { rules, setRules, destinations } = useAlerts()
  const patch = (id: string, p: object) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))
  return (
    <div>
      <PageHeader title="Alert rules" tag={<BackingTag id="AL-02" />} description="What this project watches for. The conditions are built in; you choose which are on, where the line is, how serious each is, and who hears about it." />
      <div className="grid gap-7">
        {AREAS.map((area) => (
          <Section key={area} flush title={area}>
            <Table>
              <TableBody>
                {rules.filter((r) => r.area === area).map((r) => (
                  <TableRow key={r.id} className="hover:bg-transparent">
                    <TableCell className="w-12 align-top"><Switch className="mt-1" checked={r.enabled} onCheckedChange={(enabled) => patch(r.id, { enabled })} aria-label={`${r.name} on`} /></TableCell>
                    <TableCell className={cn('py-3 whitespace-normal', !r.enabled && 'opacity-50')}>
                      <div className="flex items-center gap-2 font-medium">{r.name}{r.history && <BackingTag id="AL-05" compact />}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
                        {r.when}
                        {r.value !== undefined && <Select value={String(r.value)} disabled={!r.enabled} onValueChange={(v) => patch(r.id, { value: +v })}><SelectTrigger size="sm" className="tabular h-6 gap-1 px-1.5 text-[13px] text-foreground" aria-label={`Threshold for ${r.name}`}><SelectValue /></SelectTrigger><SelectContent>{r.options!.map((o) => <SelectItem key={o} value={String(o)}>{o} {r.unit}</SelectItem>)}</SelectContent></Select>}
                      </div>
                    </TableCell>
                    <TableCell className="w-36 align-top">
                      <Select value={r.severity} disabled={!r.enabled} onValueChange={(severity) => patch(r.id, { severity })}><SelectTrigger size="sm" className="mt-0.5 w-32" aria-label={`Severity of ${r.name}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="warning">Warning</SelectItem></SelectContent></Select>
                    </TableCell>
                    <TableCell className="w-60 align-top">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={!r.enabled}><Button variant="outline" size="sm" className="mt-0.5 w-56 justify-between font-normal"><span className="truncate">{r.notify.length ? r.notify.map((n) => destinations.find((d) => d.id === n)?.name).join(', ') : 'Console only'}</span><ChevronDown className="text-muted-foreground" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Also send to</DropdownMenuLabel>
                          {destinations.map((d) => <DropdownMenuCheckboxItem key={d.id} checked={r.notify.includes(d.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={(on) => patch(r.id, { notify: on ? [...r.notify, d.id] : r.notify.filter((x) => x !== d.id) })}>{d.name}</DropdownMenuCheckboxItem>)}
                          <DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/alerts/destinations">Manage destinations</Link></DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        ))}
        <div className="rounded-lg border border-dashed p-4 text-[13px]">
          <div className="font-medium">Your own conditions</div>
          <p className="mt-1 max-w-[78ch] text-muted-foreground">Rules on your own data, such as “orders in the last hour fell below 100”, are not alert rules. Write the check as a saved query and run it as a <Link to="/jobs" className="text-primary hover:underline">job</Link> that fails when the check fails; the Job failed rule then tells you.</p>
        </div>
      </div>
    </div>
  )
}

const SAMPLE = `{
  "event": "alert.opened",
  "alert": "al_2042",
  "rule": "sync-budget",
  "severity": "warning",
  "project": "sales-analytics",
  "resource": { "kind": "sync_pipeline", "id": "pl_19ab55d3" },
  "title": "Change buffer at 83%",
  "opened_at": "2026-10-10T13:50:00Z",
  "url": "https://analytics.internal.example:8443/#/alerts?open=al_2042"
}`

export function AlertDestinations() {
  const { destinations, setDestinations, deliveries, setDeliveries, rules, setRules } = useAlerts()
  const { groups } = useAccess()
  const [add, setAdd] = useState(false)
  const [kind, setKind] = useState<Destination['kind']>('webhook')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const ok = name && (kind === 'webhook' ? /^https:\/\/.+/.test(target) : kind === 'email' ? /.+@.+\..+/.test(target) : !!target)
  const test = (d: Destination) => {
    const good = d.kind !== 'email'
    setDeliveries((l) => [{ id: `dl_${Date.now()}`, at: 'Oct 10, 14:05', alert: 'Test message', destination: d.name, what: 'Test', result: good ? (d.kind === 'webhook' ? '200 OK in 88 ms' : 'Shown in the console') : 'Email is not set up on this server', ok: good }, ...l])
    setDestinations((ds) => ds.map((x) => (x.id === d.id ? { ...x, state: good ? 'ok' : 'failing', last: good ? 'Oct 10, 14:05' : x.last } : x)))
    if (good) toast.success(`Test delivered to ${d.name}`); else toast.error(`Could not deliver to ${d.name}`, { description: 'Email is not set up on this server.' })
  }
  return (
    <div>
      <PageHeader title="Destinations" tag={<BackingTag id="AL-04" />} description="Where alerts go besides this console. Each rule chooses which destinations it uses."
        actions={<Button onClick={() => { setAdd(true); setName(''); setTarget(''); setKind('webhook') }}><Plus /> Add destination</Button>} />
      <div className="grid gap-8">
        <div className={BOX}>
          <Table>
            <TableHeader><TableRow className={HEAD}><TableHead>Destination</TableHead><TableHead>Sends to</TableHead><TableHead>Used by</TableHead><TableHead>Last delivery</TableHead><TableHead>Status</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
            <TableBody>
              {destinations.map((d) => {
                const K = KIND[d.kind], used = rules.filter((r) => r.notify.includes(d.id)).length
                return (
                  <TableRow key={d.id} className="h-14">
                    <TableCell><span className="inline-flex items-center gap-2.5"><span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground"><K.icon className="size-3.5" /></span><span className="grid leading-tight"><span className="font-medium">{d.name}</span><span className="text-xs text-muted-foreground">{K.label}</span></span></span></TableCell>
                    <TableCell className="max-w-80 truncate font-mono text-xs text-muted-foreground">{d.target}</TableCell>
                    <TableCell className="tabular text-[13px]">{used} {used === 1 ? 'rule' : 'rules'}</TableCell>
                    <TableCell className="tabular text-[13px] text-muted-foreground">{d.last}</TableCell>
                    <TableCell><StatusBadge status={d.state === 'ok' ? 'healthy' : 'failed'} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => test(d)}><Send /> Send test</Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`More for ${d.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onClick={() => { setDestinations((ds) => ds.filter((x) => x.id !== d.id)); setRules((rs) => rs.map((r) => ({ ...r, notify: r.notify.filter((n) => n !== d.id) }))); toast.success(`${d.name} removed`, { description: used ? `${used} rules no longer send to it.` : undefined }) }}>Remove</DropdownMenuItem></DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_420px]">
          <Section flush title="Recent deliveries" description="A failed delivery is retried for an hour, then recorded as failed.">
            <Table>
              <TableHeader><TableRow className={HEAD}><TableHead>When</TableHead><TableHead>Alert</TableHead><TableHead>To</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
              <TableBody>{deliveries.map((l) => <TableRow key={l.id} className="h-11"><TableCell className="tabular text-muted-foreground">{l.at}</TableCell><TableCell><span className="text-muted-foreground">{l.what}: </span>{l.alert}</TableCell><TableCell>{l.destination}</TableCell><TableCell className={cn('text-[13px]', l.ok ? 'text-muted-foreground' : 'text-destructive')}>{l.result}</TableCell></TableRow>)}</TableBody>
            </Table>
          </Section>
          <div>
            <h2 className="mb-1 text-[15px] font-semibold">What a webhook receives</h2>
            <p className="mb-2.5 text-[13px] text-muted-foreground">A message says what is wrong and links back here. It never contains rows from your tables, query text or credentials. Each one is signed so the receiver can check it came from this server.</p>
            <CodeBlock code={SAMPLE} />
          </div>
        </div>
      </div>

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a destination</DialogTitle><DialogDescription>It receives nothing until a rule is set to send to it.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <RadioGroup value={kind} onValueChange={(v) => { setKind(v as Destination['kind']); setTarget('') }} className="grid grid-cols-3 gap-2">
              {(['webhook', 'people', 'email'] as const).map((k) => { const K = KIND[k]; return <label key={k} className={cn('flex cursor-pointer flex-col gap-1.5 rounded-md border p-3 text-[13px]', kind === k && 'border-foreground/40 bg-muted/40')}><span className="flex items-center justify-between"><K.icon className="size-4" /><RadioGroupItem value={k} /></span><span className="font-medium">{K.label}</span></label> })}
            </RadioGroup>
            <div className="grid gap-1.5"><Label htmlFor="ds-name">Name</Label><Input id="ds-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'webhook' ? 'Data team chat' : kind === 'email' ? 'Finance data owners' : 'Analysts'} /></div>
            {kind === 'webhook' && <div className="grid gap-1.5"><Label htmlFor="ds-url">Address</Label><Input id="ds-url" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://" className="font-mono text-[13px]" /><p className="text-xs text-muted-foreground">Must be https and reachable from the server. Works with chat and paging tools that accept incoming webhooks.</p></div>}
            {kind === 'email' && <div className="grid gap-1.5"><Label htmlFor="ds-mail">Address</Label><Input id="ds-mail" type="email" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="team@example.com" /><p className="text-xs text-warning">Email needs a mail server set up by the operator. This server has none, so deliveries will fail.</p></div>}
            {kind === 'people' && <div className="grid gap-1.5"><Label htmlFor="ds-grp">Group</Label><Select value={target} onValueChange={(v) => { setTarget(v); if (!name) setName(v) }}><SelectTrigger id="ds-grp" className="w-full"><SelectValue placeholder="Choose a group" /></SelectTrigger><SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.label}><span className="font-mono text-[13px]">{g.label}</span></SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Members see the alert on their bell when they are signed in. Nothing is sent outside.</p></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button disabled={!ok} onClick={() => { setDestinations((ds) => [...ds, { id: `ds_${Date.now()}`, kind, name, target: kind === 'people' ? 'Group, shown in the console' : target, state: 'ok', last: 'Never' }]); setAdd(false); toast.success(`${name} added`, { description: 'Send a test to check it.' }) }}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
