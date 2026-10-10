import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { AuditTable, EffectiveAccess, SubjectPicker, Who } from '@/components/access-parts'
import { BackingTag, PageHeader, Section } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CAPS, ME, parseSubject, PROJECT, ROLE_INFO, RUN_INFO, sameSubject, subjectKey, useAccess } from '@/lib/access'
import type { Capability, Role, RunKind, Subject } from '@/lib/access'
import { OWN_TABLES } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const HEAD = 'bg-muted/50 hover:bg-muted/50'
const BOX = 'overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-3'
const ROLE_IDS: Role[] = ['viewer', 'editor', 'administrator']

function Revision() {
  const { policy } = useAccess()
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="cursor-help rounded border px-1.5 py-0.5 text-xs text-muted-foreground">Policy revision <span className="tabular font-medium text-foreground">{policy}</span></span></TooltipTrigger>
      <TooltipContent className="max-w-xs">Every access change in this project makes a new revision. A change is refused if someone else changed the policy first, so two administrators never overwrite each other.</TooltipContent>
    </Tooltip>
  )
}

export function Roles() {
  const { roles, change, name, principals, groups } = useAccess()
  const [add, setAdd] = useState(false)
  const [who, setWho] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [check, setCheck] = useState(false)
  const [person, setPerson] = useState('')
  const count = (r: Role) => roles.filter((b) => b.role === r).length
  const admins = roles.filter((b) => b.role === 'administrator').length
  const reach = (s: Subject) => (s.kind === 'group' ? groups.find((g) => g.id === s.id)?.members.length ?? 0 : 1)
  const people = new Set(roles.flatMap((b) => (b.subject.kind === 'group' ? groups.find((g) => g.id === b.subject.id)?.members ?? [] : principals.find((p) => p.id === b.subject.id)?.kind === 'user' ? [b.subject.id] : [])))

  return (
    <div>
      <PageHeader title="Roles" description={<>Who can work in {PROJECT}. A role opens the project; <Link to="/access/data" className="text-primary hover:underline">data</Link>, <Link to="/access/runs" className="text-primary hover:underline">run</Link> and <Link to="/access/catalog" className="text-primary hover:underline">catalog</Link> permissions decide what they can touch inside it.</>}
        actions={<><Revision /><Button variant="outline" onClick={() => setCheck(true)}><Search /> Check someone’s access</Button><Button onClick={() => setAdd(true)}><Plus /> Add people</Button></>} />

      <div className="mb-7 grid gap-3 md:grid-cols-3">
        {ROLE_IDS.map((r) => (
          <div key={r} className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between"><div className="font-semibold">{ROLE_INFO[r].label}</div><div className="tabular text-xs text-muted-foreground">{count(r)} assigned</div></div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">{ROLE_INFO[r].summary}</div>
            <ul className="mt-3 grid gap-1 text-[13px]">{ROLE_INFO[r].can.map((c) => <li key={c} className="flex gap-2"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground" />{c}</li>)}</ul>
          </div>
        ))}
      </div>

      <Section flush title="Assignments" description={`${people.size} people reach this project, directly or through a group. When someone holds more than one role, the highest applies.`}
        actions={<Button variant="ghost" size="sm" disabled>New custom role <BackingTag id="AC-06b" /></Button>}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead>Who</TableHead><TableHead>Reaches</TableHead><TableHead className="w-52">Role</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {roles.map((b) => {
              const lastAdmin = b.role === 'administrator' && admins === 1
              return (
                <TableRow key={subjectKey(b.subject)} className="h-13">
                  <TableCell><span className="inline-flex items-center gap-2"><Who subject={b.subject} />{b.subject.id === ME && <span className="rounded border px-1 text-[11px] text-muted-foreground">you</span>}</span></TableCell>
                  <TableCell className="text-muted-foreground">{b.subject.kind === 'group' ? `${reach(b.subject)} people` : 'Direct'}</TableCell>
                  <TableCell>
                    <Select value={b.role} disabled={lastAdmin} onValueChange={(v) => { change('policy.role', `${b.subject.kind === 'group' ? 'group ' : ''}${name(b.subject)}: ${v}`, (s) => ({ roles: s.roles.map((x) => (sameSubject(x.subject, b.subject) ? { ...x, role: v as Role } : x)) })); toast.success(`${name(b.subject)} is now ${ROLE_INFO[v as Role].label.toLowerCase()}`) }}>
                      <SelectTrigger size="sm" className="w-44" aria-label={`Role for ${name(b.subject)}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLE_IDS.map((r) => <SelectItem key={r} value={r}>{ROLE_INFO[r].label}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="icon-sm" disabled={lastAdmin} title={lastAdmin ? 'A project needs at least one administrator' : undefined} aria-label={`Remove ${name(b.subject)}`} onClick={() => { change('policy.role', `${name(b.subject)}: removed`, (s) => ({ roles: s.roles.filter((x) => !sameSubject(x.subject, b.subject)) })); toast.success(`${name(b.subject)} removed from ${PROJECT}`) }}><X /></Button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Section>

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add people to {PROJECT}</DialogTitle><DialogDescription>Prefer a group: access then follows who is in the team, and you never edit this list when someone joins or leaves.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="role-who">Who</Label><SubjectPicker id="role-who" value={who} onChange={setWho} exclude={roles.map((b) => subjectKey(b.subject))} /></div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="gap-2">
                {ROLE_IDS.map((r) => <label key={r} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', role === r && 'border-foreground/40 bg-muted/40')}><RadioGroupItem value={r} className="mt-0.5" /><span><span className="font-medium">{ROLE_INFO[r].label}</span><span className="block text-[13px] text-muted-foreground">{ROLE_INFO[r].summary}</span></span></label>)}
              </RadioGroup>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button disabled={!who} onClick={() => { const s = parseSubject(who); change('policy.role', `${name(s)}: ${role}`, (st) => ({ roles: [...st.roles, { subject: s, role }] })); setAdd(false); setWho(''); toast.success(`${name(s)} added as ${ROLE_INFO[role].label.toLowerCase()}`) }}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={check} onOpenChange={setCheck}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle className="flex items-center gap-2">Check someone’s access <BackingTag id="AC-11" /></SheetTitle><SheetDescription>Everything one person or service account can do in {PROJECT}, and which assignment gives it to them.</SheetDescription></SheetHeader>
          <div className="grid gap-4 px-4 pb-6">
            <SubjectPicker value={person} onChange={setPerson} only="principal" />
            {person ? <div className="rounded-md border p-3"><EffectiveAccess id={person.split(':')[1]} /></div> : <div className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">Choose a person to see their access.</div>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function DataPermissions() {
  const { data, change, name } = useAccess()
  const { databases, branches } = useStore()
  const [dbId, setDbId] = useState('db_app')
  const [add, setAdd] = useState<string | null>(null)
  const [who, setWho] = useState('')
  const db = databases.find((d) => d.id === dbId) ?? databases[0]
  const groupsOfCaps = ['Rows', 'Sharing', 'Sync'] as const
  const toggle = (subject: Subject, branch: string, cap: Capability, on: boolean) =>
    change('policy.data_grant', `${name(subject)} on ${db.name} / ${branch}: ${on ? '' : 'remove '}${cap}`, (s) => ({ data: s.data.map((g) => (sameSubject(g.subject, subject) && g.db === db.id && g.branch === branch ? { ...g, caps: on ? [...g.caps, cap] : g.caps.filter((c) => c !== cap) } : g)) }))

  return (
    <div>
      <PageHeader title="Data permissions" description="What each person, group or service account can do with a database, one branch at a time. A role alone gives no access to rows."
        actions={<><Revision /><Select value={db.id} onValueChange={setDbId}><SelectTrigger className="w-44" aria-label="Database"><span className="size-2 rounded-sm bg-oltp" /><SelectValue /></SelectTrigger><SelectContent>{databases.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></>} tag={<BackingTag id="AC-07" />} />
      <div className="grid gap-7">
        {branches.filter((b) => b.db === db.id).map((b) => {
          const grants = data.filter((g) => g.db === db.id && g.branch === b.name)
          return (
            <section key={b.id}>
              <header className="mb-2.5 flex items-end justify-between gap-4">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold"><span className="font-mono">{b.name}</span>{b.isDefault && <span className="rounded border px-1 text-[11px] font-normal text-muted-foreground">default</span>}<span className="text-[13px] font-normal text-muted-foreground">{grants.length ? `${grants.length} with access` : 'Nobody has access'}</span></h2>
                <Button variant="outline" size="sm" onClick={() => { setAdd(b.name); setWho('') }}><Plus /> Grant access</Button>
              </header>
              {grants.length > 0 && (
                <div className={cn(BOX, 'overflow-x-auto')}>
                  <Table>
                    <TableHeader>
                      <TableRow className={HEAD}><TableHead rowSpan={2} className="min-w-56 align-bottom">Who</TableHead>{groupsOfCaps.map((g) => <TableHead key={g} colSpan={3} className="h-8 border-l text-center text-xs font-medium">{g}</TableHead>)}<TableHead rowSpan={2} className="w-12" /></TableRow>
                      <TableRow className={HEAD}>{CAPS.map((c, i) => <TableHead key={c.id} className={cn('h-8 w-24 text-center text-xs font-normal whitespace-nowrap', i % 3 === 0 && 'border-l')}><Tooltip><TooltipTrigger asChild><span className="cursor-help underline decoration-dotted underline-offset-4">{c.label}</span></TooltipTrigger><TooltipContent className="max-w-xs">{c.help}</TooltipContent></Tooltip></TableHead>)}</TableRow>
                    </TableHeader>
                    <TableBody>
                      {grants.map((g) => (
                        <TableRow key={subjectKey(g.subject)} className="h-13">
                          <TableCell><Who subject={g.subject} /></TableCell>
                          {CAPS.map((c, i) => <TableCell key={c.id} className={cn('text-center', i % 3 === 0 && 'border-l')}><Checkbox checked={g.caps.includes(c.id)} aria-label={`${c.label} for ${name(g.subject)} on ${b.name}`} onCheckedChange={(on) => toggle(g.subject, b.name, c.id, !!on)} /></TableCell>)}
                          <TableCell><Button variant="ghost" size="icon-sm" aria-label={`Remove ${name(g.subject)} from ${b.name}`} onClick={() => change('policy.data_grant', `${name(g.subject)} on ${db.name} / ${b.name}: removed`, (s) => ({ data: s.data.filter((x) => x !== g) }))}><X /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          )
        })}
        <div className="rounded-lg border border-dashed p-4 text-[13px]">
          <div className="flex items-center gap-2 font-medium">Direct PostgreSQL connections <BackingTag id="AC-07b" /></div>
          <p className="mt-1 max-w-[78ch] text-muted-foreground">These permissions apply to work done through the console and the platform API. People cannot yet connect with psql or a driver under their own identity: PostgreSQL stays private on the server, so there is no per-person connection string that honours these grants.</p>
        </div>
      </div>

      <Dialog open={!!add} onOpenChange={(o) => !o && setAdd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant access to <span className="font-mono">{db.name} / {add}</span></DialogTitle><DialogDescription>They start with Read. Tick more permissions in the table afterwards.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="data-who">Who</Label><SubjectPicker id="data-who" value={who} onChange={setWho} exclude={data.filter((g) => g.db === db.id && g.branch === add).map((g) => subjectKey(g.subject))} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setAdd(null)}>Cancel</Button><Button disabled={!who} onClick={() => { const s = parseSubject(who), branch = add!; change('policy.data_grant', `${name(s)} on ${db.name} / ${branch}: read`, (st) => ({ data: [...st.data, { subject: s, db: db.id, branch, caps: ['read'] }] })); setAdd(null) }}>Grant read</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function RunPermissions() {
  const { runs, change, name } = useAccess()
  const { notebooks } = useStore()
  const [add, setAdd] = useState(false)
  const [who, setWho] = useState('')
  const [kind, setKind] = useState<RunKind>('execute')
  const [as, setAs] = useState('')
  const [source, setSource] = useState('')
  const ok = who && (kind !== 'act_as' || (as && source))

  return (
    <div>
      <PageHeader title="Run permissions" description="Who may run notebooks on the server, stop other people’s runs, or run a notebook under another identity. Runs execute in an isolated sandbox with no outside network."
        actions={<><Revision /><Button onClick={() => setAdd(true)}><Plus /> Grant permission</Button></>} tag={<BackingTag id="AC-08" />} />
      <div className="grid gap-7">
        {(Object.keys(RUN_INFO) as RunKind[]).map((k) => {
          const rows = runs.filter((r) => r.grant === k)
          return (
            <Section key={k} flush title={RUN_INFO[k].label} description={RUN_INFO[k].help}>
              <Table>
                {k === 'act_as' && rows.length > 0 && <TableHeader><TableRow className={HEAD}><TableHead>Who</TableHead><TableHead>Runs as</TableHead><TableHead>Only this saved revision</TableHead><TableHead className="w-12" /></TableRow></TableHeader>}
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="h-13">
                      <TableCell><Who subject={r.subject} /></TableCell>
                      {k === 'act_as' && <><TableCell><Who subject={r.as!} sub={false} /></TableCell><TableCell className="font-mono text-[12.5px]">{r.source}</TableCell></>}
                      <TableCell className="w-12"><Button variant="ghost" size="icon-sm" aria-label={`Remove ${name(r.subject)}`} onClick={() => change('policy.grant', `${name(r.subject)}: remove ${r.grant}`, (s) => ({ runs: s.runs.filter((x) => x.id !== r.id) }))}><X /></Button></TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell className="h-16 text-center text-muted-foreground">Nobody has this permission.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Section>
          )
        })}
      </div>
      <p className="mt-4 max-w-[78ch] text-xs text-muted-foreground">Running as another identity is tied to one saved revision of a notebook. If the notebook is edited, the permission no longer applies until it is granted again for the new revision, so nobody can change the code that runs with borrowed access.</p>

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant a run permission</DialogTitle><DialogDescription>Applies in {PROJECT} only.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="run-who">Who</Label><SubjectPicker id="run-who" value={who} onChange={setWho} /></div>
            <div className="grid gap-1.5"><Label htmlFor="run-kind">Permission</Label><Select value={kind} onValueChange={(v) => setKind(v as RunKind)}><SelectTrigger id="run-kind" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(RUN_INFO) as RunKind[]).map((k) => <SelectItem key={k} value={k}>{RUN_INFO[k].label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{RUN_INFO[kind].help}</p></div>
            {kind === 'act_as' && <>
              <div className="grid gap-1.5"><Label htmlFor="run-as">Runs as</Label><SubjectPicker id="run-as" value={as} onChange={setAs} only="principal" exclude={[who]} /></div>
              <div className="grid gap-1.5"><Label htmlFor="run-src">Notebook revision</Label><Select value={source} onValueChange={setSource}><SelectTrigger id="run-src" className="w-full"><SelectValue placeholder="Choose a saved notebook" /></SelectTrigger><SelectContent>{notebooks.map((n, i) => <SelectItem key={n.name} value={`${n.name} @ ${['4e1a09c', 'b72d5f1', '0c9e3a8', 'd15f7b2'][i % 4]}`}><span className="font-mono text-[13px]">{n.name}</span><span className="text-xs text-muted-foreground">current revision</span></SelectItem>)}</SelectContent></Select></div>
            </>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button disabled={!ok} onClick={() => { const s = parseSubject(who); change('policy.grant', `${name(s)}: ${kind}`, (st) => ({ runs: [...st.runs, { id: `rg_${Date.now()}`, subject: s, grant: kind, as: kind === 'act_as' ? as.split(':')[1] : undefined, source: kind === 'act_as' ? source : undefined }] })); setAdd(false); setWho(''); setAs(''); setSource('') }}>Grant</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function CatalogGrants() {
  const { catalog, change, name } = useAccess()
  const { publications } = useStore()
  const pub = publications[0]
  const tables = OWN_TABLES.map((t) => t.name)
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null)
  const [review, setReview] = useState(false)
  const [add, setAdd] = useState(false)
  const [who, setWho] = useState('')
  const saved = Object.fromEntries(catalog.filter((g) => g.publication === pub.id).map((g) => [subjectKey(g.subject), g.tables]))
  const cur = draft ?? saved
  const changes = Object.keys({ ...saved, ...cur }).flatMap((k) => tables.flatMap((t) => { const was = saved[k]?.includes(t) ?? false, is = cur[k]?.includes(t) ?? false; return was === is ? [] : [{ k, t, grant: is }] }))
  const set = (k: string, t: string, on: boolean) => setDraft({ ...cur, [k]: on ? [...(cur[k] ?? []), t] : (cur[k] ?? []).filter((x) => x !== t) })

  return (
    <div>
      <PageHeader title="Catalog grants" description="Which analytical tables each person, group or service account may query. Grants are made on a publication and enforced by the catalog for every reader, in notebooks and Spark SQL alike."
        actions={<><Revision /><Button variant="outline" onClick={() => { setAdd(true); setWho('') }}><Plus /> Add someone</Button></>} tag={<BackingTag id="AC-09" />} />
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-sm bg-olap" /><span className="font-mono font-medium">{pub.name}</span></span>
        <span className="text-muted-foreground">Publication revision {pub.revision}</span>
        <Link to="/catalog/publications" className="text-primary hover:underline">Manage publication</Link>
      </div>
      <div className={BOX}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead className="min-w-56">Who</TableHead>{tables.map((t) => <TableHead key={t} className="w-36 text-center font-mono text-xs">{t}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {Object.keys(cur).map((k) => (
              <TableRow key={k} className="h-13">
                <TableCell><Who subject={parseSubject(k)} /></TableCell>
                {tables.map((t) => { const on = cur[k].includes(t), dirty = on !== (saved[k]?.includes(t) ?? false); return <TableCell key={t} className={cn('text-center', dirty && 'bg-warning/10')}><Checkbox checked={on} aria-label={`${t} for ${name(parseSubject(k))}`} onCheckedChange={(c) => set(k, t, !!c)} /></TableCell> })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">A grant gives read access to a whole table. Changes are collected, reviewed as a plan, and applied together.</p>

      {changes.length > 0 && (
        <div className="sticky bottom-4 mt-5 flex items-center justify-between gap-4 rounded-lg border bg-card p-3 pl-4 shadow-lg">
          <div className="text-[13px]"><span className="font-medium">{changes.length} unapplied {changes.length === 1 ? 'change' : 'changes'}</span><span className="text-muted-foreground">. Nothing has changed for readers yet.</span></div>
          <div className="flex gap-2"><Button variant="ghost" onClick={() => setDraft(null)}>Discard</Button><Button onClick={() => setReview(true)}>Review plan</Button></div>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-dashed p-4 text-[13px]">
        <div className="flex items-center gap-2 font-medium">Row filters and column masks <BackingTag id="AC-09b" /></div>
        <p className="mt-1 max-w-[78ch] text-muted-foreground">Access stops at the table. Showing a group only its own region’s rows, or hiding a column such as an email address, is not available yet.</p>
      </div>

      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review the plan</DialogTitle><DialogDescription>For publication <span className="font-mono">{pub.name}</span>, revision {pub.revision}. The plan is refused if the publication changes before you apply it.</DialogDescription></DialogHeader>
          <div className="max-h-72 divide-y overflow-y-auto rounded-md border text-[13px]">
            {changes.map((c) => <div key={c.k + c.t} className="flex items-center gap-3 px-3 py-2"><span className={cn('w-14 shrink-0 font-medium', c.grant ? 'text-success' : 'text-destructive')}>{c.grant ? 'Grant' : 'Revoke'}</span><span className="font-mono text-[12.5px]">{c.t}</span><span className="text-muted-foreground">{c.grant ? 'to' : 'from'}</span><Who subject={parseSubject(c.k)} sub={false} /></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReview(false)}>Back</Button><Button onClick={() => {
            change('catalog.grant', `${changes.length} changes on ${pub.name}`, (s) => ({ catalog: [...s.catalog.filter((g) => g.publication !== pub.id), ...Object.entries(cur).filter(([, t]) => t.length).map(([k, t]) => ({ subject: parseSubject(k), publication: pub.id, tables: t }))] }))
            setDraft(null); setReview(false); toast.success(`${changes.length} catalog ${changes.length === 1 ? 'change' : 'changes'} applied`)
          }}>Apply {changes.length} {changes.length === 1 ? 'change' : 'changes'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add someone to the grant table</DialogTitle><DialogDescription>They get a row with no tables ticked. Tick tables, then review the plan.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="cat-who">Who</Label><SubjectPicker id="cat-who" value={who} onChange={setWho} exclude={Object.keys(cur)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button disabled={!who} onClick={() => { setDraft({ ...cur, [who]: [] }); setAdd(false) }}>Add row</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ProjectAudit() {
  return (
    <div>
      <PageHeader title="Access log" description={`Every access change, saved revision and run in ${PROJECT}, with who did it, on whose behalf, and attempts that were refused.`} tag={<BackingTag id="AC-10" />} />
      <AuditTable scope="project" />
    </div>
  )
}
