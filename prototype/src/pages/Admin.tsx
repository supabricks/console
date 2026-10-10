import { useState } from 'react'
import { KeyRound, LogOut, MoreHorizontal, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { AuditTable, EffectiveAccess, SubjectPicker, Who } from '@/components/access-parts'
import { BackingTag, ConfirmDelete, CopyField, PageHeader, Section, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ISSUER, ME, useAccess } from '@/lib/access'
import type { Principal } from '@/lib/access'
import { cn } from '@/lib/utils'

const HEAD = 'bg-muted/50 hover:bg-muted/50'
const BOX = 'overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-3'
const state = (p: Principal) => (p.invited ? 'invited' : p.disabled ? 'disabled' : 'active')

function GroupChips({ id }: { id: string }) {
  const { groupsOf } = useAccess()
  const gs = groupsOf(id)
  return gs.length ? <span className="flex flex-wrap gap-1">{gs.map((g) => <span key={g.id} className="rounded border px-1.5 py-0.5 font-mono text-xs">{g.label}</span>)}</span> : <span className="text-muted-foreground">None</span>
}

export function People() {
  const { principals, groups, setPrincipals, setGroups, setSessions, log, groupsOf } = useAccess()
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [invite, setInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [addTo, setAddTo] = useState('')
  const users = principals.filter((p) => p.kind === 'user')
  const rows = users.filter((p) => `${p.label} ${p.email}`.toLowerCase().includes(q.toLowerCase()))
  const p = principals.find((x) => x.id === openId)
  const disable = (x: Principal) => {
    setPrincipals((ps) => ps.map((y) => (y.id === x.id ? { ...y, disabled: !y.disabled } : y)))
    if (!x.disabled) setSessions((s) => s.filter((w) => w.principal !== x.id))
    log(x.disabled ? 'principal.enable' : 'principal.disable', x.label)
    toast.success(x.disabled ? `${x.label} can sign in again` : `${x.label} is disabled`, { description: x.disabled ? undefined : 'Their sessions were ended. Roles and grants are kept.' })
  }
  const member = (gid: string, pid: string, present: boolean) => {
    const g = groups.find((x) => x.id === gid)!
    setGroups((gs) => gs.map((x) => (x.id === gid ? { ...x, members: present ? [...x.members, pid] : x.members.filter((m) => m !== pid) } : x)))
    log('group.membership', `${principals.find((x) => x.id === pid)?.label} ${present ? 'added to' : 'removed from'} ${g.label}`)
  }

  return (
    <div>
      <PageHeader title="People" description="Everyone who can sign in to this installation. A person appears here the first time they sign in through your identity provider; what they can do is set in each project."
        actions={<Button onClick={() => setInvite(true)}><UserPlus /> Invite person</Button>} />
      <div className="mb-7 grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="People" value={users.length} sub={`${users.filter((u) => !u.disabled && !u.invited).length} active`} />
        <Stat label="Disabled" value={users.filter((u) => u.disabled).length} sub="Cannot sign in" />
        <Stat label="Groups" value={groups.length} />
        <Stat label="Service accounts" value={principals.filter((x) => x.kind === 'service').length} />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="h-8 w-72 pl-8" /></div>
      </div>
      <div className={BOX}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead>Person</TableHead><TableHead>Groups</TableHead><TableHead><span className="inline-flex items-center gap-1.5">Last sign-in <BackingTag id="AC-02b" compact /></span></TableHead><TableHead>Status</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} className="h-13 cursor-pointer" onClick={() => setOpenId(u.id)}>
                <TableCell><span className="inline-flex items-center gap-2"><Who subject={u.id} />{u.id === ME && <span className="rounded border px-1 text-[11px] text-muted-foreground">you</span>}</span></TableCell>
                <TableCell><GroupChips id={u.id} /></TableCell>
                <TableCell className="text-muted-foreground">{u.lastSeen ?? 'Never'}</TableCell>
                <TableCell><StatusBadge status={state(u)} /></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setOpenId(u.id)}>View access</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={u.id === ME} variant={u.disabled ? 'default' : 'destructive'} onClick={() => disable(u)}>{u.disabled ? 'Enable sign-in' : 'Disable sign-in'}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Disabling a person ends their sessions at once and keeps their roles and grants, so enabling them restores the same access. <BackingTag id="AC-02" className="ml-1" /></p>

      <Sheet open={!!p} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {p && (
            <>
              <SheetHeader>
                <SheetTitle>{p.label}</SheetTitle>
                <SheetDescription>{p.email}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 px-4 pb-6">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px] [&_dt]:text-muted-foreground">
                  <dt>Status</dt><dd><StatusBadge status={state(p)} /></dd>
                  <dt>First signed in</dt><dd className="tabular">{p.invited ? 'Not yet' : p.created}</dd>
                  <dt>Identity provider</dt><dd className="truncate font-mono text-xs">{ISSUER}</dd>
                  <dt>Subject</dt><dd className="truncate font-mono text-xs">{p.subject ?? 'Assigned at first sign-in'}</dd>
                </dl>
                <p className="-mt-3 text-xs text-muted-foreground">Identity is the provider’s subject, not the email address. Changing someone’s email never changes what they can do.</p>
                <div>
                  <div className="mb-2 text-[13px] font-medium">Groups</div>
                  <div className="divide-y rounded-md border">
                    {groupsOf(p.id).map((g) => (
                      <div key={g.id} className="flex items-center justify-between py-1.5 pr-1.5 pl-3 text-[13px]"><span className="font-mono">{g.label}</span><Button variant="ghost" size="icon-sm" aria-label={`Remove from ${g.label}`} onClick={() => member(g.id, p.id, false)}><X /></Button></div>
                    ))}
                    {groupsOf(p.id).length === 0 && <div className="px-3 py-2 text-[13px] text-muted-foreground">Not in any group.</div>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Select value={addTo} onValueChange={setAddTo}><SelectTrigger size="sm" className="flex-1" aria-label="Group to add"><SelectValue placeholder="Add to a group" /></SelectTrigger><SelectContent>{groups.filter((g) => !g.members.includes(p.id)).map((g) => <SelectItem key={g.id} value={g.id}><span className="font-mono text-[13px]">{g.label}</span></SelectItem>)}</SelectContent></Select>
                    <Button size="sm" variant="outline" disabled={!addTo} onClick={() => { member(addTo, p.id, true); setAddTo('') }}>Add</Button>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">What they can do <BackingTag id="AC-11" /></div>
                  <div className="rounded-md border p-3"><EffectiveAccess id={p.id} /></div>
                </div>
                <Button variant="outline" disabled={p.id === ME} className={cn(!p.disabled && 'text-destructive hover:text-destructive')} onClick={() => disable(p)}>{p.disabled ? 'Enable sign-in' : 'Disable sign-in'}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Invite a person <BackingTag id="AC-02b" /></DialogTitle>
            <DialogDescription>Give someone groups before they first sign in. They still sign in through your identity provider; the invitation only prepares their access.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="inv-email">Work email</Label><Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvite(false)}>Cancel</Button>
            <Button disabled={!/.+@.+\..+/.test(email)} onClick={() => {
              const label = email.split('@')[0].split(/[._]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
              setPrincipals((ps) => [...ps, { id: `pr_${Date.now()}`, kind: 'user', label, email, disabled: false, invited: true, created: '2026-10-10' }])
              log('principal.invite', email); setInvite(false); setEmail(''); toast.success(`Invitation prepared for ${email}`)
            }}>Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function Groups() {
  const { groups, setGroups, principals, roles, data, runs, catalog, log, name } = useAccess()
  const [sel, setSel] = useState(groups[0]?.id ?? '')
  const [create, setCreate] = useState(false)
  const [label, setLabel] = useState('')
  const [add, setAdd] = useState('')
  const [del, setDel] = useState(false)
  const g = groups.find((x) => x.id === sel) ?? groups[0]
  const uses = g ? [
    ...roles.filter((r) => r.subject.id === g.id).map((r) => `Role: ${r.role} in sales-analytics`),
    ...data.filter((d) => d.subject.id === g.id).map((d) => `Data: ${d.caps.length} permissions on ${d.db.replace('db_', '')} / ${d.branch}`),
    ...runs.filter((r) => r.subject.id === g.id).map((r) => `Runs: ${r.grant.replace('_', ' ')}`),
    ...catalog.filter((c) => c.subject.id === g.id).map((c) => `Catalog: ${c.tables.length} tables`),
  ] : []
  const valid = /^[a-z][a-z0-9-]{1,39}$/.test(label) && !groups.some((x) => x.label === label)

  return (
    <div>
      <PageHeader title="Groups" description="Grant access to a group once and manage who is in it here. A person holds everything granted to any of their groups."
        actions={<Button onClick={() => setCreate(true)}><Plus /> New group</Button>} tag={<BackingTag id="AC-03" />} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="self-start overflow-hidden rounded-lg border">
          {groups.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={cn('flex w-full items-center justify-between border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50', x.id === g?.id && 'bg-muted shadow-[inset_2px_0_0_var(--foreground)]')}>
              <span className="truncate font-mono text-[13px] font-medium">{x.label}</span><span className="tabular text-xs text-muted-foreground">{x.members.length}</span>
            </button>
          ))}
        </div>
        {g && (
          <div className="grid min-w-0 gap-7">
            <Section flush title={`Members of ${g.label}`} description={`${g.members.length} ${g.members.length === 1 ? 'person' : 'people'}. Changes take effect on their next request.`}
              actions={<><div className="w-56"><SubjectPicker value={add} onChange={setAdd} only="principal" exclude={g.members.map((m) => `principal:${m}`)} /></div><Button variant="outline" disabled={!add} onClick={() => { const id = add.split(':')[1]; setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, members: [...x.members, id] } : x))); log('group.membership', `${name(id)} added to ${g.label}`); setAdd('') }}>Add</Button></>}>
              <Table>
                <TableBody>
                  {g.members.map((m) => (
                    <TableRow key={m} className="h-13">
                      <TableCell><Who subject={m} /></TableCell>
                      <TableCell className="text-muted-foreground">{principals.find((x) => x.id === m)?.disabled ? 'Disabled' : ''}</TableCell>
                      <TableCell className="w-12"><Button variant="ghost" size="icon-sm" aria-label={`Remove ${name(m)}`} onClick={() => { setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, members: x.members.filter((y) => y !== m) } : x))); log('group.membership', `${name(m)} removed from ${g.label}`) }}><X /></Button></TableCell>
                    </TableRow>
                  ))}
                  {g.members.length === 0 && <TableRow><TableCell className="h-20 text-center text-muted-foreground">Nobody is in this group yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Section>
            <Section title="What this group grants" description="Everything a member receives by being in this group.">
              {uses.length ? <ul className="grid gap-1.5 text-[13px]">{uses.map((u) => <li key={u}>{u}</li>)}</ul> : <span className="text-[13px] text-muted-foreground">Nothing yet. Give the group a role in a project to make it useful.</span>}
            </Section>
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
              <div><div className="flex items-center gap-2 font-medium">Delete this group <BackingTag id="AC-03b" /></div><div className="text-[13px] text-muted-foreground">Members lose everything granted through it. Their own direct access is kept.</div></div>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDel(true)}><Trash2 /> Delete group</Button>
            </div>
            <ConfirmDelete open={del} onOpenChange={setDel} name={g.label} kind="group" consequence={`${g.members.length} members lose the access granted through this group, in every project.`} onConfirm={() => { setGroups((gs) => gs.filter((x) => x.id !== g.id)); log('group.delete', g.label); setSel(groups.find((x) => x.id !== g.id)?.id ?? '') }} />
          </div>
        )}
      </div>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New group</DialogTitle><DialogDescription>Name it after a team or a job, not a permission. You give it access in each project.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="grp-name">Name</Label><Input id="grp-name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="data-science" className="font-mono" /><p className="text-xs text-muted-foreground">Lowercase letters, digits and hyphens.</p></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreate(false)}>Cancel</Button><Button disabled={!valid} onClick={() => { const id = `gr_${label}`; setGroups((gs) => [...gs, { id, label, members: [] }]); log('group.create', label); setSel(id); setCreate(false); setLabel('') }}>Create group</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ServiceAccounts() {
  const { principals, setPrincipals, tokens, setTokens, log, effective } = useAccess()
  const [create, setCreate] = useState(false)
  const [label, setLabel] = useState('')
  const [issue, setIssue] = useState<Principal | null>(null)
  const [control, setControl] = useState(false)
  const [ttl, setTtl] = useState('30')
  const [secret, setSecret] = useState<string | null>(null)
  const services = principals.filter((p) => p.kind === 'service')
  const valid = /^[a-z][a-z0-9-]{1,39}$/.test(label) && !principals.some((p) => p.label === label)
  const close = () => { setIssue(null); setSecret(null); setControl(false); setTtl('30') }

  return (
    <div>
      <PageHeader title="Service accounts" description="Identities for automation: scheduled reports, deploy pipelines, anything that is not a person. A service account gets roles and grants like anyone else, and signs in with a short-lived token."
        actions={<Button onClick={() => setCreate(true)}><Plus /> New service account</Button>} tag={<BackingTag id="AC-04" />} />
      <div className={BOX}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead>Service account</TableHead><TableHead>Role in sales-analytics</TableHead><TableHead>Live tokens</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead className="w-64" /></TableRow></TableHeader>
          <TableBody>
            {services.map((s) => {
              const live = tokens.filter((t) => t.principal === s.id), role = effective(s.id).role
              return (
                <TableRow key={s.id} className="h-13">
                  <TableCell><Who subject={s.id} sub={false} /><div className="mt-0.5 pl-9.5 font-mono text-xs text-muted-foreground">{s.id}</div></TableCell>
                  <TableCell className={role ? 'capitalize' : 'text-muted-foreground'}>{role ?? 'None'}</TableCell>
                  <TableCell>{live.length ? <span><span className="tabular font-medium">{live.length}</span><span className="text-muted-foreground">, next expires in {Math.min(...live.map((t) => t.expiresMin))} min</span></span> : <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell className="tabular text-muted-foreground">{s.created}</TableCell>
                  <TableCell><StatusBadge status={s.disabled ? 'disabled' : 'active'} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" disabled={s.disabled} onClick={() => setIssue(s)}><KeyRound /> Issue token</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={!live.length} onClick={() => { setTokens((t) => t.filter((x) => x.principal !== s.id)); log('service.revoke', s.label); toast.success(`Tokens for ${s.label} revoked`) }}>Revoke all tokens</DropdownMenuItem>
                          <DropdownMenuItem variant={s.disabled ? 'default' : 'destructive'} onClick={() => { setPrincipals((ps) => ps.map((x) => (x.id === s.id ? { ...x, disabled: !x.disabled } : x))); if (!s.disabled) setTokens((t) => t.filter((x) => x.principal !== s.id)); log(s.disabled ? 'principal.enable' : 'principal.disable', s.label) }}>{s.disabled ? 'Enable' : 'Disable'}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="mt-6 rounded-lg border border-dashed p-4 text-[13px]">
        <div className="flex items-center gap-2 font-medium">Long-lived keys <BackingTag id="AC-04b" /></div>
        <p className="mt-1 max-w-[78ch] text-muted-foreground">Tokens last at most one hour, so automation has to ask for a new one before each job. Keys that last days or months, with a last-used time and rotation, are not available yet.</p>
      </div>

      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New service account</DialogTitle><DialogDescription>It starts with no access. Give it a role and grants in each project it should work in.</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="svc-name">Name</Label><Input id="svc-name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="weekly-export" className="font-mono" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreate(false)}>Cancel</Button><Button disabled={!valid} onClick={() => { setPrincipals((ps) => [...ps, { id: `sv_${label.replaceAll('-', '_')}`, kind: 'service', label, disabled: false, created: '2026-10-10' }]); log('service.create', label); setCreate(false); setLabel('') }}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issue} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          {issue && !secret && (
            <>
              <DialogHeader><DialogTitle>Issue a token for <span className="font-mono">{issue.label}</span></DialogTitle><DialogDescription>The token acts with this account’s roles and grants until it expires.</DialogDescription></DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>What the token may do</Label>
                  <label className="flex items-start gap-2.5 text-[13px]"><Checkbox checked disabled className="mt-0.5" /><span><span className="font-medium">Identify itself</span><span className="block text-muted-foreground">Always included.</span></span></label>
                  <label className="flex items-start gap-2.5 text-[13px]"><Checkbox checked={control} onCheckedChange={(c) => setControl(!!c)} className="mt-0.5" /><span><span className="font-medium">Use the project</span><span className="block text-muted-foreground">Read, save and run within what the account has been granted.</span></span></label>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ttl">Expires after</Label>
                  <Select value={ttl} onValueChange={setTtl}><SelectTrigger id="ttl" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{['5', '15', '30', '60'].map((m) => <SelectItem key={m} value={m}>{m} minutes</SelectItem>)}</SelectContent></Select>
                  <p className="text-xs text-muted-foreground">One hour is the longest a token can last.</p>
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={() => { setTokens((t) => [...t, { id: `tk_${Date.now() % 10000}`, principal: issue.id, scopes: control ? ['self', 'control'] : ['self'], issued: '14:05', expiresMin: +ttl }]); log('service.issue', issue.label); setSecret('sbs_9fQ2mX7cTk4LwZ1pRa8VnEy3HdB6uJ0s') }}>Issue token</Button></DialogFooter>
            </>
          )}
          {issue && secret && (
            <>
              <DialogHeader><DialogTitle>Copy the token now</DialogTitle><DialogDescription>This is the only time it is shown. It expires in {ttl} minutes.</DialogDescription></DialogHeader>
              <CopyField label={`Token for ${issue.label}`} value={secret} />
              <DialogFooter><Button onClick={close}>Done</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function SignInSettings() {
  const { sessions, setSessions, log, name } = useAccess()
  const [edit, setEdit] = useState(false)
  const [all, setAll] = useState(false)
  const row = 'grid grid-cols-[180px_1fr] gap-3 py-2 text-[13px] [&>dt]:text-muted-foreground'
  return (
    <div>
      <PageHeader title="Sign-in" description="People sign in through your organisation’s identity provider. Supabricks never stores passwords." />
      <div className="grid gap-8">
        <Section title="Identity provider" description="OpenID Connect. If the provider cannot be reached, nobody can sign in and open sessions stop working." tag={<BackingTag id="AC-05" />} actions={<Button variant="outline" onClick={() => setEdit(true)}>Edit</Button>}>
          <dl className="divide-y">
            <div className={row}><dt>Provider</dt><dd className="flex items-center gap-3"><span className="font-medium">corporate</span><StatusBadge status="healthy" /></dd></div>
            <div className={row}><dt>Issuer</dt><dd className="truncate font-mono text-[12.5px]">{ISSUER}</dd></div>
            <div className={row}><dt>Client ID</dt><dd className="font-mono text-[12.5px]">platform</dd></div>
            <div className={row}><dt>Client secret</dt><dd className="text-muted-foreground">Set. Never shown again.</dd></div>
            <div className={row}><dt>Token check</dt><dd className="truncate font-mono text-[12.5px]">{ISSUER}/protocol/openid-connect/token/introspect</dd></div>
            <div className={row}><dt>Redirect address</dt><dd className="truncate font-mono text-[12.5px]">https://analytics.internal.example:8443/auth/v1/callback</dd></div>
            <div className={row}><dt>First administrator</dt><dd><Who subject={ME} sub={false} /></dd></div>
          </dl>
        </Section>

        <Section flush title="Signed-in sessions" description="Who is signed in right now." tag={<BackingTag id="AC-05b" />}
          actions={<Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setAll(true)}><LogOut /> Sign everyone out</Button>}>
          <Table>
            <TableHeader><TableRow className={HEAD}><TableHead>Who</TableHead><TableHead>Type</TableHead><TableHead>Started</TableHead><TableHead>Expires</TableHead><TableHead>From</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id} className="h-12">
                  <TableCell><Who subject={s.principal} sub={false} /></TableCell><TableCell>{s.channel}</TableCell><TableCell className="tabular text-muted-foreground">{s.started}</TableCell><TableCell className="tabular text-muted-foreground">{s.expires}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{s.from}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" disabled={s.principal === ME} onClick={() => { setSessions((x) => x.filter((y) => y.id !== s.id)); log('session.revoke', name(s.principal)) }}>Sign out</Button></TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">Nobody is signed in.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Section>
      </div>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit identity provider</DialogTitle><DialogDescription>The issuer, client and redirect address must match the provider exactly. A wrong value locks everyone out until it is corrected on the server.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label htmlFor="idp-iss">Issuer</Label><Input id="idp-iss" defaultValue={ISSUER} className="font-mono text-[13px]" /></div>
            <div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label htmlFor="idp-cid">Client ID</Label><Input id="idp-cid" defaultValue="platform" className="font-mono text-[13px]" /></div><div className="grid gap-1.5"><Label htmlFor="idp-sec">Client secret</Label><Input id="idp-sec" type="password" placeholder="Leave empty to keep" /></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button><Button onClick={() => { setEdit(false); log('provider.configure', 'corporate'); toast.success('Identity provider saved') }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={all} onOpenChange={setAll}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sign everyone out?</DialogTitle><DialogDescription>All {sessions.length} sessions end now, including yours and every service token. Running notebooks keep running; people sign in again to see them.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setAll(false)}>Cancel</Button><Button variant="destructive" onClick={() => { setSessions((s) => s.filter((x) => x.principal === ME)); log('session.rotate', 'All sessions'); setAll(false); toast.success('Everyone was signed out') }}>Sign everyone out</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AuditLog() {
  return (
    <div>
      <PageHeader title="Audit log" description="Sign-ins and changes to people, groups, service accounts and the identity provider. Each project keeps its own log of access changes and denied attempts." tag={<BackingTag id="AC-10" />} />
      <AuditTable scope="installation" />
    </div>
  )
}
