import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Cable, Code2, Copy, Eye, EyeOff, KeyRound, Pause, Play, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { BranchLanes, depthOf, treeOrder } from '@/components/branch-graph'
import { BackingTag, BranchSelect, CodeBlock, CopyField, Section, Stat, StatusBadge, copy } from '@/components/common'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fmtMb, ROLES, series, SIZES } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { Extensions, Roles, Settings } from './DatabaseAdmin'
import { Backups } from './DatabaseBackups'
import { Compute, Observability } from './DatabaseOps'

const TABS = [
  ['overview', 'Overview'], ['connect', 'Connect'], ['keys', 'API keys'], ['compute', 'Compute'], ['observability', 'Observability'],
  ['roles', 'Roles'], ['extensions', 'Extensions'], ['backups', 'Backups'], ['settings', 'Settings'],
] as const

const PASSWORD = 'npg_T4kq9WzLm2Xc'

const ACTIVITY: [string, string][] = [
  ['14:01', 'agent/backfill-test resumed on a new connection'],
  ['11:03', 'feature/loyalty-points branched from staging'],
  ['09:40', 'Compute resized from Extra small to Small'],
  ['Yesterday', 'pr-482 suspended after 5 minutes idle'],
  ['Oct 6', 'restore-oct-06 branched from main at 17:45 UTC'],
]

function Overview() {
  const { db, dbBranches, branch, branchName } = useStore()
  const size = SIZES.find((s) => s.id === db.size)!
  const nav = useNavigate()
  const [shown, setShown] = useState(false)
  const uri = `postgresql://app_owner:${PASSWORD}@127.0.0.1:${db.port}/${db.name}?options=branch%3D${branch.name}`
  const rows = treeOrder(dbBranches)
  const on = db.state === 'running'
  return (
    <div className="grid gap-8">
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Cable className="size-4 shrink-0 text-oltp" />
          <code className="min-w-0 flex-1 truncate font-mono text-[13.5px]">{shown ? uri : uri.replace(PASSWORD, '••••••••••••')}</code>
          <Button variant="ghost" size="icon-sm" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(!shown)}>{shown ? <EyeOff /> : <Eye />}</Button>
          <Button size="sm" onClick={() => copy(uri, 'Connection string copied')}><Copy /> Copy</Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t bg-muted/40 px-4 py-2 text-[13px] text-muted-foreground">
          <span>Connects to branch <span className="font-mono text-[12.5px] text-foreground">{branchName}</span> as <span className="font-mono text-[12.5px] text-foreground">app_owner</span></span>
          <button className="ml-auto font-medium text-primary hover:underline" onClick={() => nav(`/databases/${db.name}/connect`)}>psql, JDBC and driver snippets</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 pr-1 lg:grid-cols-4">
        <Stat label="CPU" value={on ? '34%' : '0%'} sub={`${size.vcpu} vCPU, ${size.label.toLowerCase()} compute`} spark={series(3, 24, 34, 30)} tag={<BackingTag id="DB-07" compact />} />
        <Stat label="Connections" value={db.connections} sub={`of ${size.maxConn} allowed`} spark={series(5, 24, 12, 10)} tag={<BackingTag id="DB-03" compact />} />
        <Stat label="Queries per second" value={on ? '259' : '0'} sub="p95 latency 19.9 ms" spark={series(7, 24, 260, 180)} tag={<BackingTag id="DB-07" compact />} />
        <Stat label="Storage" value={fmtMb(db.storageMb)} sub="shared across branches" spark={series(9, 24, 40, 4).map((v, i) => v + i * 0.6)} sparkColor="var(--chart-3)" tag={<BackingTag id="DB-03" compact />} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Branches" flush actions={<Button variant="ghost" size="sm" onClick={() => nav('/branches')}>Manage branches</Button>}>
          <div className="relative">
            {rows.map((b) => (
              <div key={b.id} className={cn('flex items-center border-b text-[13px] last:border-b-0', b.name === branchName && 'bg-accent/50')} style={{ height: 36 }}>
                <div className="w-[230px] shrink-0 truncate pr-2 font-mono text-[12.5px]" style={{ paddingLeft: 16 + depthOf(b, dbBranches) * 14 }}>{b.name}</div>
                <div className="min-w-0 flex-1" />
                <div className="w-28 shrink-0 pr-4"><StatusBadge status={b.state} /></div>
              </div>
            ))}
            <div className="absolute top-0 left-[230px] max-md:hidden"><BranchLanes rows={rows} all={dbBranches} rowH={36} width={250} inUse={branchName} /></div>
          </div>
        </Section>
        <Section title="Recent activity" flush>
          <ul className="divide-y text-[13px]">
            {ACTIVITY.map(([t, msg]) => (
              <li key={msg} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{t}</span>
                <span className="min-w-0 flex-1">{msg}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}

function Connect() {
  const { db, branch } = useStore()
  const [role, setRole] = useState('app_owner')
  const [pooled, setPooled] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const host = '127.0.0.1'
  const port = pooled ? db.port + 1000 : db.port
  const opts = `options=branch%3D${branch.name}`
  const uri = `postgresql://${role}:${PASSWORD}@${host}:${port}/${db.name}?${opts}`
  const jdbc = `jdbc:postgresql://${host}:${port}/${db.name}?user=${role}&password=${PASSWORD}&${opts}`
  const snippets: Record<string, string> = {
    Python: `import psycopg\n\nwith psycopg.connect("${uri}") as conn:\n    rows = conn.execute("SELECT now()").fetchall()\n    print(rows)`,
    SQLAlchemy: `from sqlalchemy import create_engine, text\n\nengine = create_engine("${uri.replace('postgresql://', 'postgresql+psycopg://')}")\nwith engine.connect() as conn:\n    print(conn.execute(text("SELECT now()")).all())`,
    'Node.js': `import pg from "pg";\n\nconst client = new pg.Client({ connectionString: "${uri}" });\nawait client.connect();\nconsole.log((await client.query("SELECT now()")).rows);\nawait client.end();`,
    Prisma: `// schema.prisma\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n# .env\nDATABASE_URL="${uri}"`,
    Go: `import (\n    "context"\n    "github.com/jackc/pgx/v5"\n)\n\nconn, err := pgx.Connect(context.Background(), "${uri}")\nif err != nil { panic(err) }\ndefer conn.Close(context.Background())`,
    Java: `String url = "${jdbc}";\ntry (Connection conn = DriverManager.getConnection(url);\n     ResultSet rs = conn.createStatement().executeQuery("SELECT now()")) {\n    rs.next();\n    System.out.println(rs.getString(1));\n}`,
    Rust: `use tokio_postgres::NoTls;\n\nlet (client, connection) =\n    tokio_postgres::connect("${uri}", NoTls).await?;\ntokio::spawn(connection);\nlet row = client.query_one("SELECT now()", &[]).await?;`,
  }

  return (
    <div className="grid gap-8">
      {db.state !== 'running' && (
        <Alert>
          <Pause />
          <AlertTitle>This database is suspended</AlertTitle>
          <AlertDescription>The first connection wakes it. Expect the first query to take a few seconds longer.</AlertDescription>
        </Alert>
      )}
      <Section
        title="Connection details"
        description="These credentials give full access to the selected branch. Keep them private."
        actions={
          <>
            <BranchSelect />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger size="sm" aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.filter((r) => r.login).map((r) => <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch checked={pooled} onCheckedChange={setPooled} /> Pooled <BackingTag id="DB-04d" />
            </label>
          </>
        }
      >
        <div className="grid gap-3">
          <CopyField label="Connection string (URI)" value={uri} secret={PASSWORD} />
          <div className="grid gap-3 md:grid-cols-2">
            <CopyField label="psql" value={`psql "${uri}"`} secret={PASSWORD} />
            <CopyField label="JDBC URL" value={jdbc} secret={PASSWORD} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <CopyField label="Host" value={host} />
            <CopyField label="Port" value={String(port)} />
            <CopyField label="Database" value={db.name} />
            <CopyField label="User" value={role} />
            <CopyField label="Password" value={PASSWORD} secret={PASSWORD} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}><RotateCcw /> Reset password</Button>
            <BackingTag id="DB-04c" />
            <Button variant="ghost" size="sm" onClick={() => copy(`PGHOST=${host}\nPGPORT=${port}\nPGDATABASE=${db.name}\nPGUSER=${role}\nPGPASSWORD=${PASSWORD}\nDATABASE_URL=${uri}`, 'Copied .env block')}>Copy as .env</Button>
          </div>
        </div>
      </Section>
      <Section title="Connect from your code" description="Snippets use the branch and role selected above.">
        <Tabs defaultValue="Python">
          <TabsList>{Object.keys(snippets).map((k) => <TabsTrigger key={k} value={k}>{k}</TabsTrigger>)}</TabsList>
          {Object.entries(snippets).map(([k, code]) => (
            <TabsContent key={k} value={k} className="mt-3"><CodeBlock code={code} secret={PASSWORD} /></TabsContent>
          ))}
        </Tabs>
      </Section>
      <Section title="Command line and agents" description="The same database from the Supabricks CLI or a coding agent.">
        <div className="grid gap-3 md:grid-cols-2">
          <CopyField label="Open a psql session" value={`supabricks connect ${branch.name} --uri | xargs psql`} />
          <CopyField label="Connect a coding agent (MCP)" value="supabricks mcp --project ." />
        </div>
      </Section>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {role}?</DialogTitle>
            <DialogDescription>Every application using the current password will fail to connect until it is updated. Open connections stay open.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setResetOpen(false); toast.success(`Password reset for ${role} (simulated)`) }}>Reset password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ApiKeys() {
  const { apiKeys, setApiKeys, db } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [scope, setScope] = useState('rw')
  const [expiry, setExpiry] = useState('never')
  const [created, setCreated] = useState<string | null>(null)
  const scopes: Record<string, string> = { ro: `Database: ${db.name} (read only)`, rw: `Database: ${db.name} (read and write)`, branches: 'Project (manage branches)', admin: 'Project (full access)' }

  const create = () => {
    const secret = `sbk_live_${Math.random().toString(36).slice(2, 6)}${'x7Qm2pLr9vTz4kWb8nYc'}`
    setApiKeys((k) => [{ id: secret, name, scope: scopes[scope], prefix: secret.slice(0, 13), created: '2026-10-09', lastUsed: 'Never', expires: expiry === 'never' ? 'Never' : expiry }, ...k])
    setCreated(secret)
    setName('')
  }

  return (
    <div className="grid gap-8">
      <Section
        flush
        title="API keys"
        tag={<BackingTag id="DB-05" />}
        description="Keys let services and scripts call the Supabricks API without a browser session. A key is shown once, when it is created."
        actions={<Button size="sm" onClick={() => { setCreated(null); setOpen(true) }}><Plus /> Create key</Button>}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Key</TableHead><TableHead>Access</TableHead><TableHead>Created</TableHead><TableHead>Last used</TableHead><TableHead>Expires</TableHead><TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium"><span className="flex items-center gap-2"><KeyRound className="size-3.5 text-muted-foreground" />{k.name}</span></TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">{k.prefix}••••••••</TableCell>
                <TableCell>{k.scope}</TableCell>
                <TableCell className="text-muted-foreground">{k.created}</TableCell>
                <TableCell className="text-muted-foreground">{k.lastUsed}</TableCell>
                <TableCell className="text-muted-foreground">{k.expires}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${k.name}`} onClick={() => { setApiKeys((ks) => ks.filter((x) => x.id !== k.id)); toast.success(`Key ${k.name} revoked`) }}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Section title="Use a key" description="Send it as a bearer token.">
        <CodeBlock code={`curl https://127.0.0.1:8443/api/v1/databases/${db.name}/sql \\\n  -H "Authorization: Bearer $SUPABRICKS_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"branch": "main", "sql": "SELECT count(*) FROM orders"}'`} />
      </Section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {created ? (
            <>
              <DialogHeader>
                <DialogTitle>Copy your new key</DialogTitle>
                <DialogDescription>This is the only time the full key is shown. Store it somewhere safe.</DialogDescription>
              </DialogHeader>
              <CopyField label="API key" value={created} />
              <DialogFooter><Button onClick={() => setOpen(false)}>Done</Button></DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>Give the key the narrowest access that works.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-8">
                <div className="grid gap-1.5"><Label htmlFor="key-name">Name</Label><Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="reporting-service" /></div>
                <div className="grid gap-1.5">
                  <Label>Access</Label>
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(scopes).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Expires</Label>
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem><SelectItem value="2026-11-08">In 30 days</SelectItem><SelectItem value="2027-01-07">In 90 days</SelectItem><SelectItem value="2027-10-09">In 1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!name.trim()} onClick={create}>Create key</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function DatabaseDetail() {
  const { dbName, tab = 'overview' } = useParams()
  const { databases, db, setDbId, setDatabases } = useStore()
  const nav = useNavigate()
  const target = databases.find((d) => d.name === dbName)
  useEffect(() => { if (target && target.id !== db.id) setDbId(target.id) }, [target, db.id, setDbId])
  if (!target) return <Navigate to="/databases" replace />
  if (target.id !== db.id) return null
  const running = db.state === 'running'
  const size = SIZES.find((x) => x.id === db.size)!
  const toggle = () => {
    setDatabases((ds) => ds.map((d) => (d.id === db.id ? { ...d, state: running ? 'suspended' : 'running', connections: running ? 0 : 1 } : d)))
    toast.success(`${db.name} ${running ? 'suspended' : 'resumed'}`)
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-[1.6rem] leading-tight font-semibold tracking-tight">{db.name}</h1>
            <StatusBadge status={db.state} />
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {[['Engine', `PostgreSQL ${db.pg}`], ['Compute', `${size.label}, ${size.vcpu} vCPU, ${size.memGb} GB`], ['Idle suspend', db.autosuspendMin ? `After ${db.autosuspendMin} min` : 'Never'], ['Created', db.created], ['Runs', 'On this device']].map(([k, v]) => (
              <div key={k} className="flex gap-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={toggle} disabled={db.state === 'provisioning'}>{running ? <><Pause /> Suspend</> : <><Play /> Resume</>}</Button>
          <Button onClick={() => nav('/sql')}><Code2 /> Open SQL editor</Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(t) => nav(`/databases/${db.name}/${t}`)}>
        <TabsList variant="line" className="mb-6 h-10 w-full justify-start gap-1 border-b p-0">
          {TABS.map(([id, label]) => <TabsTrigger key={id} value={id} className="flex-none px-2.5">{label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="connect"><Connect /></TabsContent>
        <TabsContent value="keys"><ApiKeys /></TabsContent>
        <TabsContent value="compute"><Compute /></TabsContent>
        <TabsContent value="observability"><Observability /></TabsContent>
        <TabsContent value="roles"><Roles /></TabsContent>
        <TabsContent value="extensions"><Extensions /></TabsContent>
        <TabsContent value="backups"><Backups /></TabsContent>
        <TabsContent value="settings"><Settings /></TabsContent>
      </Tabs>
    </>
  )
}
