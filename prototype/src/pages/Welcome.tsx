import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Check, Code2, Database, GitBranch, Loader2, Package, RefreshCw, Sparkles, Upload, Users } from 'lucide-react'
import { toast } from 'sonner'
import { BackingTag, CodeBlock, CopyField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Step = { id: string; title: string; why: string; icon: typeof Database; tone?: string; auto: string; done: string; to: string; open: string }
const STEPS: Step[] = [
  { id: 'data', title: 'Put some data in', why: 'Your database is empty. Bring a file, connect your application, or start from sample tables.', icon: Database, tone: 'text-oltp', auto: '', done: 'main has 3 tables: customers, orders and order_items', to: '/tables', open: 'Open the table editor' },
  { id: 'branch', title: 'Try a change on a branch', why: 'A branch is a full copy of the database that takes seconds to make and costs only what you change. Break things there, not in main.', icon: GitBranch, tone: 'text-oltp', auto: 'Create a branch called dev', done: 'Branch dev was made from main', to: '/branches', open: 'Open branches' },
  { id: 'sync', title: 'Publish your tables for analysis', why: 'Sync keeps a columnar copy of your tables current, so heavy questions never slow the application down. No connectors or queues to run.', icon: RefreshCw, auto: 'Turn on sync for main', done: 'Sync is on for main: 3 tables, a few seconds behind', to: '/sync', open: 'Open sync' },
  { id: 'ask', title: 'Ask a question across all of it', why: 'Query the published tables with Spark SQL, or open a notebook with a Spark session already connected.', icon: Sparkles, tone: 'text-olap', auto: 'Run a first query', done: 'Revenue by region returned 4 rows in 1.2 s', to: '/analytics/sql', open: 'Open Spark SQL' },
  { id: 'team', title: 'Bring in your team', why: 'Give a group a role in this project and decide which branches and tables they can use.', icon: Users, auto: 'Skip for now', done: 'Skipped. You can do this any time from Access.', to: '/access/roles', open: 'Open access' },
]

export default function Welcome() {
  const { name = 'new-project' } = useParams()
  const nav = useNavigate()
  const [done, setDone] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [pct, setPct] = useState(0)
  const current = STEPS.find((s) => !done.includes(s.id))
  const uri = `postgresql://app_owner:npg_T4kq9WzLm2Xc@analytics.internal.example:5432/main`

  useEffect(() => {
    if (!busy) return
    const t = setTimeout(() => { if (pct < 100) setPct(pct + 25); else { setDone((d) => [...d, busy]); setBusy(null); setPct(0) } }, 260)
    return () => clearTimeout(t)
  }, [busy, pct])
  const go = (id: string) => { setPct(0); setBusy(id) }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="pb-7">
        <div className="text-[13px] text-muted-foreground">New project</div>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight">{name} is ready</h1>
        <p className="mt-1.5 max-w-[68ch] text-muted-foreground">It has one empty PostgreSQL database called <span className="font-mono text-[13px] text-foreground">main</span>, running now. These five steps take about ten minutes and show everything the product does.</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="grid gap-3">
          {STEPS.map((s, i) => {
            const isDone = done.includes(s.id), here = current?.id === s.id, working = busy === s.id
            return (
              <li key={s.id} className={cn('rounded-lg border bg-card transition-colors', here && 'border-foreground/30 shadow-xs', !here && !isDone && 'opacity-60')}>
                <div className="flex items-start gap-3.5 p-4">
                  <span className={cn('tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium', isDone && 'border-success bg-success text-white', here && 'border-foreground')}>{isDone ? <Check className="size-3.5" /> : i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium"><s.icon className={cn('size-4', s.tone ?? 'text-muted-foreground')} />{s.title}</div>
                    {isDone ? <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-muted-foreground">{s.done}<Link to={s.to} className="text-primary hover:underline">{s.open}</Link></div> : <p className="mt-1 max-w-[62ch] text-[13px] text-muted-foreground">{s.why}</p>}

                    {here && s.id === 'data' && !working && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {([[Upload, 'Import a file', 'CSV, JSON or Parquet becomes a table.', () => nav('/import/new')], [Package, 'Load sample tables', 'Customers, orders and order items, about 100,000 rows.', () => go('data')], [Code2, 'Write SQL', 'Create tables yourself in the SQL editor.', () => nav('/sql')], [Database, 'Connect your application', 'Use the connection string on the right.', () => toast.message('Copy the connection string from the panel on the right.')]] as const).map(([Icon, t, d, fn]) => (
                          <button key={t} onClick={fn} className="rounded-md border p-3 text-left hover:bg-muted/50"><div className="flex items-center gap-2 text-[13px] font-medium"><Icon className="size-3.5 text-muted-foreground" />{t}{t === 'Load sample tables' && <BackingTag id="FR-02" compact />}</div><div className="mt-0.5 text-xs text-muted-foreground">{d}</div></button>
                        ))}
                      </div>
                    )}
                    {here && s.id !== 'data' && !working && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => go(s.id)}>{s.auto}</Button>{s.id !== 'team' && <Button size="sm" variant="ghost" asChild><Link to={s.to}>Do it myself</Link></Button>}{s.id === 'team' && <Button size="sm" variant="ghost" asChild><Link to={s.to}>Set up access</Link></Button>}</div>}
                    {working && <div className="mt-3 flex items-center gap-3 text-[13px] text-info"><Loader2 className="size-3.5 animate-spin" /><div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted"><div className="h-full bg-info transition-[width]" style={{ width: `${pct}%` }} /></div></div>}
                  </div>
                </div>
              </li>
            )
          })}
          {!current && (
            <li className="rounded-lg border border-success/40 bg-success/5 p-4">
              <div className="font-medium">That is the whole loop</div>
              <p className="mt-1 max-w-[62ch] text-[13px] text-muted-foreground">Rows written to PostgreSQL, a branch to change them safely, and the same data answering analytical questions a few seconds later.</p>
              <Button className="mt-3" onClick={() => nav('/overview')}>Go to the project</Button>
            </li>
          )}
        </ol>

        <aside className="sticky top-16 grid min-w-0 grid-cols-1 gap-5 text-[13px] [&>*]:min-w-0">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 font-semibold">What you have</div>
            <dl className="grid gap-2.5 [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&_dt]:text-muted-foreground">
              <div><dt className="flex items-center gap-2"><span className="size-2 rounded-sm bg-oltp" />Database main</dt><dd className="text-success">Running</dd></div>
              <div><dt>Tables</dt><dd className="tabular">{done.includes('data') ? 3 : 0}</dd></div>
              <div><dt>Branches</dt><dd className="tabular">{done.includes('branch') ? 2 : 1}</dd></div>
              <div><dt className="flex items-center gap-2"><span className="size-2 rounded-sm bg-olap" />Analytical tables</dt><dd className="tabular">{done.includes('sync') ? 3 : 0}</dd></div>
            </dl>
            <div className="mt-4 border-t pt-4"><CopyField label="Connection string" value={uri} secret="npg_T4kq9WzLm2Xc" /></div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2 font-medium"><BookOpen className="size-3.5 text-muted-foreground" />Or from a terminal</div>
            <CodeBlock code={'supabricks connect main --uri\nsupabricks branch create dev --from main\nsupabricks sync create main'} />
          </div>
          <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground" onClick={() => nav('/overview')}>Skip the tour</Button>
        </aside>
      </div>
    </div>
  )
}
