import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Code2, Download, Filter, GitBranchPlus, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, Empty } from '@/components/common'
import { DataGrid } from '@/components/data-grid'
import type { Sort } from '@/components/data-grid'
import { ObjectTree } from '@/components/object-tree'
import type { ObjRef } from '@/components/object-tree'
import { SqlCode } from '@/components/sql'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fmtKb, fmtN, rowsFor, TABLES } from '@/lib/data'
import type { Row, TableDef } from '@/lib/data'
import { useStore } from '@/lib/store'

const TYPES = ['bigint', 'integer', 'text', 'boolean', 'numeric(12,2)', 'timestamptz', 'date', 'uuid', 'jsonb']
type NewCol = { name: string; type: string; nullable: boolean; pk: boolean; def: string }

export function ddlFor(t: TableDef) {
  const cols = t.columns.map((c) => `  ${c.name} ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.default ? ` DEFAULT ${c.default}` : ''}`)
  const cons = t.constraints.map((c) => `  CONSTRAINT ${c.name} ${c.def}`)
  return `CREATE TABLE ${t.schema}.${t.name} (\n${[...cols, ...cons].join(',\n')}\n);\n\n${t.indexes.filter((i) => !i.name.endsWith('_pkey') && !i.name.endsWith('_key')).map((i) => `CREATE INDEX ${i.name} ON ${t.schema}.${t.name} USING ${i.def};`).join('\n')}`
}

function CreateTable({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { branchName } = useStore()
  const [name, setName] = useState('')
  const [cols, setCols] = useState<NewCol[]>([
    { name: 'id', type: 'bigint', nullable: false, pk: true, def: 'generated always as identity' },
    { name: 'created_at', type: 'timestamptz', nullable: false, pk: false, def: 'now()' },
  ])
  const set = (i: number, p: Partial<NewCol>) => setCols((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)))
  const sql = `CREATE TABLE public.${name || 'new_table'} (\n${cols.map((c) => `  ${c.name || 'column'} ${c.type}${c.def.startsWith('generated') ? ` ${c.def.toUpperCase()}` : ''}${c.nullable ? '' : ' NOT NULL'}${c.def && !c.def.startsWith('generated') ? ` DEFAULT ${c.def}` : ''}${c.pk ? ' PRIMARY KEY' : ''}`).join(',\n')}\n);`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">New table <BackingTag id="TE-03" /></DialogTitle>
          <DialogDescription>Created on branch <span className="font-mono">{branchName}</span> in schema public.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid max-w-xs gap-1.5"><Label htmlFor="tbl-name">Table name</Label><Input id="tbl-name" className="font-mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="invoices" /></div>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Column</TableHead><TableHead>Type</TableHead><TableHead>Default</TableHead><TableHead className="text-center">Nullable</TableHead><TableHead className="text-center">Primary key</TableHead><TableHead className="w-8" /></TableRow></TableHeader>
              <TableBody>
                {cols.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell><Input className="h-7 font-mono text-[13px]" value={c.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Column name" /></TableCell>
                    <TableCell>
                      <Select value={c.type} onValueChange={(v) => set(i, { type: v })}>
                        <SelectTrigger size="sm" className="w-36 font-mono text-[13px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input className="h-7 font-mono text-[13px]" value={c.def} onChange={(e) => set(i, { def: e.target.value })} aria-label="Default" /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={c.nullable} onCheckedChange={(v) => set(i, { nullable: !!v })} aria-label="Nullable" /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={c.pk} onCheckedChange={(v) => set(i, { pk: !!v })} aria-label="Primary key" /></TableCell>
                    <TableCell><Button variant="ghost" size="icon-xs" aria-label="Remove column" onClick={() => setCols((cs) => cs.filter((_, j) => j !== i))}><X /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t p-2"><Button variant="ghost" size="sm" onClick={() => setCols((cs) => [...cs, { name: '', type: 'text', nullable: true, pk: false, def: '' }])}><Plus /> Add column</Button></div>
          </div>
          <div><div className="mb-1 text-xs font-medium text-muted-foreground">SQL that will run</div><SqlCode sql={sql} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!/^[a-z_][a-z0-9_]*$/.test(name) || cols.some((c) => !c.name)} onClick={() => { onOpenChange(false); toast.success(`Table public.${name} created on ${branchName} (simulated)`) }}>Create table</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DataTab({ t }: { t: TableDef }) {
  const { branch, branchName, setBranchName, db, setBranches } = useStore()
  const base = useMemo(() => rowsFor(t.name, 50), [t.name])
  const pk = t.columns.find((c) => c.pk)!.name
  const [edits, setEdits] = useState<Record<string, Row>>({})
  const [added, setAdded] = useState<Row[]>([])
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<Sort>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    let r = [...added, ...base].map((x) => ({ ...x, ...(edits[String(x[pk])] ?? {}) }))
    if (filter) r = r.filter((x) => Object.values(x).some((v) => String(v).toLowerCase().includes(filter.toLowerCase())))
    if (sort) r.sort((a, b) => { const x = a[sort.col], y = b[sort.col]; const c = x === null ? 1 : y === null ? -1 : x < y ? -1 : x > y ? 1 : 0; return sort.dir === 'asc' ? c : -c })
    return r
  }, [base, added, edits, filter, sort, pk])

  const dirty = new Set(Object.entries(edits).flatMap(([id, r]) => Object.keys(r).map((c) => `${id}:${c}`)))
  const pending = dirty.size + added.length + deleted.size
  const pages = Math.ceil(t.rows / 50)
  const discard = () => { setEdits({}); setAdded([]); setDeleted(new Set()); setSelected(new Set()) }
  const insert = () => {
    const blank: Row = Object.fromEntries(t.columns.map((c) => [c.name, c.pk ? `new-${added.length + 1}` : c.default ? `(${c.default})` : null]))
    setAdded((a) => [blank, ...a])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {branch.isDefault && (
        <div className="flex items-center gap-2 border-b bg-warning/10 px-3 py-1.5 text-[13px]">
          <ShieldAlert className="size-4 text-warning" />
          <span>You are editing the default branch <span className="font-mono">{branchName}</span>. Changes apply to live data when committed.</span>
          <Button variant="outline" size="xs" className="ml-auto" onClick={() => {
            const name = `edit-${t.name}`
            setBranches((b) => (b.some((x) => x.db === db.id && x.name === name) ? b : [...b, { id: `br_${Math.random().toString(16).slice(2, 10)}`, db: db.id, name, parent: branchName, state: 'running', isDefault: false, created: '2026-10-09 14:05', expires: '2026-10-16 14:05', point: `Head of ${branchName}`, deltaMb: 0, lsn: '0/4A3F2E18', createdBy: 'you' }]))
            setBranchName(name); toast.success(`Switched to new branch ${name}`)
          }}><GitBranchPlus /> Edit on a new branch instead</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative w-60"><Filter className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-7 pl-8 text-[13px]" placeholder="Filter rows" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
        <BackingTag id="TE-02b" />
        <Button variant="outline" size="sm" onClick={insert}><Plus /> Insert row</Button>
        <Button variant="outline" size="sm" disabled={!selected.size} onClick={() => { setDeleted((d) => new Set([...d, ...selected])); setSelected(new Set()) }}><Trash2 /> Delete {selected.size || ''}</Button>
        <BackingTag id="TE-02c" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => toast.success(`Exported ${rows.length} rows to ${t.name}.csv (simulated)`)}><Download /> Export CSV</Button>
        </div>
      </div>
      <DataGrid
        className="flex-1"
        columns={t.columns}
        rows={rows}
        rowKey={(r) => String(r[pk])}
        sort={sort} onSort={setSort}
        selected={selected} onSelect={setSelected}
        deleted={deleted} dirty={dirty}
        onEdit={(id, col, value) => setEdits((e) => ({ ...e, [id]: { ...e[id], [col]: value } }))}
      />
      <div className="flex items-center gap-3 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
        {pending > 0 ? (
          <>
            <span className="font-medium text-warning">{pending} pending change{pending > 1 ? 's' : ''}</span>
            <span>{dirty.size} edited, {added.length} inserted, {deleted.size} deleted</span>
            <Button size="xs" onClick={() => { toast.success(`Committed ${pending} change${pending > 1 ? 's' : ''} to ${branchName} in one transaction (simulated)`); discard() }}>Commit changes</Button>
            <Button size="xs" variant="ghost" onClick={discard}>Discard</Button>
          </>
        ) : (
          <span>Double-click a cell to edit. Nothing is written until you commit.</span>
        )}
        <div className="tabular ml-auto flex items-center gap-1">
          <span>Rows {(page - 1) * 50 + 1}–{Math.min(page * 50, t.rows)} of about {fmtN(t.rows)}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
          <span>Page {page} of {fmtN(pages)}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Next page" disabled={page === pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
        </div>
      </div>
    </div>
  )
}

export function TableStructure({ t }: { t: TableDef }) {
  return (
    <div className="grid gap-6 p-4">
      <div>
        <h3 className="mb-2 flex items-center gap-2 font-medium">Columns <span className="text-xs font-normal text-muted-foreground">{t.columns.length}</span></h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Nullable</TableHead><TableHead>Default</TableHead><TableHead>Key</TableHead></TableRow></TableHeader>
            <TableBody>
              {t.columns.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-mono text-[13px]">{c.name}</TableCell>
                  <TableCell className="font-mono text-[13px] text-muted-foreground">{c.type}</TableCell>
                  <TableCell>{c.nullable ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.default ?? 'none'}</TableCell>
                  <TableCell className="text-xs">{c.pk ? 'Primary key' : c.fk ? `References ${c.fk}` : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 font-medium">Indexes <BackingTag id="TE-04" /></h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Definition</TableHead><TableHead>Unique</TableHead><TableHead className="text-right">Size</TableHead></TableRow></TableHeader>
            <TableBody>{t.indexes.map((i) => <TableRow key={i.name}><TableCell className="font-mono text-[13px]">{i.name}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{i.def}</TableCell><TableCell>{i.unique ? 'Yes' : 'No'}</TableCell><TableCell className="tabular text-right">{fmtKb(i.sizeKb)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 font-medium">Constraints <BackingTag id="TE-04" /></h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Kind</TableHead><TableHead>Definition</TableHead></TableRow></TableHeader>
            <TableBody>{t.constraints.map((c) => <TableRow key={c.name}><TableCell className="font-mono text-[13px]">{c.name}</TableCell><TableCell>{c.kind}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{c.def}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export default function TableEditor() {
  const { branchName, db, pipelines } = useStore()
  const nav = useNavigate()
  const [sel, setSel] = useState<ObjRef>({ kind: 'table', schema: 'public', name: 'orders' })
  const [create, setCreate] = useState(false)
  const t = TABLES.find((x) => x.schema === sel.schema && x.name === sel.name)

  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0 shrink-0 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar/50">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Tables in {db.name}</span>
          <Button variant="ghost" size="icon-xs" aria-label="New table" onClick={() => setCreate(true)}><Plus /></Button>
        </div>
        <ObjectTree className="flex-1" kinds={['table']} selected={sel} onSelect={setSel} />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {t ? (
          <Tabs defaultValue="data" className="flex min-h-0 flex-1 flex-col gap-0" key={`${t.schema}.${t.name}.${branchName}`}>
            <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><h1 className="font-mono font-semibold">{t.schema}.{t.name}</h1><BackingTag id="TE-01" /></div>
                <div className="text-xs text-muted-foreground">About {fmtN(t.rows)} rows, {fmtKb(t.sizeKb)}, {t.columns.length} columns{t.comment ? `, ${t.comment}` : ''}</div>
              </div>
              {(() => {
                const pl = pipelines.find((x) => x.db === db.id && x.branch === branchName)
                const on = pl?.tables.includes(`${t.schema}.${t.name}`)
                return (
                  <button onClick={() => nav(pl ? `/sync/${pl.id}` : `/sync/new?branch=${encodeURIComponent(branchName)}`)} className="ml-auto flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                    <span className={on ? 'size-2 rounded-sm bg-olap' : 'size-2 rounded-sm border border-muted-foreground'} />
                    {on ? `In Delta, ${pl!.mode === 'continuous' && pl!.lagMs ? `${(pl!.lagMs / 1000).toFixed(1)} s behind` : `as of ${pl!.lastSuccess.toLowerCase()}`}` : pl ? 'Not in this branch\'s pipeline' : 'Not synced to analytics'}
                  </button>
                )
              })()}
              <TabsList><TabsTrigger value="data">Data</TabsTrigger><TabsTrigger value="structure">Structure</TabsTrigger><TabsTrigger value="ddl">Definition</TabsTrigger></TabsList>
              <Button variant="outline" size="sm" onClick={() => nav('/sql')}><Code2 /> Query</Button>
            </div>
            <TabsContent value="data" className="flex min-h-0 flex-1 flex-col"><DataTab t={t} /></TabsContent>
            <TabsContent value="structure" className="min-h-0 flex-1 overflow-y-auto">
              <TableStructure t={t} />
              <div className="px-4 pb-6"><Button variant="outline" size="sm" onClick={() => toast.message('Add column: generates ALTER TABLE … ADD COLUMN for review (simulated)')}><Plus /> Add column</Button> <BackingTag id="TE-03" /></div>
            </TabsContent>
            <TabsContent value="ddl" className="min-h-0 flex-1 overflow-y-auto p-4"><SqlCode sql={ddlFor(t)} /></TabsContent>
          </Tabs>
        ) : (
          <div className="p-6"><Empty title="Select a table">Choose a table on the left, or create a new one.</Empty></div>
        )}
      </section>
      <CreateTable open={create} onOpenChange={setCreate} />
    </div>
  )
}
