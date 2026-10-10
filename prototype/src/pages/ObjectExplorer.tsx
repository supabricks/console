import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Code2, Table2 } from 'lucide-react'
import { BackingTag, copy, Empty } from '@/components/common'
import { ObjectTree } from '@/components/object-tree'
import type { ObjRef } from '@/components/object-tree'
import { SqlCode } from '@/components/sql'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fmtKb, fmtN, OBJECTS, TABLES } from '@/lib/data'
import { useStore } from '@/lib/store'
import { ddlFor, TableStructure } from './TableEditor'

const KIND_LABEL: Record<string, string> = { table: 'Table', view: 'View', matview: 'Materialized view', function: 'Function', sequence: 'Sequence', type: 'Type' }

export default function ObjectExplorer() {
  const { db, branchName } = useStore()
  const nav = useNavigate()
  const [sel, setSel] = useState<ObjRef | null>({ kind: 'table', schema: 'public', name: 'orders' })
  const t = sel?.kind === 'table' ? TABLES.find((x) => x.schema === sel.schema && x.name === sel.name) : undefined
  const other = sel && sel.kind !== 'table'
    ? { view: OBJECTS.views, matview: OBJECTS.matviews, function: OBJECTS.functions, sequence: OBJECTS.sequences, type: OBJECTS.types }[sel.kind].find((o) => o.schema === sel.schema && o.name === sel.name)
    : undefined
  const refs = t ? TABLES.filter((x) => x.columns.some((c) => c.fk?.startsWith(`${t.name}.`))).map((x) => x.name) : []
  const usedBy = t ? [...OBJECTS.views, ...OBJECTS.matviews].filter((v) => v.def.includes(t.name)).map((v) => v.name) : []

  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0 shrink-0 overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar/50">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">{db.name}, <span className="font-mono">{branchName}</span></div>
        <ObjectTree className="flex-1" selected={sel} onSelect={setSel} showColumns />
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto">
        {!sel ? (
          <div className="p-6"><Empty title="Select an object">Browse schemas, tables, views, functions, sequences and types.</Empty></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{KIND_LABEL[sel.kind]} {sel.kind !== 'table' && <BackingTag id="OE-01b" />}</div>
                <h1 className="font-mono text-lg font-semibold">{sel.schema}.{sel.name}</h1>
                {t && <div className="text-xs text-muted-foreground">About {fmtN(t.rows)} rows, {fmtKb(t.sizeKb)}, owner app_owner{t.comment ? `, ${t.comment}` : ''}</div>}
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(`${sel.schema}.${sel.name}`, 'Name copied')}>Copy name</Button>
                {t && <Button variant="outline" size="sm" onClick={() => nav('/tables')}><Table2 /> Table editor</Button>}
                <Button size="sm" onClick={() => nav('/sql')}><Code2 /> Query</Button>
              </div>
            </div>
            {t ? (
              <Tabs defaultValue="structure" className="gap-0">
                <TabsList className="mx-4 mt-3"><TabsTrigger value="structure">Structure</TabsTrigger><TabsTrigger value="deps">Dependencies</TabsTrigger><TabsTrigger value="privs">Privileges</TabsTrigger><TabsTrigger value="ddl">Definition</TabsTrigger></TabsList>
                <TabsContent value="structure"><TableStructure t={t} /></TabsContent>
                <TabsContent value="deps" className="grid gap-4 p-4 md:grid-cols-3">
                  {[['References', t.columns.filter((c) => c.fk).map((c) => `${c.name} → ${c.fk}`)], ['Referenced by', refs.map((r) => `${r}.${t.name.replace(/s$/, '')}_id`)], ['Used by views', usedBy]].map(([title, items]) => (
                    <div key={title as string} className="rounded-md border p-3">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">{title as string}</div>
                      {(items as string[]).length ? <ul className="space-y-1 font-mono text-[13px]">{(items as string[]).map((i) => <li key={i}>{i}</li>)}</ul> : <div className="text-[13px] text-muted-foreground">None</div>}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="privs" className="p-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Privileges</TableHead><TableHead>Granted by</TableHead></TableRow></TableHeader>
                      <TableBody>
                        <TableRow><TableCell className="font-mono text-[13px]">app_owner</TableCell><TableCell>All (owner)</TableCell><TableCell className="text-muted-foreground">Owner</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[13px]">app_rw</TableCell><TableCell>SELECT, INSERT, UPDATE, DELETE</TableCell><TableCell className="text-muted-foreground">pg_write_all_data</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono text-[13px]">app_readonly</TableCell><TableCell>SELECT</TableCell><TableCell className="text-muted-foreground">pg_read_all_data</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="ddl" className="p-4"><SqlCode sql={ddlFor(t)} /></TabsContent>
              </Tabs>
            ) : other ? (
              <div className="grid gap-3 p-4">
                <div className="text-xs font-medium text-muted-foreground">Definition</div>
                <SqlCode sql={sel.kind === 'view' ? `CREATE VIEW ${sel.schema}.${sel.name} AS\n${other.def}` : sel.kind === 'matview' ? `CREATE MATERIALIZED VIEW ${sel.schema}.${sel.name} AS\n${other.def}` : `${sel.schema}.${sel.name}\n${other.def}`} />
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
