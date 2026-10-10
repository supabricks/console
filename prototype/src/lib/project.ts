// Dummy project definition for sales-analytics, shaped like a format-2 supabricks.toml.

export type ResState = 'installed' | 'changed' | 'new' | 'retained'
export type Resource = {
  key: string
  group: 'database' | 'migration' | 'fixture' | 'query' | 'notebook' | 'environment' | 'dataset'
  kind: string
  engine: 'pg' | 'spark' | 'none'
  file?: string
  database?: string
  dependsOn: string[]
  state: ResState
  fields: [string, string][]
  bound?: string
  to?: string
  action: string
  actionDetail: string
  body?: string
}

const r = (x: Resource) => x
export const RESOURCES: Resource[] = [
  r({ key: 'database.app', group: 'database', kind: 'PostgreSQL database', engine: 'pg', dependsOn: [], state: 'installed', fields: [['kind', 'postgres_database'], ['lifecycle', 'retain']], bound: 'app, branch main (br_8f2a91c4)', to: '/databases/app', action: 'retain', actionDetail: 'Already bound to app' }),
  r({ key: 'database.billing', group: 'database', kind: 'PostgreSQL database', engine: 'pg', dependsOn: [], state: 'installed', fields: [['kind', 'postgres_database'], ['lifecycle', 'retain']], bound: 'billing, branch main (br_b1000001)', to: '/databases/billing', action: 'retain', actionDetail: 'Already bound to billing' }),
  r({ key: 'environment.notebook', group: 'environment', kind: 'Python environment', engine: 'none', file: 'notebooks/environment/pyproject.toml', dependsOn: [], state: 'installed', fields: [['pyproject', 'notebooks/environment/pyproject.toml'], ['lock', 'notebooks/environment/uv.lock'], ['bundles.linux-x86_64', 'dependencies/notebook-linux.zip']], to: '/notebooks/environment', action: 'prepare_offline', actionDetail: 'Prepared from the bundled wheels; no download' }),
  r({ key: 'dataset.billing', group: 'dataset', kind: 'Shared dataset', engine: 'spark', dependsOn: [], state: 'installed', fields: [['kind', 'catalog_dataset'], ['requirement', 'finance.billing.v1']], bound: 'finance.billing from project finance-ops, revision 12', to: '/catalog/shared', action: 'retain', actionDetail: 'Keeps revision 12. Revision 13 is available; updating is a separate review.' }),
  r({ key: 'migration.create_schema', group: 'migration', kind: 'Migration', engine: 'pg', file: 'migrations/001-create-schema.sql', database: 'database.app', dependsOn: ['database.app'], state: 'installed', fields: [['sequence', '1'], ['database', 'database.app']], action: 'transactional_migration', actionDetail: 'Already applied on Aug 14; receipt verified', body: 'CREATE TABLE customers (\n  id bigint PRIMARY KEY,\n  email text NOT NULL UNIQUE,\n  full_name text NOT NULL,\n  region text NOT NULL,\n  tier text NOT NULL DEFAULT \'free\'\n);' }),
  r({ key: 'migration.add_indexes', group: 'migration', kind: 'Migration', engine: 'pg', file: 'migrations/002-add-indexes.sql', database: 'database.app', dependsOn: ['migration.create_schema'], state: 'installed', fields: [['sequence', '2'], ['database', 'database.app']], action: 'transactional_migration', actionDetail: 'Already applied on Sep 2; receipt verified', body: 'CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);' }),
  r({ key: 'migration.add_loyalty_points', group: 'migration', kind: 'Migration', engine: 'pg', file: 'migrations/003-add-loyalty-points.sql', database: 'database.app', dependsOn: ['migration.add_indexes'], state: 'new', fields: [['sequence', '3'], ['database', 'database.app']], action: 'transactional_migration', actionDetail: 'Runs one statement on app in its own transaction', body: 'ALTER TABLE customers\n  ADD COLUMN loyalty_points integer NOT NULL DEFAULT 0;' }),
  r({ key: 'fixture.regions', group: 'fixture', kind: 'Fixture', engine: 'pg', file: 'fixtures/regions.csv', database: 'database.app', dependsOn: ['migration.create_schema'], state: 'installed', fields: [['table', 'public.regions'], ['format', 'csv, header row'], ['columns', 'code text, name text, manager text']], action: 'load_new_table', actionDetail: 'Already loaded: 4 rows in public.regions' }),
  r({ key: 'query.revenue_by_region', group: 'query', kind: 'Saved query', engine: 'pg', file: 'queries/revenue_by_region.sql', database: 'database.app', dependsOn: ['database.app'], state: 'installed', fields: [['engine', 'postgres'], ['database', 'database.app']], to: '/sql', action: 'install', actionDetail: 'Installed as part of the new revision', body: 'SELECT c.region,\n       sum(o.amount) AS revenue\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status <> \'refunded\'\nGROUP BY c.region\nORDER BY revenue DESC;' }),
  r({ key: 'query.daily_orders', group: 'query', kind: 'Saved query', engine: 'spark', file: 'queries/daily_orders.sql', database: 'database.app', dependsOn: ['database.app'], state: 'installed', fields: [['engine', 'spark'], ['database', 'database.app']], to: '/analytics/sql', action: 'install', actionDetail: 'Installed as part of the new revision', body: "SELECT date_trunc('day', placed_at) AS day,\n       count(*) AS orders\nFROM public.orders\nGROUP BY 1\nORDER BY 1;" }),
  r({ key: 'query.overdue_invoices', group: 'query', kind: 'Saved query', engine: 'pg', file: 'queries/overdue_invoices.sql', database: 'database.billing', dependsOn: ['database.billing'], state: 'installed', fields: [['engine', 'postgres'], ['database', 'database.billing']], to: '/sql', action: 'install', actionDetail: 'Installed as part of the new revision', body: "SELECT id, customer_id, total\nFROM invoices\nWHERE status = 'open' AND due_on < current_date;" }),
  r({ key: 'notebook.revenue_exploration', group: 'notebook', kind: 'Notebook', engine: 'spark', file: 'notebooks/revenue-exploration.ipynb', database: 'database.app', dependsOn: ['query.revenue_by_region', 'environment.notebook'], state: 'installed', fields: [['environment', 'notebook'], ['database', 'database.app']], to: '/notebooks/revenue-exploration.ipynb', action: 'install', actionDetail: 'Installed without outputs; no cell is run' }),
  r({ key: 'notebook.churn_features', group: 'notebook', kind: 'Notebook', engine: 'spark', file: 'notebooks/churn-features.ipynb', database: 'database.app', dependsOn: ['environment.notebook', 'dataset.billing'], state: 'changed', fields: [['environment', 'notebook'], ['database', 'database.app']], to: '/notebooks/churn-features.ipynb', action: 'install', actionDetail: 'Replaces the installed copy; no cell is run' }),
  r({ key: 'query.find_customer', group: 'query', kind: 'Saved query', engine: 'pg', file: 'queries/find_customer.sql', database: 'database.app', dependsOn: ['database.app'], state: 'retained', fields: [['engine', 'postgres'], ['database', 'database.app']], action: 'retained', actionDetail: 'No longer declared. The installed copy is kept, not deleted.' }),
]

export const FILES: { path: string; bytes: number; by: string; changed?: 'new' | 'changed' }[] = [
  { path: 'supabricks.toml', bytes: 2140, by: 'always' },
  { path: 'resources/databases.toml', bytes: 212, by: 'include' },
  { path: 'migrations/001-create-schema.sql', bytes: 1480, by: 'migrations/*.sql' },
  { path: 'migrations/002-add-indexes.sql', bytes: 310, by: 'migrations/*.sql' },
  { path: 'migrations/003-add-loyalty-points.sql', bytes: 86, by: 'migrations/*.sql', changed: 'new' },
  { path: 'fixtures/regions.csv', bytes: 148, by: 'fixtures/regions.csv' },
  { path: 'queries/revenue_by_region.sql', bytes: 204, by: 'queries/*.sql' },
  { path: 'queries/daily_orders.sql', bytes: 122, by: 'queries/*.sql' },
  { path: 'queries/overdue_invoices.sql', bytes: 98, by: 'queries/*.sql' },
  { path: 'notebooks/revenue-exploration.ipynb', bytes: 6120, by: 'notebooks/**/*.ipynb' },
  { path: 'notebooks/churn-features.ipynb', bytes: 3980, by: 'notebooks/**/*.ipynb', changed: 'changed' },
  { path: 'notebooks/environment/pyproject.toml', bytes: 410, by: 'exact path' },
  { path: 'notebooks/environment/uv.lock', bytes: 48200, by: 'exact path' },
  { path: 'dependencies/notebook-linux.zip', bytes: 61_340_000, by: 'dependencies/*.zip' },
]
export const NOT_PACKAGED = [
  ['notebooks/getting-started.ipynb', 'Not declared as a resource'],
  ['.env', 'Secrets and environment files never travel'],
  ['.venv/', 'Virtual environments are rebuilt at the destination'],
  ['scratch/notes.md', 'Not matched by any include pattern'],
]
export const EXCLUSIONS = [
  'Files you have not declared are not read or packaged.',
  'Private state, .env files, keys, connection profiles, caches and virtual environments are refused.',
  'Notebook outputs, execution counts and widget state are removed from the packaged copy.',
  'Queries saved in the console stay private until you export them into the project folder.',
  'Database rows are not included. Move table data separately as a data file.',
]
export const RUNTIME_ONLY = [
  ['Database scratch', 'Created in the console. Not declared, so it does not travel.', '/databases/scratch'],
  ['5 branches of app', 'Branches are working copies, not part of the definition.', '/branches'],
  ['4 sync pipelines', 'Sync is configured per installation today.', '/sync'],
  ['Notebook getting-started.ipynb', 'A file in the folder that no resource declares.', '/notebooks/getting-started.ipynb'],
]
export const TOML = `format_version = 2
id = "ce954a1b-4bd2-40be-bc2b-ad9cb081d67c"
name = "sales-analytics"
include = ["resources/databases.toml"]

[package]
version = "0.4.0"
include = ["queries/*.sql", "notebooks/**/*.ipynb", "notebooks/environment/pyproject.toml", "notebooks/environment/uv.lock", "fixtures/regions.csv", "migrations/*.sql", "dependencies/*.zip"]
notebook_outputs = "strip"

[requires]
capabilities = ["postgres17", "spark-sql", "managed-notebooks", "catalog-datasets-v1"]

[targets.local]
mode = "development"
default = true

[targets.staging]
mode = "production"

[environments.notebook]
pyproject = "notebooks/environment/pyproject.toml"
lock = "notebooks/environment/uv.lock"

[environments.notebook.bundles]
linux-x86_64 = "dependencies/notebook-linux.zip"

[resources.migration.create_schema]
kind = "migration"
file = "migrations/001-create-schema.sql"
database = "database.app"
sequence = 1

[resources.migration.add_indexes]
kind = "migration"
file = "migrations/002-add-indexes.sql"
database = "database.app"
sequence = 2

[resources.migration.add_loyalty_points]
kind = "migration"
file = "migrations/003-add-loyalty-points.sql"
database = "database.app"
sequence = 3

[resources.fixture.regions]
kind = "fixture"
file = "fixtures/regions.csv"
database = "database.app"
schema = "public"
table = "regions"
depends_on = ["migration.create_schema"]

[resources.query.revenue_by_region]
kind = "sql"
engine = "postgres"
file = "queries/revenue_by_region.sql"
database = "database.app"

[resources.query.daily_orders]
kind = "sql"
engine = "spark"
file = "queries/daily_orders.sql"
database = "database.app"

[resources.query.overdue_invoices]
kind = "sql"
engine = "postgres"
file = "queries/overdue_invoices.sql"
database = "database.billing"

[resources.notebook.revenue_exploration]
kind = "notebook"
file = "notebooks/revenue-exploration.ipynb"
environment = "notebook"
database = "database.app"
depends_on = ["query.revenue_by_region"]

[resources.notebook.churn_features]
kind = "notebook"
file = "notebooks/churn-features.ipynb"
environment = "notebook"
database = "database.app"
depends_on = ["dataset.billing"]

[resources.dataset.billing]
kind = "catalog_dataset"
requirement = "finance.billing.v1"

# resources/databases.toml
[resources.database.app]
kind = "postgres_database"
lifecycle = "retain"

[resources.database.billing]
kind = "postgres_database"
lifecycle = "retain"
`
export const APPLIES = [
  { revision: 3, version: '0.3.0', when: 'Oct 8, 16:02', state: 'succeeded', steps: 13, key: 'apply-2026-10-08', note: 'Added dataset.billing and notebook.churn_features' },
  { revision: 2, version: '0.2.0', when: 'Sep 2, 10:40', state: 'succeeded', steps: 10, key: 'apply-2026-09-02', note: 'Added migration.add_indexes and query.daily_orders' },
  { revision: 0, version: '0.2.0', when: 'Sep 2, 10:31', state: 'failed', steps: 4, key: 'apply-2026-09-02-a', note: 'Stopped at migration.add_indexes: relation "orders" does not exist. Earlier steps were kept.' },
  { revision: 1, version: '0.1.0', when: 'Aug 14, 09:20', state: 'succeeded', steps: 6, key: 'apply-2026-08-14', note: 'First install' },
]
export const CHECKPOINTS = ['Store the reviewed source', 'Prepare environments offline', 'Create or keep databases', 'Run migrations, load fixtures, install queries and notebooks', 'Activate the new revision']

/** Dependencies-first layers for the resource graph. */
export function layers(rs: Resource[]): Resource[][] {
  const depth = new Map<string, number>()
  const of = (k: string): number => {
    if (depth.has(k)) return depth.get(k)!
    const x = rs.find((y) => y.key === k)
    const d = x && x.dependsOn.length ? 1 + Math.max(...x.dependsOn.map(of)) : 0
    depth.set(k, d); return d
  }
  const out: Resource[][] = []
  rs.forEach((x) => { const d = of(x.key); (out[d] ??= []).push(x) })
  return out
}
export const fmtSize = (b: number) => (b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MiB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KiB` : `${b} B`)
