// Dummy data for the clickthrough. Nothing here comes from a running installation.

export type ComputeSize = { id: string; label: string; vcpu: number; memGb: number; maxConn: number }
export const SIZES: ComputeSize[] = [
  { id: 'xs', label: 'Extra small', vcpu: 0.25, memGb: 1, maxConn: 64 },
  { id: 's', label: 'Small', vcpu: 0.5, memGb: 2, maxConn: 128 },
  { id: 'm', label: 'Medium', vcpu: 1, memGb: 4, maxConn: 256 },
  { id: 'l', label: 'Large', vcpu: 2, memGb: 8, maxConn: 512 },
  { id: 'xl', label: 'Extra large', vcpu: 4, memGb: 16, maxConn: 1024 },
]

export type Database = {
  id: string
  name: string
  pg: string
  state: 'running' | 'suspended' | 'provisioning'
  size: string
  autosuspendMin: number
  storageMb: number
  connections: number
  created: string
  lastActive: string
  port: number
}

export const DATABASES: Database[] = [
  { id: 'db_app', name: 'app', pg: '17.8', state: 'running', size: 's', autosuspendMin: 5, storageMb: 4310, connections: 7, created: '2026-08-14', lastActive: 'now', port: 54321 },
  { id: 'db_billing', name: 'billing', pg: '17.8', state: 'running', size: 'm', autosuspendMin: 0, storageMb: 18240, connections: 23, created: '2026-07-02', lastActive: 'now', port: 54322 },
  { id: 'db_scratch', name: 'scratch', pg: '17.8', state: 'suspended', size: 'xs', autosuspendMin: 5, storageMb: 212, connections: 0, created: '2026-09-30', lastActive: '3 days ago', port: 54323 },
]

export type Branch = {
  id: string
  db: string
  name: string
  parent: string | null
  state: 'running' | 'suspended'
  isDefault: boolean
  created: string
  expires: string | null
  point: string
  deltaMb: number
  lsn: string
  createdBy: string
}

export const BRANCHES: Branch[] = [
  { id: 'br_8f2a91c4', db: 'db_app', name: 'main', parent: null, state: 'running', isDefault: true, created: '2026-08-14 09:12', expires: null, point: 'Root', deltaMb: 4310, lsn: '0/4A3F2E18', createdBy: 'you' },
  { id: 'br_17c0d2aa', db: 'db_app', name: 'staging', parent: 'main', state: 'running', isDefault: false, created: '2026-09-21 14:40', expires: null, point: 'Head of main', deltaMb: 182, lsn: '0/4A11C0D8', createdBy: 'you' },
  { id: 'br_c93e0b71', db: 'db_app', name: 'feature/loyalty-points', parent: 'staging', state: 'running', isDefault: false, created: '2026-10-07 11:03', expires: '2026-10-14 11:03', point: 'Head of staging', deltaMb: 14, lsn: '0/4A2B77F0', createdBy: 'you' },
  { id: 'br_4d7781e0', db: 'db_app', name: 'pr-482', parent: 'main', state: 'suspended', isDefault: false, created: '2026-10-08 16:22', expires: '2026-10-11 16:22', point: 'Head of main', deltaMb: 3, lsn: '0/4A3A0010', createdBy: 'agent: claude-code' },
  { id: 'br_a05519fe', db: 'db_app', name: 'restore-oct-06', parent: 'main', state: 'suspended', isDefault: false, created: '2026-10-06 18:30', expires: null, point: '2026-10-06 17:45 UTC', deltaMb: 0, lsn: '0/49F01A40', createdBy: 'you' },
  { id: 'br_e21b6630', db: 'db_app', name: 'agent/backfill-test', parent: 'main', state: 'running', isDefault: false, created: '2026-10-09 08:15', expires: '2026-10-09 20:15', point: 'Head of main', deltaMb: 41, lsn: '0/4A3E9920', createdBy: 'agent: claude-code' },
  { id: 'br_b1000001', db: 'db_billing', name: 'main', parent: null, state: 'running', isDefault: true, created: '2026-07-02 10:00', expires: null, point: 'Root', deltaMb: 18240, lsn: '2/1C00F3A8', createdBy: 'you' },
  { id: 'br_b1000002', db: 'db_billing', name: 'reconcile-q3', parent: 'main', state: 'suspended', isDefault: false, created: '2026-10-01 09:00', expires: null, point: '2026-09-30 23:59 UTC', deltaMb: 66, lsn: '2/1A77E000', createdBy: 'you' },
  { id: 'br_s1000001', db: 'db_scratch', name: 'main', parent: null, state: 'suspended', isDefault: true, created: '2026-09-30 13:00', expires: null, point: 'Root', deltaMb: 212, lsn: '0/01A0B2C8', createdBy: 'you' },
]

export type Column = { name: string; type: string; nullable: boolean; pk?: boolean; default?: string; fk?: string }
export type TableDef = {
  schema: string
  name: string
  rows: number
  sizeKb: number
  columns: Column[]
  indexes: { name: string; def: string; unique: boolean; sizeKb: number }[]
  constraints: { name: string; kind: string; def: string }[]
  comment?: string
}

export const TABLES: TableDef[] = [
  {
    schema: 'public', name: 'customers', rows: 12480, sizeKb: 2240, comment: 'One row per registered customer.',
    columns: [
      { name: 'id', type: 'bigint', nullable: false, pk: true, default: "nextval('customers_id_seq')" },
      { name: 'email', type: 'text', nullable: false },
      { name: 'full_name', type: 'text', nullable: false },
      { name: 'region', type: 'text', nullable: false },
      { name: 'tier', type: 'text', nullable: false, default: "'free'" },
      { name: 'marketing_opt_in', type: 'boolean', nullable: false, default: 'false' },
      { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
    ],
    indexes: [
      { name: 'customers_pkey', def: 'btree (id)', unique: true, sizeKb: 288 },
      { name: 'customers_email_key', def: 'btree (email)', unique: true, sizeKb: 512 },
      { name: 'customers_region_idx', def: 'btree (region)', unique: false, sizeKb: 96 },
    ],
    constraints: [
      { name: 'customers_pkey', kind: 'Primary key', def: 'PRIMARY KEY (id)' },
      { name: 'customers_email_key', kind: 'Unique', def: 'UNIQUE (email)' },
      { name: 'customers_tier_check', kind: 'Check', def: "CHECK (tier IN ('free','pro','enterprise'))" },
    ],
  },
  {
    schema: 'public', name: 'orders', rows: 184302, sizeKb: 31800, comment: 'Customer orders. Written by the checkout service.',
    columns: [
      { name: 'id', type: 'bigint', nullable: false, pk: true, default: "nextval('orders_id_seq')" },
      { name: 'customer_id', type: 'bigint', nullable: false, fk: 'customers.id' },
      { name: 'status', type: 'text', nullable: false, default: "'pending'" },
      { name: 'amount', type: 'numeric(12,2)', nullable: false },
      { name: 'currency', type: 'text', nullable: false, default: "'USD'" },
      { name: 'coupon_code', type: 'text', nullable: true },
      { name: 'placed_at', type: 'timestamptz', nullable: false, default: 'now()' },
      { name: 'shipped_at', type: 'timestamptz', nullable: true },
    ],
    indexes: [
      { name: 'orders_pkey', def: 'btree (id)', unique: true, sizeKb: 4096 },
      { name: 'orders_customer_id_idx', def: 'btree (customer_id)', unique: false, sizeKb: 3072 },
      { name: 'orders_placed_at_idx', def: 'btree (placed_at DESC)', unique: false, sizeKb: 4100 },
    ],
    constraints: [
      { name: 'orders_pkey', kind: 'Primary key', def: 'PRIMARY KEY (id)' },
      { name: 'orders_customer_id_fkey', kind: 'Foreign key', def: 'FOREIGN KEY (customer_id) REFERENCES customers(id)' },
      { name: 'orders_amount_check', kind: 'Check', def: 'CHECK (amount >= 0)' },
    ],
  },
  {
    schema: 'public', name: 'order_items', rows: 512940, sizeKb: 58200,
    columns: [
      { name: 'id', type: 'bigint', nullable: false, pk: true },
      { name: 'order_id', type: 'bigint', nullable: false, fk: 'orders.id' },
      { name: 'product_id', type: 'bigint', nullable: false, fk: 'products.id' },
      { name: 'quantity', type: 'integer', nullable: false, default: '1' },
      { name: 'unit_price', type: 'numeric(12,2)', nullable: false },
    ],
    indexes: [
      { name: 'order_items_pkey', def: 'btree (id)', unique: true, sizeKb: 11200 },
      { name: 'order_items_order_id_idx', def: 'btree (order_id)', unique: false, sizeKb: 9800 },
    ],
    constraints: [
      { name: 'order_items_pkey', kind: 'Primary key', def: 'PRIMARY KEY (id)' },
      { name: 'order_items_order_id_fkey', kind: 'Foreign key', def: 'FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE' },
    ],
  },
  {
    schema: 'public', name: 'products', rows: 640, sizeKb: 184,
    columns: [
      { name: 'id', type: 'bigint', nullable: false, pk: true },
      { name: 'sku', type: 'text', nullable: false },
      { name: 'name', type: 'text', nullable: false },
      { name: 'category', type: 'text', nullable: false },
      { name: 'price', type: 'numeric(12,2)', nullable: false },
      { name: 'attributes', type: 'jsonb', nullable: true },
      { name: 'active', type: 'boolean', nullable: false, default: 'true' },
    ],
    indexes: [
      { name: 'products_pkey', def: 'btree (id)', unique: true, sizeKb: 32 },
      { name: 'products_sku_key', def: 'btree (sku)', unique: true, sizeKb: 40 },
    ],
    constraints: [
      { name: 'products_pkey', kind: 'Primary key', def: 'PRIMARY KEY (id)' },
      { name: 'products_sku_key', kind: 'Unique', def: 'UNIQUE (sku)' },
    ],
  },
  {
    schema: 'public', name: 'events', rows: 2840112, sizeKb: 412000, comment: 'Append-only product analytics events.',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, pk: true, default: 'gen_random_uuid()' },
      { name: 'customer_id', type: 'bigint', nullable: true, fk: 'customers.id' },
      { name: 'kind', type: 'text', nullable: false },
      { name: 'payload', type: 'jsonb', nullable: true },
      { name: 'occurred_at', type: 'timestamptz', nullable: false, default: 'now()' },
    ],
    indexes: [
      { name: 'events_pkey', def: 'btree (id)', unique: true, sizeKb: 98000 },
      { name: 'events_occurred_at_idx', def: 'brin (occurred_at)', unique: false, sizeKb: 48 },
    ],
    constraints: [{ name: 'events_pkey', kind: 'Primary key', def: 'PRIMARY KEY (id)' }],
  },
  {
    schema: 'auth', name: 'sessions', rows: 3120, sizeKb: 640,
    columns: [
      { name: 'token_hash', type: 'bytea', nullable: false, pk: true },
      { name: 'customer_id', type: 'bigint', nullable: false, fk: 'customers.id' },
      { name: 'expires_at', type: 'timestamptz', nullable: false },
    ],
    indexes: [{ name: 'sessions_pkey', def: 'btree (token_hash)', unique: true, sizeKb: 160 }],
    constraints: [{ name: 'sessions_pkey', kind: 'Primary key', def: 'PRIMARY KEY (token_hash)' }],
  },
]

const REGIONS = ['north', 'south', 'east', 'west']
const TIERS = ['free', 'free', 'pro', 'free', 'enterprise', 'pro']
const FIRST = ['Ada', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Edsger', 'Frances', 'Alan', 'Hedy']
const LAST = ['Okafor', 'Lindqvist', 'Marchetti', 'Tanaka', 'Novak', 'Haddad', 'Silva', 'Brennan', 'Kowalski', 'Mehta']
const STATUSES = ['paid', 'shipped', 'paid', 'pending', 'shipped', 'refunded', 'shipped']
const KINDS = ['page_view', 'add_to_cart', 'checkout_started', 'purchase', 'search']
const CATS = ['hardware', 'apparel', 'books', 'home']

const pad = (n: number) => String(n).padStart(2, '0')
const ts = (i: number) => `2026-10-${pad(9 - (i % 9))} ${pad((i * 7) % 24)}:${pad((i * 13) % 60)}:${pad((i * 29) % 60)}+00`

export type Row = Record<string, string | number | boolean | null>

export function rowsFor(table: string, n = 60): Row[] {
  return Array.from({ length: n }, (_, k): Row => {
    const i = k + 1
    switch (table) {
      case 'customers': {
        const f = FIRST[i % FIRST.length], l = LAST[(i * 3) % LAST.length]
        return { id: 1000 + i, email: `${f}.${l}${i}@example.com`.toLowerCase(), full_name: `${f} ${l}`, region: REGIONS[i % 4], tier: TIERS[i % TIERS.length], marketing_opt_in: i % 3 === 0, created_at: ts(i) }
      }
      case 'orders':
        return { id: 184302 - k, customer_id: 1000 + ((i * 17) % 60) + 1, status: STATUSES[i % STATUSES.length], amount: Number((19 + ((i * 37) % 480) + (i % 100) / 100).toFixed(2)), currency: i % 11 === 0 ? 'EUR' : 'USD', coupon_code: i % 6 === 0 ? 'FALL10' : null, placed_at: ts(i), shipped_at: STATUSES[i % STATUSES.length] === 'shipped' ? ts(i + 1) : null }
      case 'order_items':
        return { id: 512940 - k, order_id: 184302 - Math.floor(k / 3), product_id: 1 + ((i * 7) % 640), quantity: 1 + (i % 4), unit_price: Number((5 + ((i * 53) % 190) + 0.99).toFixed(2)) }
      case 'products':
        return { id: i, sku: `SKU-${pad(i % 100)}${String.fromCharCode(65 + (i % 26))}${i}`, name: `${['Trail', 'Studio', 'Field', 'Harbor'][i % 4]} ${['Lamp', 'Jacket', 'Notebook', 'Kettle', 'Backpack'][i % 5]}`, category: CATS[i % 4], price: Number((9 + ((i * 41) % 220) + 0.5).toFixed(2)), attributes: i % 5 === 0 ? null : `{"color":"${['slate', 'sand', 'moss'][i % 3]}","weight_g":${200 + i * 13}}`, active: i % 9 !== 0 }
      case 'events':
        return { id: `0192f${pad(i)}a-7c${pad(i % 90)}-4e1b-9a3d-${String(4810000 + i * 977).padStart(12, '0')}`, customer_id: i % 7 === 0 ? null : 1000 + (i % 60) + 1, kind: KINDS[i % KINDS.length], payload: `{"path":"/p/${i}","ms":${40 + ((i * 19) % 900)}}`, occurred_at: ts(i) }
      default:
        return { token_hash: `\\x${(i * 2654435761).toString(16).padStart(8, '0')}…`, customer_id: 1000 + i, expires_at: ts(i) }
    }
  })
}

export const OBJECTS = {
  views: [
    { schema: 'public', name: 'order_totals', def: 'SELECT o.id, o.customer_id, sum(i.quantity * i.unit_price) AS total\n  FROM orders o JOIN order_items i ON i.order_id = o.id\n GROUP BY o.id, o.customer_id;' },
    { schema: 'public', name: 'active_customers', def: "SELECT * FROM customers c\n WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.placed_at > now() - interval '90 days');" },
  ],
  matviews: [{ schema: 'public', name: 'daily_revenue', def: "SELECT date_trunc('day', placed_at) AS day, sum(amount) AS revenue\n  FROM orders WHERE status <> 'refunded' GROUP BY 1;" }],
  functions: [
    { schema: 'public', name: 'apply_coupon(order_id bigint, code text)', def: 'RETURNS numeric LANGUAGE plpgsql' },
    { schema: 'public', name: 'touch_updated_at()', def: 'RETURNS trigger LANGUAGE plpgsql' },
  ],
  sequences: [
    { schema: 'public', name: 'customers_id_seq', def: 'last value 13480, increment 1' },
    { schema: 'public', name: 'orders_id_seq', def: 'last value 184302, increment 1' },
  ],
  types: [{ schema: 'public', name: 'order_status', def: "ENUM ('pending','paid','shipped','refunded')" }],
}

export const EXTENSIONS = [
  { name: 'neon', version: '1.5', installed: true, desc: 'Storage engine integration. Required.', locked: true },
  { name: 'plpgsql', version: '1.0', installed: true, desc: 'PL/pgSQL procedural language.', locked: true },
  { name: 'pgcrypto', version: '1.3', installed: true, desc: 'Cryptographic functions.' },
  { name: 'pg_stat_statements', version: '1.11', installed: false, desc: 'Track planning and execution statistics of SQL statements.' },
  { name: 'vector', version: '0.8.0', installed: false, desc: 'Vector data type and similarity search.' },
  { name: 'postgis', version: '3.5', installed: false, desc: 'Geographic objects and spatial queries.' },
  { name: 'pg_trgm', version: '1.6', installed: false, desc: 'Text similarity using trigram matching.' },
  { name: 'uuid-ossp', version: '1.1', installed: false, desc: 'Generate UUIDs.' },
  { name: 'citext', version: '1.6', installed: false, desc: 'Case-insensitive text type.' },
]

export const ROLES = [
  { name: 'app_owner', login: true, attrs: ['Create DB objects'], member: [], conn: 5, note: 'Owner of application schemas' },
  { name: 'app_rw', login: true, attrs: [], member: ['pg_read_all_data', 'pg_write_all_data'], conn: 2, note: 'Used by the checkout service' },
  { name: 'app_readonly', login: true, attrs: [], member: ['pg_read_all_data'], conn: 0, note: 'Dashboards and ad hoc reads' },
  { name: 'cloud_admin', login: false, attrs: ['Superuser'], member: [], conn: 1, note: 'Managed by Supabricks' },
]

export type ApiKey = { id: string; name: string; scope: string; prefix: string; created: string; lastUsed: string; expires: string }
export const API_KEYS: ApiKey[] = [
  { id: 'k1', name: 'checkout-service', scope: 'Database: app (read and write)', prefix: 'sbk_live_9f2c', created: '2026-08-20', lastUsed: '2 minutes ago', expires: 'Never' },
  { id: 'k2', name: 'ci-migrations', scope: 'Project (manage branches)', prefix: 'sbk_live_41ab', created: '2026-09-02', lastUsed: 'Yesterday', expires: '2027-01-01' },
  { id: 'k3', name: 'metabase', scope: 'Database: app (read only)', prefix: 'sbk_live_c07e', created: '2026-09-18', lastUsed: '4 hours ago', expires: 'Never' },
]

export const SLOW_QUERIES = [
  { q: 'SELECT c.region, sum(o.amount) FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY 1', calls: 1840, mean: 412.6, p95: 890.2, rows: 4, share: 38 },
  { q: "SELECT * FROM events WHERE kind = $1 AND occurred_at > now() - interval '1 day'", calls: 9210, mean: 61.3, p95: 240.8, rows: 1820, share: 27 },
  { q: 'UPDATE orders SET status = $1, shipped_at = now() WHERE id = $2', calls: 48200, mean: 3.1, p95: 9.4, rows: 1, share: 9 },
  { q: 'SELECT * FROM order_items WHERE order_id = $1', calls: 310400, mean: 0.4, p95: 1.2, rows: 3, share: 7 },
  { q: 'INSERT INTO events (customer_id, kind, payload) VALUES ($1, $2, $3)', calls: 1204000, mean: 0.2, p95: 0.6, rows: 1, share: 6 },
]

export const ACTIVE_QUERIES = [
  { pid: 48211, role: 'app_rw', state: 'active', dur: '00:00:02.4', wait: '', q: 'UPDATE orders SET status = $1 WHERE id = $2' },
  { pid: 48190, role: 'app_readonly', state: 'active', dur: '00:01:14.0', wait: 'IO: DataFileRead', q: 'SELECT kind, count(*) FROM events GROUP BY 1' },
  { pid: 48102, role: 'app_rw', state: 'idle in transaction', dur: '00:04:51.7', wait: 'Client: ClientRead', q: 'BEGIN; SELECT * FROM customers WHERE id = 1042 FOR UPDATE' },
  { pid: 47998, role: 'app_owner', state: 'active', dur: '00:00:00.1', wait: 'Lock: transactionid', q: 'UPDATE customers SET tier = $1 WHERE id = 1042' },
]

// Deterministic pseudo-random series so charts look the same on every load.
export function series(seed: number, points: number, base: number, swing: number) {
  let s = seed
  return Array.from({ length: points }, (_, i) => {
    s = (s * 9301 + 49297) % 233280
    const noise = s / 233280 - 0.5
    const wave = Math.sin((i / points) * Math.PI * 3 + seed)
    return Math.max(0, base + wave * swing * 0.6 + noise * swing)
  })
}

export const SAVED_QUERIES = [
  { id: 'q1', folder: 'Revenue', title: 'Revenue by region', sql: "SELECT c.region,\n       sum(o.amount) AS revenue\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status <> 'refunded'\nGROUP BY c.region\nORDER BY revenue DESC;" },
  { id: 'q2', folder: 'Revenue', title: 'Daily orders (30 days)', sql: "SELECT date_trunc('day', placed_at) AS day, count(*) AS orders\n  FROM orders\n WHERE placed_at > now() - interval '30 days'\n GROUP BY 1 ORDER BY 1;" },
  { id: 'q3', folder: 'Support', title: 'Find customer by email', sql: "SELECT * FROM customers WHERE email ILIKE '%' || 'okafor' || '%';" },
  { id: 'q4', folder: 'Ops', title: 'Largest tables', sql: 'SELECT relname, pg_size_pretty(pg_total_relation_size(oid))\n  FROM pg_class WHERE relkind = \'r\'\n ORDER BY pg_total_relation_size(oid) DESC LIMIT 10;' },
]

export const QUERY_HISTORY = [
  { at: '14:02:11', branch: 'main', status: 'succeeded', ms: 412, rows: 4, sql: 'SELECT c.region, sum(o.amount) AS revenue FROM orders o JOIN customers c …' },
  { at: '13:58:40', branch: 'staging', status: 'succeeded', ms: 18, rows: 1, sql: "UPDATE customers SET tier = 'pro' WHERE id = 1042" },
  { at: '13:51:02', branch: 'main', status: 'failed', ms: 3, rows: 0, sql: 'SELECT * FROM order WHERE id = 1' },
  { at: '13:44:19', branch: 'main', status: 'cancelled', ms: 10000, rows: 0, sql: 'SELECT kind, count(*) FROM events GROUP BY 1' },
  { at: '11:20:55', branch: 'feature/loyalty-points', status: 'succeeded', ms: 96, rows: 0, sql: 'ALTER TABLE customers ADD COLUMN loyalty_points integer NOT NULL DEFAULT 0' },
]

export const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`)
export const fmtKb = (kb: number) => (kb >= 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)} GB` : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} kB`)
export const fmtN = (n: number) => n.toLocaleString('en-US')

// ---- Sync: PostgreSQL to Delta ----

export type SyncMode = 'snapshot' | 'triggered' | 'continuous'
export type SyncState = 'healthy' | 'lagging' | 'idle' | 'running' | 'paused' | 'blocked' | 'starting'
export type Pipeline = {
  id: string
  db: string
  branch: string
  mode: SyncMode
  state: SyncState
  everySeconds: number | null
  freshnessMs: number
  batchMs: number
  storage: 'compact' | 'large'
  tables: string[]
  created: string
  revision: number
  lastSuccess: string
  nextRun: string | null
  version: number
  lagMs: number | null
  sourceLsn: string
  capturedLsn: string
  publishedLsn: string
  backlogBytes: number
  spoolBytes: number
  walBytes: number
  blocked?: { title: string; detail: string }
}

const SYNCED = ['public.customers', 'public.orders', 'public.order_items']
export const PIPELINES: Pipeline[] = [
  { id: 'pl_7c41e0a2', db: 'db_app', branch: 'main', mode: 'continuous', state: 'healthy', everySeconds: null, freshnessMs: 5000, batchMs: 500, storage: 'compact', tables: SYNCED, created: '2026-09-24', revision: 7, lastSuccess: '3 seconds ago', nextRun: null, version: 4182, lagMs: 3100, sourceLsn: '0/4A3F2E18', capturedLsn: '0/4A3F2A40', publishedLsn: '0/4A3F1C90', backlogBytes: 184_320, spoolBytes: 245_760, walBytes: 358_440 },
  { id: 'pl_19ab55d3', db: 'db_app', branch: 'staging', mode: 'triggered', state: 'idle', everySeconds: 900, freshnessMs: 5000, batchMs: 500, storage: 'compact', tables: SYNCED, created: '2026-09-28', revision: 3, lastSuccess: '11 minutes ago', nextRun: 'in 4 minutes', version: 212, lagMs: null, sourceLsn: '0/4A11C0D8', capturedLsn: '0/4A11C0D8', publishedLsn: '0/4A11A220', backlogBytes: 2_412_544, spoolBytes: 3_145_728, walBytes: 6_291_456 },
  { id: 'pl_e80c2f17', db: 'db_billing', branch: 'main', mode: 'snapshot', state: 'idle', everySeconds: 86400, freshnessMs: 5000, batchMs: 500, storage: 'large', tables: ['public.invoices', 'public.payments', 'public.ledger_entries', 'public.accounts'], created: '2026-08-02', revision: 4, lastSuccess: 'Today 02:00', nextRun: 'Tomorrow 02:00 UTC', version: 69, lagMs: null, sourceLsn: '2/1C00F3A8', capturedLsn: '2/1BE204F0', publishedLsn: '2/1BE204F0', backlogBytes: 0, spoolBytes: 0, walBytes: 0 },
  { id: 'pl_3d9e7741', db: 'db_app', branch: 'feature/loyalty-points', mode: 'triggered', state: 'blocked', everySeconds: null, freshnessMs: 5000, batchMs: 500, storage: 'compact', tables: SYNCED, created: '2026-10-07', revision: 5, lastSuccess: 'Yesterday 16:40', nextRun: null, version: 18, lagMs: null, sourceLsn: '0/4A2B77F0', capturedLsn: '0/4A2B1000', publishedLsn: '0/4A2A9E08', backlogBytes: 412_876_800, spoolBytes: 461_373_440, walBytes: 187_695_104, blocked: { title: 'The source schema changed', detail: 'Column customers.loyalty_points was added after this pipeline started. Publication stopped at version 18, which stays readable. Review a full resync to pick up the new column.' } },
]

export type SyncRun = { id: string; trigger: string; started: string; seconds: number; state: string; rows: number; version: number | null; lsn: string; error?: string }
export function runsFor(p: Pipeline): SyncRun[] {
  const trig = p.mode === 'continuous' ? 'Continuous' : p.mode === 'snapshot' ? 'Schedule' : p.everySeconds ? 'Schedule' : 'Manual'
  return Array.from({ length: 14 }, (_, i) => {
    const failed = p.state === 'blocked' && i === 0
    const cancelled = i === 6
    return {
      id: `run_${(p.version * 7919 + i * 104729).toString(16).slice(0, 8)}`,
      trigger: i === 13 ? 'Bootstrap' : i === 4 && p.mode !== 'continuous' ? 'Manual' : trig,
      started: p.mode === 'continuous' ? `14:0${4 - Math.floor(i / 3)}:${String(57 - i * 4).padStart(2, '0')}` : i === 0 ? '13:54:02' : `Oct ${9 - Math.floor(i / 2)}, ${String(23 - i).padStart(2, '0')}:00`,
      seconds: failed ? 2.1 : i === 13 ? 184 : p.mode === 'snapshot' ? 142 + i * 3 : p.mode === 'continuous' ? 0.6 + (i % 4) * 0.3 : 4 + (i % 5),
      state: failed ? 'failed' : cancelled ? 'cancelled' : 'succeeded',
      rows: failed || cancelled ? 0 : i === 13 ? 709_722 : p.mode === 'snapshot' ? 1_204_000 + i * 811 : p.mode === 'continuous' ? 40 + ((i * 37) % 160) : 2_100 + ((i * 977) % 9_000),
      version: failed || cancelled ? null : p.version - i,
      lsn: `${p.publishedLsn.split('/')[0]}/${(parseInt(p.publishedLsn.split('/')[1], 16) - i * 0x1a40).toString(16).toUpperCase()}`,
      error: failed ? 'Source schema changed: customers.loyalty_points' : undefined,
    }
  })
}

/** How a PostgreSQL column type lands in Delta, or why it cannot. */
export function deltaType(pg: string): { delta: string | null; why?: string } {
  if (/^(bigint|integer|smallint)$/.test(pg)) return { delta: pg === 'bigint' ? 'long' : pg === 'integer' ? 'integer' : 'short' }
  if (pg === 'boolean') return { delta: 'boolean' }
  if (pg === 'text' || pg.startsWith('varchar')) return { delta: 'string' }
  if (pg.startsWith('numeric(')) return { delta: pg.replace('numeric', 'decimal') }
  if (pg === 'date') return { delta: 'date' }
  if (pg === 'timestamptz') return { delta: 'timestamp (UTC)' }
  if (pg === 'timestamp') return { delta: 'timestamp_ntz' }
  return { delta: null, why: `${pg} has no lossless Delta mapping yet` }
}

export const MODE_LABEL: Record<SyncMode, string> = { snapshot: 'Snapshot', triggered: 'Triggered', continuous: 'Continuous' }
export const fmtBytes = (b: number) => (b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GiB` : b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MiB` : b >= 1024 ? `${Math.round(b / 1024)} KiB` : `${b} B`)
export const fmtEvery = (s: number | null) => (!s ? 'Manual' : s % 86400 === 0 ? `Every ${s / 86400 === 1 ? 'day' : `${s / 86400} days`}` : s % 3600 === 0 ? `Every ${s / 3600 === 1 ? 'hour' : `${s / 3600} hours`}` : `Every ${s / 60} minutes`)

// ---- Analytics: versions and sessions ----

export type Version = { n: number; published: string; lsn: string; by: string; rowsChanged: number; sizeMb: number; tables: number; readers: number }
export function versionsFor(p: Pipeline, count = 14): Version[] {
  const base = parseInt(p.publishedLsn.split('/')[1], 16), hi = p.publishedLsn.split('/')[0]
  return Array.from({ length: Math.min(count, p.version) }, (_, i) => ({
    n: p.version - i,
    published: p.mode === 'continuous' ? `Today 14:0${Math.max(0, 5 - Math.floor((i + 1) / 3))}:${String(57 - ((i * 4) % 58)).padStart(2, '0')}` : p.mode === 'snapshot' ? `Oct ${10 - i - 1}, 02:00` : i === 0 ? 'Today 13:54' : `Today ${String(13 - Math.floor(i / 4)).padStart(2, '0')}:${String(54 - ((i * 15) % 60) + (((i * 15) % 60) > 54 ? 60 : 0)).padStart(2, '0')}`,
    lsn: `${hi}/${(base - i * 0x1a40).toString(16).toUpperCase()}`,
    by: p.mode === 'continuous' ? 'Continuous sync' : i === 4 ? 'Manual run' : p.mode === 'snapshot' ? 'Nightly snapshot' : 'Scheduled run',
    rowsChanged: p.mode === 'snapshot' ? 1_204_000 + i * 811 : p.mode === 'continuous' ? 40 + ((i * 37) % 160) : 2_100 + ((i * 977) % 9_000),
    sizeMb: p.mode === 'snapshot' ? 1840 - i * 2 : 96 - i * 0.02,
    tables: p.tables.length,
    readers: 0,
  }))
}

export type Session = { id: string; owner: string; ownerKind: 'sql' | 'notebook' | 'cli'; pipeline: string; version: number; profile: 'compact' | 'analytical'; state: 'starting' | 'ready' | 'busy'; started: string; expiresMin: number }
export const SESSIONS: Session[] = [
  { id: 'ses_41c9aa07', owner: 'Notebook: revenue-exploration.ipynb', ownerKind: 'notebook', pipeline: 'pl_7c41e0a2', version: 4169, profile: 'compact', state: 'ready', started: '13:52', expiresMin: 9 },
]
export const SLOTS = 2
export const slotsOf = (s: Session) => (s.profile === 'analytical' ? 2 : 1)

// ---- Catalog (Unity Catalog) ----

export type CatColumn = { name: string; type: string; nullable: boolean; comment?: string }
export type CatTable = { catalog: string; schema: string; name: string; kind: 'own' | 'shared'; columns: CatColumn[]; rows: number; comment?: string; source?: string }
export type Publication = { id: string; name: string; pipeline: string; revision: number; version: number; follows: 'latest' | 'fixed'; state: 'published' | 'withdrawn' | 'publishing'; published: string; consumers: string[] }
export type SharedDataset = { id: string; name: string; owner: string; revision: number; latest: number; published: string; tables: CatTable[]; bound: string | null; comment: string }

const col = (name: string, type: string, nullable = false, comment?: string): CatColumn => ({ name, type, nullable, comment })
const COMMENTS: Record<string, string> = { 'orders.amount': 'Order total in the order currency, tax included.', 'orders.status': 'pending, paid, shipped or refunded.', 'customers.tier': 'Subscription tier: free, pro or enterprise.', 'customers.region': 'Sales region the customer is assigned to.' }
export const OWN_TABLES: CatTable[] = ['customers', 'orders', 'order_items'].map((n) => {
  const t = TABLES.find((x) => x.name === n)!
  return { catalog: 'sales_analytics', schema: 'app', name: n, kind: 'own', rows: t.rows, comment: t.comment, source: `public.${n}`, columns: t.columns.map((c) => col(c.name, deltaType(c.type).delta ?? c.type, c.nullable, COMMENTS[`${n}.${c.name}`])) }
})
const fin = (name: string, rows: number, comment: string, columns: CatColumn[]): CatTable => ({ catalog: 'finance', schema: 'billing', name, kind: 'shared', rows, comment, columns })
export const SHARED: SharedDataset[] = [
  { id: 'ds_fin', name: 'finance.billing', owner: 'finance-ops', revision: 12, latest: 13, published: 'Oct 8, 02:00', bound: 'Sep 29', comment: 'Invoices and payments from the billing database, refreshed nightly.',
    tables: [
      fin('invoices', 48210, 'One row per invoice issued.', [col('id', 'long'), col('customer_id', 'long'), col('issued_on', 'date'), col('due_on', 'date'), col('total', 'decimal(12,2)'), col('currency', 'string'), col('status', 'string')]),
      fin('payments', 61904, 'Payments received against invoices.', [col('id', 'long'), col('invoice_id', 'long'), col('received_at', 'timestamp (UTC)'), col('amount', 'decimal(12,2)'), col('method', 'string', true)]),
    ] },
  { id: 'ds_mkt', name: 'growth.marketing', owner: 'growth', revision: 5, latest: 5, published: 'Oct 9, 06:30', bound: null, comment: 'Campaigns and daily spend by channel.',
    tables: [
      { catalog: 'growth', schema: 'marketing', name: 'campaigns', kind: 'shared', rows: 312, columns: [col('id', 'long'), col('name', 'string'), col('channel', 'string'), col('started_on', 'date'), col('ended_on', 'date', true)] },
      { catalog: 'growth', schema: 'marketing', name: 'spend_daily', kind: 'shared', rows: 18420, columns: [col('campaign_id', 'long'), col('day', 'date'), col('spend', 'decimal(12,2)'), col('clicks', 'long')] },
    ] },
  { id: 'ds_fx', name: 'finance.reference', owner: 'finance-ops', revision: 40, latest: 40, published: 'Today 00:05', bound: null, comment: 'Daily exchange rates against USD.',
    tables: [{ catalog: 'finance', schema: 'reference', name: 'fx_rates', kind: 'shared', rows: 9125, columns: [col('day', 'date'), col('currency', 'string'), col('rate_to_usd', 'decimal(18,8)')] }] },
]
export const PUBLICATIONS: Publication[] = [
  { id: 'pub_3f9a12c0', name: 'sales_analytics.app', pipeline: 'pl_7c41e0a2', revision: 3, version: 4169, follows: 'fixed', state: 'published', published: 'Oct 8, 16:20', consumers: ['finance-ops'] },
]
export const sampleFor = (t: CatTable): Row[] => (t.kind === 'own' ? rowsFor(t.name, 12) : Array.from({ length: 8 }, (_, i) => Object.fromEntries(t.columns.map((c, j) => [c.name, c.type === 'long' ? 9000 + i * 7 + j : c.type === 'date' ? `2026-10-0${(i % 9) + 1}` : c.type.startsWith('decimal') ? Number((120 + i * 37.5 + j).toFixed(2)) : c.type.startsWith('timestamp') ? `2026-10-0${(i % 9) + 1} 0${i}:15:00+00` : c.nullable && i % 3 === 0 ? null : ['USD', 'EUR', 'paid', 'open', 'card', 'search', 'email', 'Autumn launch'][(i + j) % 8]]))))
