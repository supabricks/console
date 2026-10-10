import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, ConfirmDelete, Section } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EXTENSIONS, ROLES } from '@/lib/data'
import { useStore } from '@/lib/store'

export function Roles() {
  const [roles, setRoles] = useState(ROLES)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [access, setAccess] = useState('ro')
  const grants = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
  const matrix: Record<string, boolean[]> = { app_owner: [true, true, true, true], app_rw: [true, true, true, true], app_readonly: [true, false, false, false] }

  return (
    <div className="grid gap-8">
      <Section flush title="Roles" tag={<BackingTag id="DB-08" />} description="PostgreSQL roles that can sign in to this database or own objects in it." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> New role</Button>}>
        <Table>
          <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Can sign in</TableHead><TableHead>Attributes</TableHead><TableHead>Member of</TableHead><TableHead className="text-right">Connections</TableHead><TableHead>Notes</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-mono text-[13px]">{r.name}</TableCell>
                <TableCell>{r.login ? 'Yes' : 'No'}</TableCell>
                <TableCell>{r.attrs.length ? r.attrs.map((a) => <Badge key={a} variant="secondary" className="mr-1">{a}</Badge>) : <span className="text-muted-foreground">None</span>}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.member.join(', ') || 'none'}</TableCell>
                <TableCell className="tabular text-right">{r.conn}</TableCell>
                <TableCell className="text-muted-foreground">{r.note}</TableCell>
                <TableCell className="text-right">
                  {r.name === 'cloud_admin' ? <Lock className="ml-auto size-3.5 text-muted-foreground" /> : <Button variant="ghost" size="sm" onClick={() => toast.success(`New password generated for ${r.name} (simulated)`)}>Rotate password</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Section flush title="Table privileges" tag={<BackingTag id="DB-08" />} description="Schema public. Tick a box to grant; untick to revoke.">
        <Table>
          <TableHeader><TableRow><TableHead>Role</TableHead>{grants.map((g) => <TableHead key={g} className="text-center font-mono text-xs">{g}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {Object.entries(matrix).map(([role, row]) => (
              <TableRow key={role}>
                <TableCell className="font-mono text-[13px]">{role}</TableCell>
                {row.map((v, i) => <TableCell key={i} className="text-center"><Checkbox defaultChecked={v} disabled={role === 'app_owner'} aria-label={`${grants[i]} for ${role}`} onCheckedChange={(c) => toast.success(`${c ? 'GRANT' : 'REVOKE'} ${grants[i]} ON ALL TABLES IN SCHEMA public ${c ? 'TO' : 'FROM'} ${role}`)} /></TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New role</DialogTitle><DialogDescription>Creates a role that can sign in, with a generated password.</DialogDescription></DialogHeader>
          <div className="grid gap-8">
            <div className="grid gap-1.5"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="reporting" /></div>
            <div className="grid gap-1.5">
              <Label>Access</Label>
              <Select value={access} onValueChange={setAccess}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ro">Read only (pg_read_all_data)</SelectItem><SelectItem value="rw">Read and write</SelectItem><SelectItem value="none">No privileges; grant later</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!/^[a-z_][a-z0-9_]*$/.test(name)} onClick={() => {
              setRoles((r) => [...r, { name, login: true, attrs: [], member: access === 'none' ? [] : access === 'ro' ? ['pg_read_all_data'] : ['pg_read_all_data', 'pg_write_all_data'], conn: 0, note: 'Created just now' }])
              setOpen(false); setName(''); toast.success(`Role ${name} created`)
            }}>Create role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function Extensions() {
  const [exts, setExts] = useState(EXTENSIONS)
  const [q, setQ] = useState('')
  const shown = exts.filter((e) => e.name.includes(q.toLowerCase()) || e.desc.toLowerCase().includes(q.toLowerCase()))
  return (
    <Section
      title="Extensions"
      tag={<BackingTag id="DB-09" />}
      description="Extensions bundled with this installation. Enabling one runs CREATE EXTENSION on the selected branch."
      actions={<div className="relative w-56"><Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="Search extensions" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
    >
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((e) => (
          <div key={e.name} className="flex items-start gap-3 rounded-md border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-mono text-[13px] font-medium">{e.name}</span><span className="text-xs text-muted-foreground">{e.version}</span></div>
              <p className="mt-0.5 text-xs text-muted-foreground">{e.desc}</p>
            </div>
            <Switch
              checked={e.installed}
              disabled={e.locked}
              aria-label={`Enable ${e.name}`}
              onCheckedChange={(v) => { setExts((x) => x.map((y) => (y.name === e.name ? { ...y, installed: v } : y))); toast.success(`${v ? 'CREATE' : 'DROP'} EXTENSION ${e.name}`) }}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}

export function Settings() {
  const { db, dbBranches, setDatabases, setBranches } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState(db.name)
  const [del, setDel] = useState(false)
  const def = dbBranches.find((b) => b.isDefault)!.name
  return (
    <div className="grid max-w-3xl gap-8">
      <Section title="General">
        <div className="grid gap-8">
          <div className="flex items-end gap-3">
            <div className="grid flex-1 gap-1.5"><Label htmlFor="db-rename">Database name <BackingTag id="DB-11a" /></Label><Input id="db-rename" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button variant="outline" disabled={name === db.name || !name} onClick={() => { setDatabases((ds) => ds.map((d) => (d.id === db.id ? { ...d, name } : d))); nav(`/databases/${name}/settings`, { replace: true }); toast.success('Database renamed') }}>Rename</Button>
          </div>
          <div className="grid gap-1.5">
            <Label>Default branch <BackingTag id="DB-11a" /></Label>
            <Select value={def} onValueChange={(v) => { setBranches((bs) => bs.map((b) => (b.db === db.id ? { ...b, isDefault: b.name === v } : b))); toast.success(`${v} is now the default branch`) }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{dbBranches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Connections that do not name a branch go to the default branch.</p>
          </div>
        </div>
      </Section>
      <Section title="Danger zone">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Delete this database</div>
            <p className="text-xs text-muted-foreground">Removes {db.name} and all {dbBranches.length} of its branches. This cannot be undone.</p>
          </div>
          <Button variant="destructive" onClick={() => setDel(true)}>Delete database</Button>
        </div>
      </Section>
      <ConfirmDelete
        open={del} onOpenChange={setDel} name={db.name} kind="database"
        consequence={`All ${dbBranches.length} branches and their data are deleted, and ${db.connections} open connections are closed. History and restore points for this database are removed.`}
        onConfirm={() => { const id = db.id; nav('/databases'); setDatabases((ds) => ds.filter((d) => d.id !== id)); setBranches((bs) => bs.filter((b) => b.db !== id)); toast.success(`Database ${db.name} deleted`) }}
      />
    </div>
  )
}
