// Dummy notebooks and a tiny stand-in for a Python kernel. Nothing here executes real code.

export type Output =
  | { kind: 'text'; text: string; result?: boolean }
  | { kind: 'table'; columns: string[]; rows: (string | number)[][]; result?: boolean; note?: string }
  | { kind: 'chart'; title: string; ylabel: string; data: { label: string; value: number }[] }
  | { kind: 'error'; ename: string; evalue: string; traceback: string }

export type Cell = { id: string; type: 'code' | 'markdown'; source: string; outputs: Output[]; count: number | null; state?: 'queued' | 'running'; canned?: Output[]; seed?: string; ms?: number }
export type KernelState = 'stopped' | 'starting' | 'idle' | 'busy'
export type Notebook = { name: string; modified: string; cells: Cell[]; dirty: boolean; kernel: KernelState; version: number | null; session?: string; execCount: number; envStale?: boolean }

export type Package = { name: string; spec: string; prepared: string | null; running: string | null; runtime?: boolean }
export const PACKAGES: Package[] = [
  { name: 'pyspark', spec: 'bundled', prepared: '4.0.1', running: '4.0.1', runtime: true },
  { name: 'pysail', spec: 'bundled', prepared: '0.7.1', running: '0.7.1', runtime: true },
  { name: 'ipykernel', spec: 'bundled', prepared: '6.29.5', running: '6.29.5', runtime: true },
  { name: 'pandas', spec: '>=2.2', prepared: '2.2.3', running: '2.2.3' },
  { name: 'pyarrow', spec: '>=17', prepared: '17.0.0', running: '17.0.0' },
  { name: 'matplotlib', spec: '==3.9.2', prepared: '3.9.2', running: '3.9.2' },
  { name: 'numpy', spec: '>=2.0', prepared: '2.1.1', running: '2.1.1' },
]

const REGIONS: [string, number, number][] = [['north', 1267456.64, 48211], ['west', 1088650.13, 41980], ['south', 863031.4, 33402], ['east', 850873.04, 32117]]
const SHOW = `+------+-----------+------+
|region|    revenue|orders|
+------+-----------+------+
${REGIONS.map(([r, v, n]) => `|${r.padStart(6)}|${v.toFixed(2).padStart(11)}|${String(n).padStart(6)}|`).join('\n')}
+------+-----------+------+
`
const DF: Output = { kind: 'table', result: true, columns: ['region', 'revenue', 'orders', 'avg_order'], rows: REGIONS.map(([r, v, n]) => [r, v, n, Math.round((v / n) * 100) / 100]), note: '4 rows × 4 columns' }
const CHART: Output = { kind: 'chart', title: 'Revenue by region', ylabel: 'Revenue (USD millions)', data: REGIONS.map(([r, v]) => ({ label: r, value: v / 1e6 })) }

let n = 0
const id = () => `c${++n}`
const code = (source: string, canned: Output[], count: number | null, ms = 300): Cell => ({ id: id(), type: 'code', source, outputs: count === null ? [] : canned, count, canned, seed: source, ms })
const md = (source: string): Cell => ({ id: id(), type: 'markdown', source, outputs: [], count: null })

export const NOTEBOOKS: Notebook[] = [
  {
    name: 'revenue-exploration.ipynb', modified: '12 minutes ago', dirty: false, kernel: 'idle', version: 4169, session: 'ses_41c9aa07', execCount: 4,
    cells: [
      md('# Revenue by region\n\nA first look at where revenue comes from, using the **orders** and **customers** tables synced from PostgreSQL.\n\n- Source: `app / main`\n- The kernel reads one published version from start to finish, so re-running gives the same numbers.'),
      code('orders = spark.table("public.orders")\ncustomers = spark.table("public.customers")\n\nprint(f"{orders.count():,} orders, {customers.count():,} customers")', [{ kind: 'text', text: '184,302 orders, 12,480 customers\n' }], 1, 900),
      code('by_region = spark.sql("""\n    SELECT c.region,\n           sum(o.amount) AS revenue,\n           count(*)      AS orders\n    FROM public.orders o\n    JOIN public.customers c ON c.id = o.customer_id\n    WHERE o.status <> \'refunded\'\n    GROUP BY c.region\n    ORDER BY revenue DESC\n""")\nby_region.show()', [{ kind: 'text', text: SHOW }], 2, 1300),
      md('## As a DataFrame\n\nConvert to pandas for the average order value.'),
      code('df = by_region.toPandas()\ndf["avg_order"] = (df.revenue / df.orders).round(2)\ndf', [DF], 3, 500),
      code('import matplotlib.pyplot as plt\n\nax = df.plot.bar(x="region", y="revenue", legend=False)\nax.set_ylabel("Revenue (USD millions)")\nplt.show()', [CHART], 4, 700),
      code('', [], null),
    ],
  },
  {
    name: 'churn-features.ipynb', modified: 'Yesterday', dirty: false, kernel: 'stopped', version: null, execCount: 0,
    cells: [
      md('# Churn features\n\nBuild one row per customer with recency, frequency and spend.'),
      code('features = spark.sql("""\n    SELECT customer_id,\n           max(placed_at) AS last_order,\n           count(*)       AS orders,\n           sum(amount)    AS spend\n    FROM public.orders\n    GROUP BY customer_id\n""")\nfeatures.limit(5).toPandas()', [{ kind: 'table', result: true, columns: ['customer_id', 'last_order', 'orders', 'spend'], rows: [[1018, '2026-10-08 07:13:29', 14, 2104.18], [1035, '2026-10-07 14:26:58', 9, 1310.4], [1052, '2026-10-06 21:39:27', 22, 4980.02], [1009, '2026-10-05 04:52:56', 3, 281.5], [1026, '2026-10-04 11:05:25', 11, 1777.93]], note: '5 rows × 4 columns' }], null, 1100),
      code('import polars as pl\n\npl.from_pandas(features.toPandas()).describe()', [], null),
    ],
  },
  {
    name: 'getting-started.ipynb', modified: 'Sep 30', dirty: false, kernel: 'stopped', version: null, execCount: 0,
    cells: [
      md('# Getting started\n\nA `spark` session is ready in every notebook. It reads the tables that Sync publishes from PostgreSQL.\n\n## Try it\n\nRun the cell below with **Shift + Enter**.'),
      code('spark.sql("SHOW TABLES").show()', [{ kind: 'text', text: '+---------+-----------+-----------+\n|namespace|  tableName|isTemporary|\n+---------+-----------+-----------+\n|   public|  customers|      false|\n|   public|     orders|      false|\n|   public|order_items|      false|\n+---------+-----------+-----------+\n' }], null, 600),
    ],
  },
]

export const newCell = (type: Cell['type'] = 'code', source = ''): Cell => ({ id: `u${Date.now().toString(36)}${Math.round(Math.random() * 1e4)}`, type, source, outputs: [], count: null })

/** Stand-in for execution: canned outputs for seeded cells, pattern-matched ones for anything typed. */
export function evaluate(cell: Cell, installed: string[]): { outputs: Output[]; ms: number } {
  const src = cell.source
  if (!src.trim()) return { outputs: [], ms: 0 }
  const imports = [...src.matchAll(/^\s*(?:import|from)\s+([a-zA-Z_][\w]*)/gm)].map((m) => m[1])
  const std = ['os', 'sys', 'math', 'json', 're', 'datetime', 'time', 'random', 'collections', 'itertools', 'functools', 'pathlib']
  const missing = imports.find((m) => !std.includes(m) && !installed.includes(m))
  if (missing) {
    const line = src.split('\n').findIndex((l) => new RegExp(`^\\s*(import|from)\\s+${missing}\\b`).test(l)) + 1
    return { ms: 180, outputs: [{ kind: 'error', ename: 'ModuleNotFoundError', evalue: `No module named '${missing}'`, traceback: `---------------------------------------------------------------------------\nModuleNotFoundError                       Traceback (most recent call last)\nCell In[{n}], line ${line}\n----> ${line} ${src.split('\n')[line - 1].trim()}\n\nModuleNotFoundError: No module named '${missing}'` }] }
  }
  if (cell.canned?.length && src === cell.seed) return { outputs: cell.canned, ms: cell.ms ?? 300 }
  const out: Output[] = []
  const printed = [...src.matchAll(/print\(\s*f?(["'])(.*?)\1\s*\)/g)].map((m) => m[2])
  if (printed.length) out.push({ kind: 'text', text: printed.join('\n') + '\n' })
  const last = src.trim().split('\n').pop()!.trim()
  if (/\.show\(/.test(src)) out.push({ kind: 'text', text: SHOW })
  else if (/toPandas\(\)|\.head\(|^df\b/.test(last)) out.push(DF)
  else if (/^[\d\s+\-*/().%]+$/.test(last)) { try { out.push({ kind: 'text', result: true, text: String(Function(`"use strict";return (${last})`)()) }) } catch { /* not an expression */ } }
  else if (/^(["']).*\1$/.test(last)) out.push({ kind: 'text', result: true, text: last })
  return { outputs: out, ms: /spark\./.test(src) ? 900 : 220 }
}
