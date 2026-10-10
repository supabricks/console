import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, FileText, Loader2, Plus, RotateCcw, Table2, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, PageHeader, Stat, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtN, TABLES } from '@/lib/data'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const HEAD = 'bg-muted/50 hover:bg-muted/50'
const BOX = 'overflow-hidden rounded-lg border [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-3'
const TYPES = ['text', 'boolean', 'smallint', 'integer', 'bigint', 'decimal(12,2)', 'double precision', 'date', 'timestamp', 'timestamptz', 'jsonb']
const FORMATS: Record<string, string> = { csv: 'CSV', tsv: 'TSV', jsonl: 'JSON Lines', json: 'JSON array', parquet: 'Parquet' }
type Col = { source: string; name: string; type: string; nullable: boolean; note?: string }
type Sample = { file: string; format: string; mib: number; rows: number; cols: Col[]; preview: string[][] }
const c = (source: string, type: string, nullable = false, note?: string): Col => ({ source, name: source.toLowerCase().replace(/[^a-z0-9]+/g, '_'), type, nullable, note })
const SAMPLES: Sample[] = [
  { file: 'orders_2026_q3.csv', format: 'csv', mib: 18.4, rows: 412880, cols: [c('Order ID', 'bigint'), c('Customer Email', 'text'), c('Placed At', 'timestamptz'), c('Amount', 'decimal(12,2)', false, '3 of 1,000 sampled values are not numbers, for example “12,40”'), c('Currency', 'text'), c('Status', 'text'), c('Coupon', 'text', true)],
    preview: [['900412', 'ada@example.com', '2026-07-01T08:14:02Z', '129.00', 'EUR', 'paid', ''], ['900413', 'lin@example.com', '2026-07-01T08:15:47Z', '18.50', 'USD', 'paid', 'SUMMER10'], ['900414', 'sam@example.com', '2026-07-01T08:19:30Z', '12,40', 'EUR', 'refunded', ''], ['900415', 'noor@example.com', '2026-07-01T08:22:11Z', '310.00', 'GBP', 'shipped', ''], ['900416', 'ivo@example.com', '2026-07-01T08:25:59Z', '64.90', 'EUR', 'pending', 'WELCOME']] },
  { file: 'events.jsonl', format: 'jsonl', mib: 42.1, rows: 1204500, cols: [c('id', 'bigint'), c('user_id', 'bigint'), c('type', 'text'), c('occurred_at', 'timestamptz'), c('properties', 'jsonb', true, 'Nested values are kept as JSON, not split into columns')],
    preview: [['71002211', '5521', 'page_view', '2026-10-09T23:58:01Z', '{"path":"/pricing"}'], ['71002212', '5521', 'click', '2026-10-09T23:58:09Z', '{"target":"start-trial"}'], ['71002213', '8840', 'signup', '2026-10-09T23:58:40Z', '{"plan":"pro","seats":4}'], ['71002214', '112', 'page_view', '2026-10-09T23:59:12Z', '{"path":"/docs"}']] },
  { file: 'stores.parquet', format: 'parquet', mib: 1.2, rows: 2140, cols: [c('store_id', 'integer'), c('name', 'text'), c('opened_on', 'date'), c('lat', 'double precision'), c('lon', 'double precision'), c('active', 'boolean')],
    preview: [['101', 'Lisbon Baixa', '2019-03-14', '38.7104', '-9.1370', 'true'], ['102', 'Porto Ribeira', '2020-06-02', '41.1406', '-8.6110', 'true'], ['103', 'Madrid Sol', '2021-11-20', '40.4169', '-3.7035', 'true'], ['104', 'Lyon Presqu’île', '2018-09-08', '45.7640', '4.8357', 'false']] },
]

type Job = { id: string; file: string; format: string; table: string; where: string; rows: number | null; mib: number; state: 'committed' | 'failed' | 'cancelled' | 'running'; when: string; by: string; error?: string }
const JOBS: Job[] = [
  { id: 'imp_41', file: 'customers_backfill.csv', format: 'csv', table: 'public.customers_backfill', where: 'app / staging', rows: 12480, mib: 2.1, state: 'committed', when: 'Oct 9, 16:40', by: 'Daniel Reyes' },
  { id: 'imp_40', file: 'loyalty_points.json', format: 'json', table: 'public.loyalty_points', where: 'app / feature/loyalty-points', rows: null, mib: 6.8, state: 'failed', when: 'Oct 9, 11:20', by: 'Daniel Reyes', error: 'Row 4,112: key "tier" is not in the approved columns. Nothing was written.' },
  { id: 'imp_39', file: 'regions.tsv', format: 'tsv', table: 'public.regions', where: 'app / main', rows: 42, mib: 0.01, state: 'committed', when: 'Oct 2, 09:05', by: 'Priya Raman' },
  { id: 'imp_38', file: 'ledger_2025.parquet', format: 'parquet', table: 'public.ledger_2025', where: 'billing / main', rows: null, mib: 88.2, state: 'cancelled', when: 'Sep 30, 17:12', by: 'Kenji Mori', error: 'Cancelled at 61%. Nothing was written.' },
]

export default function Imports() {
  const nav = useNavigate()
  const [jobs, setJobs] = useState(JOBS)
  return (
    <div>
      <PageHeader title="Import data" description="Load a file into a new PostgreSQL table. Once it is a table you can query it, branch it, and publish it for analysis like any other."
        actions={<Button onClick={() => nav('/import/new')}><Plus /> New import</Button>} />
      <div className="mb-7 grid grid-cols-2 gap-y-5 lg:grid-cols-4">
        <Stat label="Imports" value={jobs.length} sub={`${jobs.filter((j) => j.state === 'committed').length} loaded`} />
        <Stat label="Rows loaded" value={fmtN(jobs.reduce((s, j) => s + (j.rows ?? 0), 0))} />
        <Stat label="Largest file allowed" value="100 MiB" sub="CSV, TSV, JSON, JSON Lines, Parquet" />
        <Stat label="Upload space in use" value="0 of 512 MiB" sub="Files are removed after loading" />
      </div>
      <div className={BOX}>
        <Table>
          <TableHeader><TableRow className={HEAD}><TableHead>File</TableHead><TableHead>Into table</TableHead><TableHead>On</TableHead><TableHead className="text-right">Rows</TableHead><TableHead>Result</TableHead><TableHead>When</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id} className="h-14">
                <TableCell><div className="flex items-center gap-2 font-medium"><FileText className="size-3.5 text-muted-foreground" />{j.file}</div><div className="pl-5.5 text-xs text-muted-foreground">{FORMATS[j.format]}, {j.mib} MiB</div></TableCell>
                <TableCell className="font-mono text-[13px]">{j.table}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{j.where}</TableCell>
                <TableCell className="tabular text-right">{j.rows === null ? '' : fmtN(j.rows)}</TableCell>
                <TableCell><StatusBadge status={j.state === 'committed' ? 'succeeded' : j.state} />{j.error && <div className="max-w-80 truncate text-xs text-muted-foreground" title={j.error}>{j.error}</div>}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground"><span className="tabular block">{j.when}</span>{j.by}</TableCell>
                <TableCell className="text-right">
                  {j.state === 'committed' ? <Button variant="ghost" size="sm" asChild><Link to="/tables"><Table2 /> Open table</Link></Button>
                    : <Button variant="ghost" size="sm" onClick={() => { setJobs((js) => js.map((x) => (x.id === j.id ? { ...x, state: 'committed', rows: 88120, error: undefined, when: 'Oct 10, 14:05', by: 'Maya Okafor' } : x))); toast.success(`${j.file} loaded into ${j.table}`) }}><RotateCcw /> Try again</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 max-w-[90ch] text-xs text-muted-foreground">A load either writes every row or none. If it fails or is cancelled, the table is not created.</p>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {([['IM-03', 'Add to an existing table', 'An import always makes a new table. To add rows to one you have, import beside it and copy across with SQL.'], ['IM-04', 'Import from a link or a bucket', 'Files are uploaded from your computer. Reading from a web address or object storage is not available.'], ['IM-05', 'Import straight into analytical tables', 'Every import becomes a PostgreSQL table first. Large files that only analysis needs still pass through PostgreSQL and sync.']] as const).map(([id, t, d]) => (
          <div key={id} className="rounded-lg border border-dashed p-4 text-[13px]"><div className="flex items-center gap-2 font-medium">{t} <BackingTag id={id} /></div><p className="mt-1 text-muted-foreground">{d}</p></div>
        ))}
      </div>
    </div>
  )
}

const STEPS = ['Choose a file', 'Check how it reads', 'Name the table and columns', 'Load']
type Phase = 'idle' | 'uploading' | 'checking' | 'copying' | 'done' | 'failed'

export function ImportNew() {
  const { databases, branches, db, branchName } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [s, setS] = useState<Sample | null>(null)
  const [over, setOver] = useState(false)
  const [tooBig, setTooBig] = useState<string | null>(null)
  const [format, setFormat] = useState('csv')
  const [header, setHeader] = useState(true)
  const [delim, setDelim] = useState(',')
  const [nulls, setNulls] = useState('')
  const [dbId, setDbId] = useState(db.id)
  const [branch, setBranch] = useState(branchName)
  const [table, setTable] = useState('')
  const [cols, setCols] = useState<(Col & { on: boolean })[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [pct, setPct] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const dbBranches = branches.filter((b) => b.db === dbId)
  const dbName = databases.find((d) => d.id === dbId)?.name
  const exists = TABLES.some((t) => t.name === table)
  const tableOk = /^[a-z_][a-z0-9_]{0,62}$/.test(table) && !exists
  const used = cols.filter((x) => x.on)
  const dupes = used.filter((x, i) => used.findIndex((y) => y.name === x.name) !== i).map((x) => x.name)
  const colsOk = used.length > 0 && !dupes.length && used.every((x) => /^[a-z_][a-z0-9_]{0,62}$/.test(x.name))
  const risky = used.find((x) => x.note && x.source === 'Amount' && x.type !== 'text')

  const pick = (sample: Sample, name?: string, mib?: number) => {
    const chosen = { ...sample, file: name ?? sample.file, mib: mib ?? sample.mib }
    setS(chosen); setFormat(sample.format); setTable((name ?? sample.file).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_')); setCols(sample.cols.map((x) => ({ ...x, on: true }))); setTooBig(null); setStep(1)
  }
  const onFile = (f?: File) => {
    if (!f) return
    const mib = f.size / (1 << 20), ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (mib > 100) { setTooBig(`${f.name} is ${mib.toFixed(0)} MiB. The largest file that can be imported is 100 MiB.`); return }
    pick(SAMPLES.find((x) => x.format === (ext === 'ndjson' ? 'jsonl' : ext)) ?? SAMPLES[0], f.name, +mib.toFixed(2))
  }

  // The load moves through upload, checks and copy on its own.
  useEffect(() => {
    if (phase !== 'uploading' && phase !== 'checking' && phase !== 'copying') return
    const t = setTimeout(() => {
      if (pct < 100) setPct(Math.min(100, pct + (phase === 'checking' ? 34 : 9)))
      else if (phase === 'copying') setPhase(risky ? 'failed' : 'done')
      else { setPhase(phase === 'uploading' ? 'checking' : 'copying'); setPct(0) }
    }, 220)
    return () => clearTimeout(t)
  }, [phase, pct, risky])

  const busy = phase === 'uploading' || phase === 'checking' || phase === 'copying'
  const canNext = step === 0 ? !!s : step === 1 ? true : tableOk && colsOk

  return (
    <div>
      <PageHeader title="New import" description="The file is read on the server. Nothing is written to the database until the last step, and then it is all or nothing." />
      <ol className="mb-7 flex flex-wrap items-center gap-2 text-[13px]">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button disabled={i > step || busy || phase === 'done'} onClick={() => setStep(i)} className={cn('flex items-center gap-2 rounded-md py-1 pr-2 pl-1', i === step ? 'font-semibold' : i < step ? 'hover:bg-muted' : 'text-muted-foreground')}>
              <span className={cn('tabular flex size-5.5 items-center justify-center rounded-full border text-xs', i < step && 'border-primary bg-primary text-primary-foreground', i === step && 'border-primary text-primary')}>{i < step ? <Check className="size-3" /> : i + 1}</span>{label}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="size-3.5 text-border" />}
          </li>
        ))}
      </ol>

      <div className="min-h-96">
        {step === 0 && (
          <div className="grid max-w-3xl gap-6">
            <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]) }}
              className={cn('flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-14 text-center transition-colors', over ? 'border-primary bg-accent/50' : 'hover:bg-muted/40')}>
              <Upload className="size-6 text-muted-foreground" />
              <span className="font-medium">Drop a file here, or choose one</span>
              <span className="text-[13px] text-muted-foreground">CSV, TSV, JSON, JSON Lines or Parquet, up to 100 MiB</span>
              <input ref={input} type="file" accept=".csv,.tsv,.json,.jsonl,.ndjson,.parquet" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </button>
            {tooBig && <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-[13px]"><XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />{tooBig}</div>}
            <div>
              <div className="mb-2 text-[13px] text-muted-foreground">No file to hand? Try one of these.</div>
              <div className="grid gap-2 sm:grid-cols-3">{SAMPLES.map((x) => <button key={x.file} onClick={() => pick(x)} className="rounded-lg border bg-card p-3 text-left hover:bg-muted/40"><div className="flex items-center gap-2 text-[13px] font-medium"><FileText className="size-3.5 text-muted-foreground" />{x.file}</div><div className="tabular mt-1 text-xs text-muted-foreground">{FORMATS[x.format]}, {x.mib} MiB, {fmtN(x.rows)} rows</div></button>)}</div>
            </div>
          </div>
        )}

        {step === 1 && s && (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1.5"><Label htmlFor="im-fmt">Format</Label><Select value={format} onValueChange={setFormat}><SelectTrigger id="im-fmt" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FORMATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              {(format === 'csv' || format === 'tsv') && <>
                <div className="grid gap-1.5"><Label htmlFor="im-del">Values are separated by</Label><Select value={format === 'tsv' ? '\t' : delim} onValueChange={setDelim} disabled={format === 'tsv'}><SelectTrigger id="im-del" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value=",">Comma</SelectItem><SelectItem value=";">Semicolon</SelectItem><SelectItem value="|">Pipe</SelectItem><SelectItem value={'\t'}>Tab</SelectItem></SelectContent></Select></div>
                <div className="grid gap-1.5"><Label htmlFor="im-null">Treat as empty</Label><Input id="im-null" className="w-44 font-mono text-[13px]" value={nulls} onChange={(e) => setNulls(e.target.value)} placeholder="NULL, N/A" /></div>
                <label className="flex h-9 items-center gap-2 text-[13px]"><Switch checked={header} onCheckedChange={setHeader} />First row is column names</label>
              </>}
              <div className="ml-auto text-right text-[13px]"><div className="font-medium">{s.file}</div><div className="tabular text-muted-foreground">{s.mib} MiB, about {fmtN(s.rows)} rows</div></div>
            </div>
            <div className={cn(BOX, 'overflow-x-auto')}>
              <Table>
                <TableHeader><TableRow className={HEAD}><TableHead className="w-12 text-right text-xs font-normal text-muted-foreground">Row</TableHead>{s.cols.map((x, i) => <TableHead key={x.source} className="font-mono text-xs">{header || format !== 'csv' ? x.source : `column_${i + 1}`}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {!header && format === 'csv' && <TableRow className="h-9"><TableCell className="tabular text-right text-xs text-muted-foreground">1</TableCell>{s.cols.map((x) => <TableCell key={x.source} className="font-mono text-[12.5px]">{x.source}</TableCell>)}</TableRow>}
                  {s.preview.map((r, i) => <TableRow key={i} className="h-9"><TableCell className="tabular text-right text-xs text-muted-foreground">{i + (header || format !== 'csv' ? 1 : 2)}</TableCell>{r.map((v, j) => <TableCell key={j} className={cn('max-w-64 truncate font-mono text-[12.5px]', !v && 'text-muted-foreground')}>{v || 'empty'}</TableCell>)}</TableRow>)}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">The first rows as the server read them. If the columns look wrong, change the options above; the file does not need to be uploaded again.</p>
          </div>
        )}

        {step === 2 && s && (
          <div className="grid gap-6">
            <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5"><Label htmlFor="im-db">Database</Label><Select value={dbId} onValueChange={(v) => { setDbId(v); setBranch('main') }}><SelectTrigger id="im-db" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{databases.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label htmlFor="im-br">Branch</Label><Select value={branch} onValueChange={setBranch}><SelectTrigger id="im-br" className="w-full font-mono text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{dbBranches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label htmlFor="im-tbl">New table name</Label><div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/40"><span className="pl-3 font-mono text-[13px] text-muted-foreground">public.</span><input id="im-tbl" value={table} onChange={(e) => setTable(e.target.value)} className="h-9 w-full bg-transparent pr-3 font-mono text-[13px] outline-none" /></div></div>
            </div>
            {table && !tableOk && <p className="-mt-3 flex items-center gap-2 text-[13px] text-destructive">{exists ? <>A table called {table} already exists. An import makes a new table. <BackingTag id="IM-03" /></> : 'Use lowercase letters, digits and underscores, starting with a letter.'}</p>}
            {branch === 'main' && <p className="-mt-3 text-[13px] text-muted-foreground">You are importing into <span className="font-mono text-[12.5px]">main</span>. To try it first, <Link to="/branches" className="text-primary hover:underline">make a branch</Link> and import there.</p>}
            <div className={BOX}>
              <Table>
                <TableHeader><TableRow className={HEAD}><TableHead className="w-12">Use</TableHead><TableHead>In the file</TableHead><TableHead>Column name</TableHead><TableHead className="w-52">Type</TableHead><TableHead className="w-28">Can be empty</TableHead><TableHead>From the sample</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cols.map((x, i) => { const set = (p: Partial<Col & { on: boolean }>) => setCols((cs) => cs.map((y, j) => (j === i ? { ...y, ...p } : y))); const warn = x.note && x.source === 'Amount' && x.type !== 'text'; return (
                    <TableRow key={x.source} className={cn('h-12', !x.on && 'opacity-50')}>
                      <TableCell><Checkbox checked={x.on} onCheckedChange={(v) => set({ on: !!v })} aria-label={`Import ${x.source}`} /></TableCell>
                      <TableCell className="font-mono text-[13px] text-muted-foreground">{x.source}</TableCell>
                      <TableCell><Input value={x.name} disabled={!x.on} onChange={(e) => set({ name: e.target.value })} aria-label={`Name for ${x.source}`} className={cn('h-8 w-56 font-mono text-[13px]', x.on && dupes.includes(x.name) && 'border-destructive')} /></TableCell>
                      <TableCell><Select value={x.type} disabled={!x.on} onValueChange={(type) => set({ type })}><SelectTrigger size="sm" className="w-48 font-mono text-[13px]" aria-label={`Type for ${x.source}`}><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="font-mono text-[13px]">{t}</SelectItem>)}</SelectContent></Select></TableCell>
                      <TableCell><Switch checked={x.nullable} disabled={!x.on} onCheckedChange={(nullable) => set({ nullable })} aria-label={`${x.source} can be empty`} /></TableCell>
                      <TableCell className={cn('text-[13px] whitespace-normal', warn ? 'text-warning' : 'text-muted-foreground')}>{x.note ? <span className="flex items-start gap-1.5">{warn && <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}{warn || !x.note.includes('sampled') ? x.note : 'Kept as text, so every value fits'}</span> : 'Every sampled value fits'}</TableCell>
                    </TableRow>
                  ) })}
                </TableBody>
              </Table>
            </div>
            {dupes.length > 0 && <p className="-mt-3 text-[13px] text-destructive">Two columns are called {dupes[0]}. Column names must be different.</p>}
            <p className="-mt-2 max-w-[90ch] text-xs text-muted-foreground">Types were guessed from the first 1,000 rows. A later row that does not fit its column stops the load and nothing is written, so when in doubt choose text and convert with SQL afterwards.</p>
          </div>
        )}

        {step === 3 && s && (
          <div className="grid max-w-3xl gap-6">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3 text-[13px]"><span className="inline-flex items-center gap-2 font-medium"><FileText className="size-4 text-muted-foreground" />{s.file}</span><ChevronRight className="size-4 text-muted-foreground" /><span className="inline-flex items-center gap-2"><span className="size-2 rounded-sm bg-oltp" /><span className="font-mono font-medium">public.{table}</span><span className="text-muted-foreground">on {dbName} / <span className="font-mono text-[12.5px]">{branch}</span></span></span></div>
              <dl className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground"><div><dt>Rows</dt><dd className="tabular font-medium">about {fmtN(s.rows)}</dd></div><div><dt>Columns</dt><dd className="tabular font-medium">{used.length} of {cols.length}</dd></div><div><dt>Size</dt><dd className="tabular font-medium">{s.mib} MiB</dd></div></dl>
            </div>

            {phase === 'idle' && risky && <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/8 p-3 text-[13px]"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /><div><span className="font-medium">This load is likely to stop.</span> {risky.note} in <span className="font-mono text-[12.5px]">{risky.name}</span>, which is set to {risky.type}. <button className="text-primary hover:underline" onClick={() => setStep(2)}>Change it to text</button> or fix the file.</div></div>}

            {phase !== 'idle' && (
              <ol className="grid gap-0">
                {([['uploading', 'Send the file to the server', `${s.mib} MiB`], ['checking', 'Check it against the approved columns', 'Same bytes, same options as the preview'], ['copying', 'Copy rows into the new table', `about ${fmtN(s.rows)} rows`], ['done', 'Commit', 'All rows become visible at once']] as const).map(([id, label, sub], i) => {
                  const order = ['uploading', 'checking', 'copying', 'done'], at = phase === 'failed' ? 2 : order.indexOf(phase)
                  const done = i < at || phase === 'done', here = i === at && phase !== 'done', failed = here && phase === 'failed'
                  return (
                    <li key={id} className="flex gap-3">
                      <span className="flex flex-col items-center"><span className={cn('mt-0.5 flex size-5 items-center justify-center rounded-full border', done && 'border-success bg-success text-white', failed && 'border-destructive bg-destructive text-white', here && !failed && 'border-info text-info')}>{done ? <Check className="size-3" /> : failed ? <XCircle className="size-3" /> : here ? <Loader2 className="size-3 animate-spin" /> : null}</span>{i < 3 && <span className={cn('w-px flex-1', done ? 'bg-success/50' : 'bg-border')} />}</span>
                      <div className="min-w-0 flex-1 pb-5">
                        <div className={cn('text-[13px]', !done && !here && 'text-muted-foreground', (done || here) && 'font-medium')}>{label}</div>
                        <div className="text-xs text-muted-foreground">{failed ? '' : here && id !== 'done' ? `${id === 'copying' ? `${fmtN(Math.round((s.rows * pct) / 100))} of ${sub}` : sub}, ${pct}%` : sub}</div>
                        {here && !failed && id !== 'done' && <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-muted"><div className="h-full bg-info transition-[width]" style={{ width: `${pct}%` }} /></div>}
                        {failed && <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs leading-relaxed">Row 3: “12,40” is not a valid {risky?.type} for column {risky?.name}.<br />The load was stopped. No table was created and no rows were written.</div>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {phase === 'done' && (
              <div className="rounded-lg border border-success/40 bg-success/5 p-4">
                <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-success" />{fmtN(s.rows)} rows loaded into public.{table}</div>
                <p className="mt-1 text-[13px] text-muted-foreground">The row count was confirmed against a receipt written in the same transaction. The uploaded file has been removed from the server.</p>
                <div className="mt-3 flex flex-wrap gap-2"><Button asChild><Link to="/tables"><Table2 /> Open the table</Link></Button><Button variant="outline" asChild><Link to="/sql">Query it</Link></Button><Button variant="outline" asChild><Link to="/sync/new">Publish it for analysis</Link></Button><Button variant="ghost" onClick={() => { setStep(0); setS(null); setPhase('idle'); setPct(0) }}>Import another file</Button></div>
              </div>
            )}
          </div>
        )}
      </div>

      {phase !== 'done' && (
        <div className="mt-6 flex items-center gap-2 border-t pt-4">
          <Button variant="ghost" disabled={busy} onClick={() => (step === 0 ? nav('/import') : (setStep(step - 1), setPhase('idle'), setPct(0)))}>{step === 0 ? 'Cancel' : 'Back'}</Button>
          <div className="ml-auto flex gap-2">
            {step < 3 && <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>}
            {step === 3 && phase === 'idle' && <Button onClick={() => { setPct(0); setPhase('uploading') }}><Upload /> Load {s ? fmtN(s.rows) : ''} rows</Button>}
            {step === 3 && busy && <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setPhase('idle'); setPct(0); toast.message('Import cancelled. Nothing was written.') }}>Cancel import</Button>}
            {step === 3 && phase === 'failed' && <><Button variant="outline" onClick={() => { setCols((cs) => cs.map((x) => (x.source === 'Amount' ? { ...x, type: 'text' } : x))); setPhase('idle'); setPct(0); setStep(2) }}>Change the column to text</Button><Button onClick={() => { setPct(0); setPhase('uploading') }}><RotateCcw /> Try again</Button></>}
          </div>
        </div>
      )}
    </div>
  )
}
