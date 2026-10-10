import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, KeyRound, Lock, MoreHorizontal, Plus, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { SubjectPicker, Who } from '@/components/access-parts'
import { BackingTag, CodeBlock, ConfirmDelete, PageHeader, Stat } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { parseSubject, PROJECT, subjectKey, useAccess } from '@/lib/access'
import type { Subject } from '@/lib/access'
import { cn } from '@/lib/utils'

type Grant = { subject: Subject; level: 'use' | 'manage' }
type Use = { at: string; by: string; as?: string; where: string }
type Secret = { name: string; description: string; set: boolean; updated: string; updatedBy: string; versions: number; lastUsed: string | null; grants: Grant[]; usedBy: { label: string; to: string }[]; uses: Use[]; required?: string }

const P = (id: string): Subject => ({ kind: 'principal', id })
const G = (id: string): Subject => ({ kind: 'group', id })
const SEED: Secret[] = [
  { name: 'WAREHOUSE_EXPORT_TOKEN', description: 'Token for the nightly export to the finance warehouse.', set: true, updated: 'Sep 18', updatedBy: 'Maya Okafor', versions: 2, lastUsed: 'Oct 9, 02:31', grants: [{ subject: P('sv_nightly'), level: 'use' }, { subject: G('gr_platform'), level: 'manage' }], usedBy: [{ label: 'Job nightly-revenue-report', to: '/jobs/job_nightly' }, { label: 'Notebook revenue-exploration.ipynb', to: '/notebooks/revenue-exploration.ipynb' }], uses: [{ at: 'Oct 9, 02:31', by: 'sv_nightly', where: 'Run 22 of nightly-revenue-report' }, { at: 'Oct 8, 02:31', by: 'sv_nightly', where: 'Run 21 of nightly-revenue-report' }, { at: 'Oct 7, 15:12', by: 'pr_priya', as: 'sv_nightly', where: 'Notebook revenue-exploration.ipynb' }] },
  { name: 'FEATURE_STORE_KEY', description: 'Write key for the churn feature store.', set: true, updated: 'Sep 30', updatedBy: 'Daniel Reyes', versions: 1, lastUsed: 'Oct 10, 13:55', grants: [{ subject: P('sv_nightly'), level: 'use' }, { subject: G('gr_analysts'), level: 'use' }, { subject: P('pr_daniel'), level: 'manage' }], usedBy: [{ label: 'Job churn-features-refresh', to: '/jobs/job_churn' }, { label: 'Notebook churn-features.ipynb', to: '/notebooks/churn-features.ipynb' }], uses: [{ at: 'Oct 10, 13:55', by: 'sv_nightly', where: 'Run 58 of churn-features-refresh' }, { at: 'Oct 10, 01:40', by: 'sv_nightly', where: 'Run 57 of churn-features-refresh' }] },
  { name: 'GEOCODER_API_KEY', description: 'Address lookup, used during region clean-up in May.', set: true, updated: 'May 14', updatedBy: 'Hannah Weiss', versions: 1, lastUsed: null, grants: [{ subject: G('gr_analysts'), level: 'use' }], usedBy: [], uses: [] },
  { name: 'REPORT_SMTP_PASSWORD', description: '', set: false, updated: '', updatedBy: '', versions: 0, lastUsed: null, grants: [], usedBy: [{ label: 'Job nightly-revenue-report', to: '/jobs/job_nightly' }], uses: [], required: 'Declared in supabricks.toml by notebook revenue-exploration.ipynb' },
]

export default function Secrets() {
  const { name: who } = useAccess()
  const [secrets, setSecrets] = useState(SEED)
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<{ mode: 'new' | 'replace'; name: string; description: string; value: string } | null>(null)
  const [del, setDel] = useState<Secret | null>(null)
  const [grantWho, setGrantWho] = useState('')
  const [grantLevel, setGrantLevel] = useState<'use' | 'manage'>('use')
  const sel = secrets.find((s) => s.name === open)
  const missing = secrets.filter((s) => !s.set)
  const patch = (name: string, fn: (s: Secret) => Secret) => setSecrets((ss) => ss.map((s) => (s.name === name ? fn(s) : s)))
  const nameOk = !!form && /^[A-Z][A-Z0-9_]{2,63}$/.test(form.name) && (form.mode === 'replace' || !secrets.some((s) => s.name === form.name))
  const save = () => {
    if (!form) return
    if (form.mode === 'new') setSecrets((ss) => [{ name: form.name, description: form.description, set: true, updated: 'Oct 10', updatedBy: 'Maya Okafor', versions: 1, lastUsed: null, grants: [{ subject: P('pr_maya'), level: 'manage' }], usedBy: [], uses: [] }, ...ss])
    else patch(form.name, (s) => ({ ...s, set: true, updated: 'Oct 10', updatedBy: 'Maya Okafor', versions: s.versions + 1, grants: s.grants.length ? s.grants : [{ subject: P('pr_maya'), level: 'manage' }] }))
    toast.success(form.mode === 'new' ? `${form.name} stored` : `${form.name} has a new value`, { description: form.mode === 'new' ? 'The value cannot be read back here. Grant who may use it.' : 'Runs that start from now on read the new value.' })
    if (form.mode === 'new') setOpen(form.name)
    setForm(null)
  }

  return (
    <div>
      <PageHeader title="Secrets" tag={<BackingTag id="SC-01" />} description={`Passwords, tokens and keys that notebooks and jobs in ${PROJECT} need for other systems. A value goes in once and can never be read back here; code reads it by name while it runs.`}
        actions={<Button onClick={() => setForm({ mode: 'new', name: '', description: '', value: '' })}><Plus /> New secret</Button>} />

      {missing.map((s) => (
        <div key={s.name} className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/8 p-3 pl-4">
          <div className="flex min-w-0 items-start gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /><div className="min-w-0 text-[13px]"><div className="flex items-center gap-2 font-medium"><span className="font-mono">{s.name}</span> is required but has no value <BackingTag id="SC-04" /></div><div className="text-muted-foreground">{s.required}. Runs that read it will fail until it is set.</div></div></div>
          <Button size="sm" onClick={() => setForm({ mode: 'replace', name: s.name, description: s.description, value: '' })}>Set value</Button>
        </div>
      ))}

      <div className="mb-7 grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="Secrets" value={secrets.filter((s) => s.set).length} sub={missing.length ? `${missing.length} required and not set` : 'All required ones are set'} />
        <Stat label="Used in the last day" value={secrets.filter((s) => s.lastUsed?.startsWith('Oct 10') || s.lastUsed?.startsWith('Oct 9')).length} />
        <Stat label="Never used" value={secrets.filter((s) => s.set && !s.lastUsed).length} sub="Candidates to delete" />
        <Stat label="Oldest value" value="May 14" sub="GEOCODER_API_KEY, 149 days" />
      </div>

      <div className="overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_td:last-child]:pr-3 [&_th:first-child]:pl-4">
        <Table>
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>Name</TableHead><TableHead>Used by</TableHead><TableHead>Who may use it</TableHead><TableHead>Value set</TableHead><TableHead>Last used</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {secrets.map((s) => (
              <TableRow key={s.name} className="h-14 cursor-pointer" onClick={() => setOpen(s.name)}>
                <TableCell><div className="flex items-center gap-2 font-mono text-[13px] font-medium"><Lock className={cn('size-3.5', s.set ? 'text-muted-foreground' : 'text-warning')} />{s.name}</div>{s.description && <div className="max-w-80 truncate pl-5.5 text-xs text-muted-foreground">{s.description}</div>}</TableCell>
                <TableCell className={cn('text-[13px]', !s.usedBy.length && 'text-muted-foreground')}>{s.usedBy.length ? `${s.usedBy.length} ${s.usedBy.length === 1 ? 'place' : 'places'}` : 'Nothing'}</TableCell>
                <TableCell className={cn('text-[13px]', !s.grants.length && 'text-muted-foreground')}>{s.grants.length ? s.grants.map((g) => who(g.subject)).join(', ') : 'Nobody'}</TableCell>
                <TableCell className="text-[13px]">{s.set ? <span className="grid leading-tight"><span className="tabular">{s.updated}</span><span className="text-xs text-muted-foreground">{s.updatedBy}{s.versions > 1 && `, replaced ${s.versions - 1} ${s.versions === 2 ? 'time' : 'times'}`}</span></span> : <span className="text-warning">Not set</span>}</TableCell>
                <TableCell className={cn('tabular text-[13px]', !s.lastUsed && 'text-muted-foreground')}>{s.lastUsed ?? 'Never'}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setForm({ mode: 'replace', name: s.name, description: s.description, value: '' })}>{s.set ? 'Replace value' : 'Set value'}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setOpen(s.name)}>Who may use it</DropdownMenuItem>
                      <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => setDel(s)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">Reading a secret <BackingTag id="SC-02" /></h2>
          <p className="mb-2.5 text-[13px] text-muted-foreground">In a notebook or a job, ask for it by name. If the value is printed or ends up in an error, it is replaced with asterisks before the output is saved.</p>
          <CodeBlock code={`from supabricks import secrets\n\ntoken = secrets.get("WAREHOUSE_EXPORT_TOKEN")\nprint(token)   # ********`} />
        </div>
        <div className="grid gap-3 text-[13px]">
          <h2 className="text-[15px] font-semibold">What stays out</h2>
          <ul className="grid gap-2 text-muted-foreground [&>li]:flex [&>li]:gap-2.5 [&>li>span:first-child]:mt-[7px] [&>li>span:first-child]:size-1 [&>li>span:first-child]:shrink-0 [&>li>span:first-child]:rounded-full [&>li>span:first-child]:bg-muted-foreground">
            <li><span /><span>Values are never part of the project definition, a package or a backup you download. A project lists only the <span className="text-foreground">names</span> it needs.</span></li>
            <li><span /><span>Nobody can read a value back, including administrators. To change one, replace it.</span></li>
            <li><span /><span>Every read is recorded with who ran the code, on whose behalf, and where.</span></li>
          </ul>
          <div className="rounded-lg border border-dashed p-3"><div className="font-medium">Runs cannot call out yet</div><p className="mt-0.5 text-muted-foreground">On this server, notebook and job runs have no outside network. A secret can be read, but code cannot yet use it to reach another system.</p></div>
        </div>
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {sel && (
            <>
              <SheetHeader><SheetTitle className="flex items-center gap-2 pr-6 font-mono text-base"><KeyRound className="size-4" />{sel.name}</SheetTitle><SheetDescription>{sel.description || 'No description.'}</SheetDescription></SheetHeader>
              <div className="grid min-w-0 grid-cols-1 gap-6 px-4 pb-6 [&>*]:min-w-0">
                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 py-2 pr-2 pl-3">
                  <div className="text-[13px]">{sel.set ? <><span className="font-mono tracking-widest">••••••••••••</span><span className="block text-xs text-muted-foreground">Set {sel.updated} by {sel.updatedBy}. Version {sel.versions}.</span></> : <span className="text-warning">No value yet</span>}</div>
                  <Button variant="outline" size="sm" onClick={() => setForm({ mode: 'replace', name: sel.name, description: sel.description, value: '' })}><RefreshCw /> {sel.set ? 'Replace' : 'Set value'}</Button>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">Who may use it <BackingTag id="SC-03" /></div>
                  <div className="divide-y rounded-md border">
                    {sel.grants.map((g) => (
                      <div key={subjectKey(g.subject)} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                        <Who subject={g.subject} className="flex-1" />
                        <Select value={g.level} onValueChange={(v) => patch(sel.name, (s) => ({ ...s, grants: s.grants.map((x) => (x === g ? { ...x, level: v as Grant['level'] } : x)) }))}><SelectTrigger size="sm" className="w-44" aria-label={`Level for ${who(g.subject)}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="use">Use in code</SelectItem><SelectItem value="manage">Use and manage</SelectItem></SelectContent></Select>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${who(g.subject)}`} onClick={() => patch(sel.name, (s) => ({ ...s, grants: s.grants.filter((x) => x !== g) }))}><X /></Button>
                      </div>
                    ))}
                    {sel.grants.length === 0 && <div className="px-3 py-2.5 text-[13px] text-muted-foreground">Nobody. Code that asks for it is refused.</div>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <div className="min-w-0 flex-1"><SubjectPicker value={grantWho} onChange={setGrantWho} exclude={sel.grants.map((g) => subjectKey(g.subject))} /></div>
                    <Select value={grantLevel} onValueChange={(v) => setGrantLevel(v as Grant['level'])}><SelectTrigger className="w-40" aria-label="Level"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="use">Use in code</SelectItem><SelectItem value="manage">Use and manage</SelectItem></SelectContent></Select>
                    <Button variant="outline" disabled={!grantWho} onClick={() => { patch(sel.name, (s) => ({ ...s, grants: [...s.grants, { subject: parseSubject(grantWho), level: grantLevel }] })); setGrantWho('') }}>Add</Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Using a secret means code they run can read it. Managing means replacing the value, changing this list and deleting it. Neither shows the value.</p>
                </div>

                <div>
                  <div className="mb-2 text-[13px] font-medium">Used by</div>
                  {sel.usedBy.length ? <ul className="grid gap-1 text-[13px]">{sel.usedBy.map((u) => <li key={u.label}><Link to={u.to} className="text-primary hover:underline">{u.label}</Link></li>)}</ul> : <p className="text-[13px] text-muted-foreground">No notebook or job declares this secret.</p>}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">Recent reads <BackingTag id="SC-03" compact /></div>
                  {sel.uses.length ? (
                    <div className="divide-y rounded-md border text-[13px]">{sel.uses.map((u) => <div key={u.at + u.where} className="grid gap-0.5 px-3 py-2"><span className="flex items-center gap-1.5"><Who subject={u.by} sub={false} />{u.as && <span className="inline-flex items-center gap-1.5 text-muted-foreground">as <Who subject={u.as} sub={false} /></span>}</span><span className="flex justify-between gap-3 text-xs text-muted-foreground"><span className="truncate">{u.where}</span><span className="tabular shrink-0">{u.at}</span></span></div>)}</div>
                  ) : <p className="text-[13px] text-muted-foreground">Never read.</p>}
                </div>

                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDel(sel)}>Delete secret</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          {form && (
            <>
              <DialogHeader><DialogTitle>{form.mode === 'new' ? 'New secret' : <>New value for <span className="font-mono">{form.name}</span></>}</DialogTitle><DialogDescription>{form.mode === 'new' ? 'You will not be able to see the value again after saving.' : 'The old value stops working for runs that start from now on. Runs already in progress keep the value they read.'}</DialogDescription></DialogHeader>
              <div className="grid gap-4">
                {form.mode === 'new' && <div className="grid gap-1.5"><Label htmlFor="sc-name">Name</Label><Input id="sc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })} placeholder="PAYMENTS_API_KEY" className="font-mono text-[13px]" autoComplete="off" />{form.name && !nameOk && <p className="text-xs text-destructive">{secrets.some((s) => s.name === form.name) ? 'A secret with this name exists.' : 'Capital letters, digits and underscores, starting with a letter.'}</p>}</div>}
                <div className="grid gap-1.5"><Label htmlFor="sc-val">Value</Label><Textarea id="sc-val" rows={3} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="font-mono text-[13px] [-webkit-text-security:disc]" autoComplete="off" spellCheck={false} placeholder="Paste the value" /><p className="text-xs text-muted-foreground">Up to 64 KiB. Stored encrypted; the key is kept outside the project’s database.</p></div>
                {form.mode === 'new' && <div className="grid gap-1.5"><Label htmlFor="sc-desc">What it is for</Label><Input id="sc-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Which system, and who owns it there" /></div>}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button disabled={!nameOk || !form.value} onClick={save}>{form.mode === 'new' ? 'Store secret' : 'Replace value'}</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {del && <ConfirmDelete open onOpenChange={(o) => !o && setDel(null)} name={del.name} kind="secret" consequence={del.usedBy.length ? `${del.usedBy.map((u) => u.label).join(' and ')} read this secret and will fail on their next run. The value cannot be recovered.` : 'Nothing declares this secret. The value cannot be recovered.'} onConfirm={() => { setSecrets((ss) => ss.filter((s) => s.name !== del.name)); setOpen(null) }} />}
    </div>
  )
}
