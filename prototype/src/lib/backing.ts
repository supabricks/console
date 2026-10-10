// Single source of truth for what the platform backend supports today.
// live: the console already does this. api: the platform supports it but the
// console has no UI. new: no platform support; needs a backend contract.
export type BackingStatus = 'live' | 'api' | 'new'

export type Backing = {
  id: string
  section: string
  title: string
  status: BackingStatus
  note: string
  /** Issue numbers on supabricks/platform. */
  issues?: number[]
}

export const BACKING: Backing[] = [
  { id: 'DB-01', section: 'Databases', title: 'Database list', status: 'live', note: 'Root databases are listed today as branches with no parent.' },
  { id: 'DB-02a', section: 'Databases', title: 'Provision database (name)', status: 'live', note: 'database create NAME.' },
  { id: 'DB-02b', section: 'Databases', title: 'Provision with compute size, auto-suspend and Postgres version', status: 'new', note: 'No compute sizing or auto-suspend setting exists; the version is fixed at PostgreSQL 17.', issues: [244, 245] },
  { id: 'DB-03', section: 'Database detail', title: 'Overview: storage used and connection count', status: 'new', note: 'State and default branch exist. Storage size and live connection counts are not reported.', issues: [246] },
  { id: 'DB-04a', section: 'Database detail', title: 'Connection URI', status: 'live', note: 'connect [BRANCH] --uri returns application credentials.' },
  { id: 'DB-04b', section: 'Database detail', title: 'psql, JDBC, .env and driver snippets', status: 'live', note: 'Console-side renderings of the same credentials; no backend change.' },
  { id: 'DB-04c', section: 'Database detail', title: 'Reset password', status: 'new', note: 'No credential rotation command for application roles.', issues: [250] },
  { id: 'DB-04d', section: 'Database detail', title: 'Pooled connections', status: 'new', note: 'There is a connection gateway (256 connections) but no pooling mode.', issues: [252] },
  { id: 'DB-05', section: 'Database detail', title: 'API keys', status: 'new', note: 'No key system. Local access is the launch session; governed access is OIDC sign-in.', issues: [249] },
  { id: 'DB-06a', section: 'Database detail', title: 'Suspend and resume compute', status: 'live', note: 'branch suspend / resume.' },
  { id: 'DB-06b', section: 'Database detail', title: 'Scale compute up or down', status: 'new', note: 'No compute size setting in the native product.', issues: [244] },
  { id: 'DB-06c', section: 'Database detail', title: 'Auto-suspend timeout', status: 'new', note: 'Computes wake on connection, but idle suspend is not user-configurable.', issues: [245] },
  { id: 'DB-07', section: 'Database detail', title: 'Observability: metrics, slow and active queries, locks', status: 'new', note: 'No metrics endpoint. Data would come from pg_stat views and the process supervisor.', issues: [247, 248] },
  { id: 'DB-08', section: 'Database detail', title: 'Roles and privileges', status: 'new', note: 'Possible through SQL today; no dedicated command or UI.', issues: [251] },
  { id: 'DB-09', section: 'Database detail', title: 'Extensions', status: 'new', note: 'The bundle preloads only the neon extension; no extension catalogue.', issues: [253] },
  { id: 'DB-10a', section: 'Database detail', title: 'Point-in-time restore to a new branch', status: 'api', note: 'branch create --at-time / --at-lsn exists; the console has no UI for it.' },
  { id: 'DB-10b', section: 'Database detail', title: 'Backup bundles', status: 'api', note: 'backup create / verify / restore are CLI-only and require stopping the cell.' },
  { id: 'DB-10c', section: 'Database detail', title: 'History retention window', status: 'new', note: 'Retention is not exposed or configurable.', issues: [254] },
  { id: 'DB-11a', section: 'Database detail', title: 'Rename and set default branch', status: 'api', note: 'branch rename and branch default exist; the console has no UI.' },
  { id: 'DB-11b', section: 'Database detail', title: 'Delete database', status: 'live', note: 'branch delete with typed confirmation.' },
  { id: 'BR-01', section: 'Branches', title: 'Branch list', status: 'live', note: 'Flat table today; the tree view is console-side.' },
  { id: 'BR-01b', section: 'Branches', title: 'Storage difference from parent', status: 'new', note: 'Per-branch storage size is not reported.', issues: [246] },
  { id: 'BR-02a', section: 'Branches', title: 'Create branch from current head', status: 'live', note: 'branch create NAME --from PARENT.' },
  { id: 'BR-02b', section: 'Branches', title: 'Create branch at a time or log position, with expiry', status: 'api', note: '--at-time, --at-lsn and branch ttl exist; the console has no UI.' },
  { id: 'BR-04a', section: 'Branches', title: 'Suspend, resume, delete', status: 'live', note: 'Available in the console today.' },
  { id: 'BR-04b', section: 'Branches', title: 'Rename, set default, set expiry', status: 'api', note: 'Supported by the platform; no console UI.' },
  { id: 'BR-05', section: 'Branches', title: 'Schema diff between branches', status: 'new', note: 'No diff command.', issues: [255] },
  { id: 'BR-06', section: 'Branches', title: 'Reset branch from parent', status: 'new', note: 'No reset operation; today you delete and recreate.', issues: [256] },
  { id: 'TE-01', section: 'Table editor', title: 'Table list with row estimates and sizes', status: 'new', note: 'The catalog command returns tables and columns only.', issues: [257] },
  { id: 'TE-02a', section: 'Table editor', title: 'Browse rows', status: 'live', note: 'Preview runs SELECT * LIMIT 200; results cap at 1,000 rows / 256 KiB.' },
  { id: 'TE-02b', section: 'Table editor', title: 'Paging, sorting and filtering beyond 1,000 rows', status: 'new', note: 'Needs a paged read contract; the SQL action returns one bounded result.', issues: [257] },
  { id: 'TE-02c', section: 'Table editor', title: 'Inline edit, insert and delete rows', status: 'new', note: 'Writes are possible as single SQL statements; a batched edit contract is missing.', issues: [258] },
  { id: 'TE-03', section: 'Table editor', title: 'Create and alter table', status: 'new', note: 'Possible as SQL with writes enabled; no DDL-generation contract.', issues: [259] },
  { id: 'TE-04', section: 'Table editor', title: 'Indexes, constraints, triggers, policies, DDL', status: 'new', note: 'Not returned by the catalog command.', issues: [260] },
  { id: 'SQ-01', section: 'SQL editor', title: 'Run a statement, cancel, tabs', status: 'live', note: 'One statement, 32 KiB, 8 tabs, read-only by default.' },
  { id: 'SQ-01b', section: 'SQL editor', title: 'Multiple statements and run selection', status: 'new', note: 'The SQL action accepts one statement.', issues: [261] },
  { id: 'SQ-03b', section: 'SQL editor', title: 'Query plan view', status: 'new', note: 'EXPLAIN can be run as SQL; no structured plan output.', issues: [261] },
  { id: 'SQ-04', section: 'SQL editor', title: 'Saved queries', status: 'live', note: 'Saved per project; flat list today.' },
  { id: 'SQ-05', section: 'SQL editor', title: 'Query history', status: 'new', note: 'Query IDs exist, but there is no history listing.', issues: [261] },
  { id: 'OE-01a', section: 'Object explorer', title: 'Tables and columns', status: 'live', note: 'catalog [--branch] returns tables and columns (up to 1,000 columns).' },
  { id: 'OE-01b', section: 'Object explorer', title: 'Views, functions, sequences, types, indexes', status: 'new', note: 'Not returned by the catalog command.', issues: [260] },
]

export const backing = (id: string) => BACKING.find((b) => b.id === id)

export const STATUS_LABEL: Record<BackingStatus, string> = {
  live: 'Backend ready',
  api: 'API only, no UI yet',
  new: 'Needs backend',
}
