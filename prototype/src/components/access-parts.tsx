import { useState } from 'react'
import { Bot, Download, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CAPS, initials, PROJECT, ROLE_INFO, RUN_INFO, subjectKey, useAccess } from '@/lib/access'
import type { AuditEvent, Subject } from '@/lib/access'
import { DATABASES } from '@/lib/data'
import { cn } from '@/lib/utils'

/** A person, service account or group, always with a mark that says which. */
export function Who({ subject, sub, className }: { subject: Subject | string; sub?: boolean; className?: string }) {
  const { principal, groups } = useAccess()
  const id = typeof subject === 'string' ? subject : subject.id
  const p = principal(id), g = groups.find((x) => x.id === id)
  const label = p?.label ?? g?.label ?? id
  const kind = g ? `Group, ${g.members.length} ${g.members.length === 1 ? 'member' : 'members'}` : p?.kind === 'service' ? 'Service account' : p?.email
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <span className={cn('flex size-7 shrink-0 items-center justify-center text-[11px] font-semibold', g ? 'rounded-md border bg-background text-muted-foreground' : p?.kind === 'service' ? 'rounded-md bg-muted text-muted-foreground' : 'rounded-full bg-muted', p?.disabled && 'opacity-50')}>
        {g ? <Users className="size-3.5" /> : p?.kind === 'service' ? <Bot className="size-3.5" /> : initials(label)}
      </span>
      <span className="grid min-w-0 leading-tight">
        <span className={cn('truncate font-medium', (g || p?.kind === 'service') && 'font-mono text-[13px]', p?.disabled && 'text-muted-foreground line-through')}>{label}</span>
        {sub !== false && kind && <span className="truncate text-xs text-muted-foreground">{kind}</span>}
      </span>
    </span>
  )
}

/** Choose a person, service account or group. */
export function SubjectPicker({ value, onChange, exclude = [], only, id }: { value: string; onChange: (key: string) => void; exclude?: string[]; only?: 'user' | 'service' | 'principal'; id?: string }) {
  const { principals, groups } = useAccess()
  const ok = (k: string) => !exclude.includes(k)
  const people = principals.filter((p) => p.kind === 'user' && !p.disabled && only !== 'service' && ok(subjectKey({ kind: 'principal', id: p.id })))
  const services = principals.filter((p) => p.kind === 'service' && !p.disabled && only !== 'user' && ok(subjectKey({ kind: 'principal', id: p.id })))
  const grps = only ? [] : groups.filter((g) => ok(subjectKey({ kind: 'group', id: g.id })))
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose who" /></SelectTrigger>
      <SelectContent>
        {grps.length > 0 && <SelectGroup><SelectLabel>Groups</SelectLabel>{grps.map((g) => <SelectItem key={g.id} value={`group:${g.id}`}><span className="font-mono text-[13px]">{g.label}</span><span className="text-xs text-muted-foreground">{g.members.length} members</span></SelectItem>)}</SelectGroup>}
        {people.length > 0 && <SelectGroup><SelectLabel>People</SelectLabel>{people.map((p) => <SelectItem key={p.id} value={`principal:${p.id}`}>{p.label}</SelectItem>)}</SelectGroup>}
        {services.length > 0 && <SelectGroup><SelectLabel>Service accounts</SelectLabel>{services.map((p) => <SelectItem key={p.id} value={`principal:${p.id}`}><span className="font-mono text-[13px]">{p.label}</span></SelectItem>)}</SelectGroup>}
      </SelectContent>
    </Select>
  )
}

/** What one person can do in the project, and where each permission comes from. */
export function EffectiveAccess({ id }: { id: string }) {
  const { effective } = useAccess()
  const e = effective(id)
  const dbName = (db: string) => DATABASES.find((d) => d.id === db)?.name ?? db
  const empty = <span className="text-muted-foreground">None</span>
  return (
    <dl className="grid gap-3 text-[13px] [&_dt]:mb-1 [&_dt]:text-muted-foreground">
      <div>
        <dt>Role in {PROJECT}</dt>
        <dd>{e.role ? <><span className="font-medium">{ROLE_INFO[e.role].label}</span><span className="text-muted-foreground">, {e.roleVia === 'Direct' ? 'assigned directly' : `through ${e.roleVia.toLowerCase()}`}</span></> : <span className="text-muted-foreground">No role. This person cannot open the project.</span>}</dd>
      </div>
      <div>
        <dt>Data</dt>
        <dd className="grid gap-1">{e.data.length ? e.data.map((d) => (
          <div key={`${d.db}/${d.branch}`} className="flex gap-3"><span className="w-44 shrink-0 truncate"><span className="mr-1.5 inline-block size-2 rounded-sm bg-oltp" />{dbName(d.db)} / <span className="font-mono text-[12.5px]">{d.branch}</span></span><span className="text-muted-foreground">{d.caps.map((c) => CAPS.find((x) => x.id === c)!.label).join(', ')}</span></div>
        )) : empty}</dd>
      </div>
      <div>
        <dt>Runs</dt>
        <dd className="grid gap-1">{e.runs.length ? e.runs.map(({ grant, via }) => <div key={grant.id}>{RUN_INFO[grant.grant].label}{grant.as && <> as <Who subject={grant.as} sub={false} className="align-middle" /></>}<span className="text-muted-foreground">, {via === 'Direct' ? 'direct' : via.toLowerCase()}</span></div>) : empty}</dd>
      </div>
      <div>
        <dt>Catalog tables</dt>
        <dd>{e.tables.length ? <span className="font-mono text-[12.5px]">{e.tables.map((t) => `sales_analytics.app.${t}`).join(', ')}</span> : empty}</dd>
      </div>
    </dl>
  )
}

const AREAS: [string, string][] = [['all', 'All actions'], ['policy', 'Access changes'], ['data', 'Data'], ['execution', 'Runs'], ['source', 'Saved work'], ['catalog', 'Catalog'], ['session', 'Sign-in'], ['principal', 'People'], ['group', 'Groups'], ['service', 'Service accounts']]

export function AuditTable({ scope }: { scope: AuditEvent['scope'] }) {
  const { audit, name } = useAccess()
  const [q, setQ] = useState('')
  const [area, setArea] = useState('all')
  const [outcome, setOutcome] = useState('all')
  const rows = audit.filter((e) => e.scope === scope && (area === 'all' || e.action.startsWith(area)) && (outcome === 'all' || (outcome === 'denied') === !!e.denied) && `${name(e.actor)} ${e.action} ${e.target}`.toLowerCase().includes(q.toLowerCase()))
  const areas = AREAS.filter(([id]) => id === 'all' || audit.some((e) => e.scope === scope && e.action.startsWith(id)))
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action or target" aria-label="Search audit log" className="h-8 w-72 pl-8" /></div>
        <Select value={area} onValueChange={setArea}><SelectTrigger size="sm" className="w-44" aria-label="Action type"><SelectValue /></SelectTrigger><SelectContent>{areas.map(([id, l]) => <SelectItem key={id} value={id}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={outcome} onValueChange={setOutcome}><SelectTrigger size="sm" className="w-36" aria-label="Outcome"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any outcome</SelectItem><SelectItem value="allowed">Allowed</SelectItem><SelectItem value="denied">Denied</SelectItem></SelectContent></Select>
        <BackingTag id="AC-10b" />
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => toast.success(`Exported ${rows.length} entries`, { description: 'The export is a signed file. Acknowledge it to let older entries be trimmed.' })}><Download /> Export</Button>
      </div>
      <div className="overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4">
        <Table>
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead className="w-20">Entry</TableHead><TableHead className="w-36">When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead>{scope === 'project' && <TableHead className="w-24 text-right">Policy</TableHead>}<TableHead className="w-24">Outcome</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.seq} className="h-11">
                <TableCell className="tabular text-muted-foreground">{e.seq}</TableCell>
                <TableCell className="tabular text-muted-foreground">{e.at}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5"><Who subject={e.actor} sub={false} />{e.as && <span className="inline-flex items-center gap-1.5 text-muted-foreground">as <Who subject={e.as} sub={false} /></span>}</span></TableCell>
                <TableCell className="font-mono text-[12.5px]">{e.action}</TableCell>
                <TableCell className="max-w-72 truncate">{e.target}</TableCell>
                {scope === 'project' && <TableCell className="tabular text-right text-muted-foreground">{e.policy}</TableCell>}
                <TableCell className={e.denied ? 'font-medium text-destructive' : 'text-muted-foreground'}>{e.denied ? 'Denied' : 'Allowed'}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No entries match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Entries are numbered in order and cannot be edited. Denied attempts are recorded as well as allowed ones.</p>
    </>
  )
}
