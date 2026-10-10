import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cable, MoreHorizontal, Pause, Play, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtMb, SIZES } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function SizePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-5 gap-2">
      {SIZES.map((s) => (
        <label key={s.id} className={cn('cursor-pointer rounded-md border p-2.5 transition-colors', value === s.id ? 'border-primary bg-primary/8' : 'hover:bg-muted/50')}>
          <RadioGroupItem value={s.id} className="sr-only" />
          <div className="text-xs font-medium">{s.label}</div>
          <div className="tabular mt-1 text-[13px]">{s.vcpu} vCPU</div>
          <div className="tabular text-xs text-muted-foreground">{s.memGb} GB RAM</div>
          <div className="tabular text-xs text-muted-foreground">{s.maxConn} conns</div>
        </label>
      ))}
    </RadioGroup>
  )
}

function ProvisionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { databases, setDatabases, setBranches } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [size, setSize] = useState('s')
  const [suspend, setSuspend] = useState('5')
  const [init, setInit] = useState('empty')
  const valid = /^[a-z][a-z0-9_-]{0,62}$/.test(name)
  const taken = databases.some((d) => d.name === name)

  const create = () => {
    const id = `db_${name}`
    setDatabases((d) => [...d, { id, name, pg: '17.8', state: 'provisioning', size, autosuspendMin: Number(suspend), storageMb: 32, connections: 0, created: '2026-10-09', lastActive: 'now', port: 54320 + d.length + 1 }])
    setBranches((b) => [...b, { id: `br_${Math.random().toString(16).slice(2, 10)}`, db: id, name: 'main', parent: null, state: 'running', isDefault: true, created: '2026-10-09 14:05', expires: null, point: 'Root', deltaMb: 32, lsn: '0/01000000', createdBy: 'you' }])
    toast.loading(`Provisioning ${name}…`, { id })
    setTimeout(() => {
      setDatabases((d) => d.map((x) => (x.id === id ? { ...x, state: 'running' } : x)))
      toast.success(`Database ${name} is ready`, { id, action: { label: 'Open', onClick: () => nav(`/databases/${name}/connect`) } })
    }, 2200)
    onOpenChange(false)
    setName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New database</DialogTitle>
          <DialogDescription>A PostgreSQL database with its own main branch. You can branch it, resize it and suspend it later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="db-name">Name</Label>
              <Input id="db-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="inventory" autoComplete="off" aria-invalid={!!name && (!valid || taken)} />
              <p className="text-xs text-muted-foreground">
                {taken ? <span className="text-destructive">A database with this name exists.</span> : 'Lowercase letters, digits, hyphens and underscores.'}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>PostgreSQL version <BackingTag id="DB-02b" /></Label>
              <Select defaultValue="17">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="17">PostgreSQL 17.8</SelectItem>
                  <SelectItem value="16" disabled>PostgreSQL 16 (not bundled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Compute size <BackingTag id="DB-02b" /></Label>
            <SizePicker value={size} onChange={setSize} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Suspend when idle <BackingTag id="DB-06c" /></Label>
              <Select value={suspend} onValueChange={setSuspend}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">After 5 minutes</SelectItem>
                  <SelectItem value="30">After 30 minutes</SelectItem>
                  <SelectItem value="60">After 1 hour</SelectItem>
                  <SelectItem value="0">Never (always on)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">A suspended database wakes on the next connection.</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Start with</Label>
              <Select value={init} onValueChange={setInit}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty">An empty database</SelectItem>
                  <SelectItem value="file">Import a file after creation</SelectItem>
                  <SelectItem value="backup">Restore from a backup bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || taken} onClick={create}>Create database</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Databases() {
  const { databases, setDatabases, branches, setDbId } = useStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const shown = databases.filter((d) => d.name.includes(q.toLowerCase()))
  const toggle = (id: string) =>
    setDatabases((ds) => ds.map((d) => (d.id === id ? { ...d, state: d.state === 'running' ? 'suspended' : 'running', connections: 0 } : d)))

  return (
    <>
      <PageHeader
        title="Databases"
        description="PostgreSQL databases in this project. Each has a main branch and any number of child branches."
        actions={<Button onClick={() => setOpen(true)}><Plus /> New database</Button>}
      />
      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Filter databases" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground">{shown.length} of {databases.length}</span>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Compute</TableHead>
              <TableHead className="text-right">Branches</TableHead>
              <TableHead className="text-right">Storage</TableHead>
              <TableHead className="text-right">Connections</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((d) => {
              const size = SIZES.find((s) => s.id === d.size)!
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link to={`/databases/${d.name}`} onClick={() => setDbId(d.id)} className="font-medium hover:text-primary hover:underline">{d.name}</Link>
                  </TableCell>
                  <TableCell><StatusBadge status={d.state} /></TableCell>
                  <TableCell className="text-muted-foreground">PostgreSQL {d.pg}</TableCell>
                  <TableCell><span className="tabular">{size.vcpu} vCPU, {size.memGb} GB</span></TableCell>
                  <TableCell className="tabular text-right">{branches.filter((b) => b.db === d.id).length}</TableCell>
                  <TableCell className="tabular text-right">{fmtMb(d.storageMb)}</TableCell>
                  <TableCell className="tabular text-right">{d.connections}</TableCell>
                  <TableCell className="text-muted-foreground">{d.lastActive}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon-sm" aria-label={`Connect to ${d.name}`} onClick={() => { setDbId(d.id); nav(`/databases/${d.name}/connect`) }}><Cable /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { toggle(d.id); toast.success(`${d.name} ${d.state === 'running' ? 'suspended' : 'resumed'}`) }}>
                            {d.state === 'running' ? <><Pause /> Suspend</> : <><Play /> Resume</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDbId(d.id); nav(`/databases/${d.name}/compute`) }}>Resize compute</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDbId(d.id); nav('/branches') }}>View branches</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => { setDbId(d.id); nav(`/databases/${d.name}/settings`) }}>Delete…</DropdownMenuItem>
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
      <ProvisionDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
