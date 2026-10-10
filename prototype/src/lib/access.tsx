import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// Identity belongs to the installation; roles and grants belong to a project.
export type Principal = { id: string; kind: 'user' | 'service'; label: string; email?: string; subject?: string; disabled: boolean; lastSeen?: string; invited?: boolean; created: string }
export type Group = { id: string; label: string; members: string[] }
export type Subject = { kind: 'principal' | 'group'; id: string }
export type Role = 'viewer' | 'editor' | 'administrator'
export type RoleBinding = { subject: Subject; role: Role }
export type Capability = 'read' | 'write' | 'ddl' | 'copy_source' | 'receive' | 'share' | 'read_sync' | 'execute_sync' | 'manage_sync'
export type DataGrant = { subject: Subject; db: string; branch: string; caps: Capability[] }
export type RunKind = 'execute' | 'stop_any' | 'act_as'
export type RunGrant = { id: string; subject: Subject; grant: RunKind; as?: string; source?: string }
export type CatalogGrant = { subject: Subject; publication: string; tables: string[] }
export type Token = { id: string; principal: string; scopes: string[]; issued: string; expiresMin: number }
export type WebSession = { id: string; principal: string; channel: 'Browser' | 'Service token'; started: string; expires: string; from: string }
export type AuditEvent = { seq: number; at: string; scope: 'installation' | 'project'; actor: string; as?: string; action: string; target: string; policy?: number; denied?: boolean }

export const ME = 'pr_maya'
export const PROJECT = 'sales-analytics'
export const ISSUER = 'https://identity.internal.example/realms/company'

export const ROLE_INFO: Record<Role, { label: string; summary: string; can: string[] }> = {
  viewer: { label: 'Viewer', summary: 'Read the project.', can: ['Open the project, its notebooks, saved queries and run results', 'See catalog tables they have been granted'] },
  editor: { label: 'Editor', summary: 'Change and run work.', can: ['Everything a viewer can', 'Save notebooks and queries', 'Start runs they have permission for, and stop their own'] },
  administrator: { label: 'Administrator', summary: 'Manage access.', can: ['Everything an editor can', 'Assign roles in this project', 'Read the access policy'] },
}

export const CAPS: { id: Capability; label: string; group: 'Rows' | 'Sharing' | 'Sync'; help: string }[] = [
  { id: 'read', label: 'Read', group: 'Rows', help: 'Run read-only SQL and browse tables on this branch.' },
  { id: 'write', label: 'Write', group: 'Rows', help: 'Insert, update and delete rows.' },
  { id: 'ddl', label: 'Change schema', group: 'Rows', help: 'Create, alter and drop tables and other objects.' },
  { id: 'copy_source', label: 'Copy from', group: 'Sharing', help: 'Use this branch as the source when copying data to another branch.' },
  { id: 'receive', label: 'Receive', group: 'Sharing', help: 'Load imported or copied data into this branch.' },
  { id: 'share', label: 'Publish', group: 'Sharing', help: 'Publish this branch’s analytical tables for other projects.' },
  { id: 'read_sync', label: 'See sync', group: 'Sync', help: 'See the sync pipeline, its runs and its lag.' },
  { id: 'execute_sync', label: 'Run sync', group: 'Sync', help: 'Start a sync run now.' },
  { id: 'manage_sync', label: 'Manage sync', group: 'Sync', help: 'Create, change, pause and delete the pipeline.' },
]

export const RUN_INFO: Record<RunKind, { label: string; help: string }> = {
  execute: { label: 'Run notebooks', help: 'Start a notebook run under their own identity.' },
  stop_any: { label: 'Stop anyone’s run', help: 'Stop a run started by somebody else.' },
  act_as: { label: 'Run as another identity', help: 'Run one saved revision of a notebook as another identity, usually a service account.' },
}

const PRINCIPALS: Principal[] = [
  { id: 'pr_maya', kind: 'user', label: 'Maya Okafor', email: 'maya.okafor@example.com', subject: '8c1f0a52-3b7e-4f0d-9a61-2f4d7be0c911', disabled: false, lastSeen: 'Now', created: '2026-07-01' },
  { id: 'pr_daniel', kind: 'user', label: 'Daniel Reyes', email: 'daniel.reyes@example.com', subject: '1e44b7c9-52a0-4d18-8e3f-70c5a9d2b604', disabled: false, lastSeen: '18 minutes ago', created: '2026-07-03' },
  { id: 'pr_priya', kind: 'user', label: 'Priya Raman', email: 'priya.raman@example.com', subject: 'a7305e1d-9c2b-46f8-b1d4-5e8f03c7a2d9', disabled: false, lastSeen: '2 hours ago', created: '2026-07-14' },
  { id: 'pr_tomas', kind: 'user', label: 'Tomás Silva', email: 'tomas.silva@example.com', subject: '5d92c8f4-0e6a-4b31-a7c5-9b1e4f62d083', disabled: false, lastSeen: 'Yesterday', created: '2026-08-20' },
  { id: 'pr_kenji', kind: 'user', label: 'Kenji Mori', email: 'kenji.mori@example.com', subject: 'c0b6e37a-8d15-4e92-93f0-a46d1c7e5b28', disabled: false, lastSeen: '3 days ago', created: '2026-09-02' },
  { id: 'pr_hannah', kind: 'user', label: 'Hannah Weiss', email: 'hannah.weiss@example.com', subject: 'f29a4d60-71c3-4a8b-8e05-3d7b6c1f9e42', disabled: true, lastSeen: 'Sep 12', created: '2026-07-09' },
  { id: 'sv_nightly', kind: 'service', label: 'nightly-reports', disabled: false, created: '2026-08-18' },
  { id: 'sv_ci', kind: 'service', label: 'ci-deploy', disabled: false, created: '2026-09-05' },
]
const GROUPS: Group[] = [
  { id: 'gr_analysts', label: 'analysts', members: ['pr_priya', 'pr_tomas', 'pr_kenji'] },
  { id: 'gr_platform', label: 'platform-engineers', members: ['pr_maya', 'pr_daniel'] },
  { id: 'gr_finance', label: 'finance', members: ['pr_kenji'] },
]
const P = (id: string): Subject => ({ kind: 'principal', id })
const G = (id: string): Subject => ({ kind: 'group', id })
const ROLES: RoleBinding[] = [
  { subject: P('pr_maya'), role: 'administrator' },
  { subject: G('gr_platform'), role: 'editor' },
  { subject: G('gr_analysts'), role: 'editor' },
  { subject: G('gr_finance'), role: 'viewer' },
  { subject: P('sv_nightly'), role: 'viewer' },
  { subject: P('sv_ci'), role: 'editor' },
]
const DATA: DataGrant[] = [
  { subject: G('gr_platform'), db: 'db_app', branch: 'main', caps: ['read', 'write', 'ddl', 'copy_source', 'receive', 'share', 'read_sync', 'execute_sync', 'manage_sync'] },
  { subject: G('gr_analysts'), db: 'db_app', branch: 'main', caps: ['read', 'copy_source', 'read_sync'] },
  { subject: P('sv_nightly'), db: 'db_app', branch: 'main', caps: ['read', 'read_sync', 'execute_sync'] },
  { subject: G('gr_platform'), db: 'db_app', branch: 'staging', caps: ['read', 'write', 'ddl', 'copy_source', 'receive', 'read_sync', 'execute_sync', 'manage_sync'] },
  { subject: G('gr_analysts'), db: 'db_app', branch: 'staging', caps: ['read', 'write', 'receive'] },
  { subject: P('sv_ci'), db: 'db_app', branch: 'staging', caps: ['read', 'write', 'ddl', 'receive'] },
  { subject: P('pr_daniel'), db: 'db_app', branch: 'feature/loyalty-points', caps: ['read', 'write', 'ddl', 'receive', 'read_sync', 'manage_sync'] },
  { subject: G('gr_platform'), db: 'db_billing', branch: 'main', caps: ['read', 'write', 'ddl', 'read_sync', 'manage_sync'] },
  { subject: G('gr_finance'), db: 'db_billing', branch: 'main', caps: ['read'] },
]
const RUNS: RunGrant[] = [
  { id: 'rg_1', subject: G('gr_analysts'), grant: 'execute' },
  { id: 'rg_2', subject: G('gr_platform'), grant: 'execute' },
  { id: 'rg_3', subject: G('gr_platform'), grant: 'stop_any' },
  { id: 'rg_5', subject: P('sv_nightly'), grant: 'execute' },
  { id: 'rg_4', subject: P('pr_priya'), grant: 'act_as', as: 'sv_nightly', source: 'revenue-exploration.ipynb @ 4e1a09c' },
]
const CATALOG: CatalogGrant[] = [
  { subject: G('gr_analysts'), publication: 'pub_3f9a12c0', tables: ['customers', 'orders', 'order_items'] },
  { subject: G('gr_finance'), publication: 'pub_3f9a12c0', tables: ['orders'] },
  { subject: P('sv_nightly'), publication: 'pub_3f9a12c0', tables: ['orders', 'order_items'] },
]
const TOKENS: Token[] = [{ id: 'tk_91c2', principal: 'sv_nightly', scopes: ['self', 'control'], issued: '13:42', expiresMin: 37 }]
const SESSIONS: WebSession[] = [
  { id: 'ws_a41f', principal: 'pr_maya', channel: 'Browser', started: 'Today 09:02', expires: 'in 7 h', from: '10.20.4.18' },
  { id: 'ws_77b0', principal: 'pr_daniel', channel: 'Browser', started: 'Today 13:41', expires: 'in 11 h', from: '10.20.4.63' },
  { id: 'ws_c2e9', principal: 'pr_priya', channel: 'Browser', started: 'Today 11:55', expires: 'in 9 h', from: '10.20.7.102' },
  { id: 'ws_0d38', principal: 'sv_nightly', channel: 'Service token', started: 'Today 13:42', expires: 'in 37 min', from: '10.20.1.9' },
]
const AUDIT: AuditEvent[] = [
  { seq: 1184, at: 'Oct 10, 13:58', scope: 'project', actor: 'pr_priya', as: 'sv_nightly', action: 'execution.admit', target: 'revenue-exploration.ipynb @ 4e1a09c', policy: 42 },
  { seq: 1183, at: 'Oct 10, 13:51', scope: 'project', actor: 'pr_tomas', action: 'data.write', target: 'app / main', policy: 42, denied: true },
  { seq: 1182, at: 'Oct 10, 13:42', scope: 'installation', actor: 'pr_maya', action: 'service.issue', target: 'nightly-reports' },
  { seq: 1181, at: 'Oct 10, 13:41', scope: 'installation', actor: 'pr_daniel', action: 'session.begin', target: 'Browser' },
  { seq: 1180, at: 'Oct 10, 12:20', scope: 'project', actor: 'pr_daniel', action: 'source.save', target: 'churn-features.ipynb', policy: 42 },
  { seq: 1179, at: 'Oct 10, 11:07', scope: 'project', actor: 'pr_maya', action: 'policy.data_grant', target: 'analysts on app / staging: write', policy: 41 },
  { seq: 1178, at: 'Oct 10, 11:02', scope: 'project', actor: 'pr_maya', action: 'policy.role', target: 'group finance: viewer', policy: 40 },
  { seq: 1177, at: 'Oct 10, 10:48', scope: 'project', actor: 'pr_kenji', action: 'execution.cancel', target: 'run ex_5b20', policy: 39, denied: true },
  { seq: 1176, at: 'Oct 9, 17:30', scope: 'project', actor: 'pr_maya', action: 'catalog.grant', target: 'finance: sales_analytics.app.orders', policy: 39 },
  { seq: 1175, at: 'Oct 9, 16:12', scope: 'installation', actor: 'pr_maya', action: 'group.membership', target: 'Kenji Mori added to finance' },
  { seq: 1174, at: 'Oct 9, 09:15', scope: 'project', actor: 'sv_ci', action: 'data.ddl', target: 'app / staging', policy: 38 },
  { seq: 1173, at: 'Sep 12, 18:04', scope: 'installation', actor: 'pr_maya', action: 'principal.disable', target: 'Hannah Weiss' },
  { seq: 1172, at: 'Sep 12, 18:04', scope: 'installation', actor: 'pr_maya', action: 'session.revoke', target: 'Hannah Weiss' },
  { seq: 1171, at: 'Sep 5, 10:21', scope: 'installation', actor: 'pr_maya', action: 'service.create', target: 'ci-deploy' },
]

export const sameSubject = (a: Subject, b: Subject) => a.kind === b.kind && a.id === b.id
export const subjectKey = (s: Subject) => `${s.kind}:${s.id}`
export const parseSubject = (k: string): Subject => { const [kind, id] = k.split(':'); return { kind: kind as Subject['kind'], id } }
export const initials = (label: string) => label.split(/[\s-]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const RANK: Record<Role, number> = { viewer: 1, editor: 2, administrator: 3 }

type Access = {
  principals: Principal[]; groups: Group[]; roles: RoleBinding[]; data: DataGrant[]; runs: RunGrant[]; catalog: CatalogGrant[]; tokens: Token[]; sessions: WebSession[]; audit: AuditEvent[]; policy: number
  setPrincipals: (fn: (p: Principal[]) => Principal[]) => void
  setGroups: (fn: (g: Group[]) => Group[]) => void
  setTokens: (fn: (t: Token[]) => Token[]) => void
  setSessions: (fn: (s: WebSession[]) => WebSession[]) => void
  /** A project policy change: bumps the policy revision and writes an audit entry. */
  change: (action: string, target: string, fn: (s: { roles: RoleBinding[]; data: DataGrant[]; runs: RunGrant[]; catalog: CatalogGrant[] }) => Partial<{ roles: RoleBinding[]; data: DataGrant[]; runs: RunGrant[]; catalog: CatalogGrant[] }>) => void
  /** An installation change: writes an audit entry only. */
  log: (action: string, target: string) => void
  name: (s: Subject | string) => string
  principal: (id: string) => Principal | undefined
  groupsOf: (principalId: string) => Group[]
  /** Everything a person holds in this project, with where each came from. */
  effective: (principalId: string) => { role: Role | null; roleVia: string; data: { db: string; branch: string; caps: Capability[] }[]; runs: { grant: RunGrant; via: string }[]; tables: string[] }
}

const Ctx = createContext<Access | null>(null)

export function AccessProvider({ children }: { children: ReactNode }) {
  const [principals, setP] = useState(PRINCIPALS)
  const [groups, setG] = useState(GROUPS)
  const [pol, setPol] = useState({ roles: ROLES, data: DATA, runs: RUNS, catalog: CATALOG, policy: 42 })
  const [tokens, setT] = useState(TOKENS)
  const [sessions, setS] = useState(SESSIONS)
  const [audit, setA] = useState(AUDIT)

  const value = useMemo<Access>(() => {
    const principal = (id: string) => principals.find((p) => p.id === id)
    const name = (s: Subject | string) => {
      const id = typeof s === 'string' ? s : s.id
      return principal(id)?.label ?? groups.find((g) => g.id === id)?.label ?? id
    }
    const groupsOf = (id: string) => groups.filter((g) => g.members.includes(id))
    const entry = (scope: AuditEvent['scope'], action: string, target: string, policy?: number) =>
      setA((a) => [{ seq: a[0].seq + 1, at: 'Just now', scope, actor: ME, action, target, policy }, ...a])
    return {
      principals, groups, tokens, sessions, audit, ...pol,
      setPrincipals: (fn) => setP(fn), setGroups: (fn) => setG(fn), setTokens: (fn) => setT(fn), setSessions: (fn) => setS(fn),
      change: (action, target, fn) => { setPol((s) => ({ ...s, ...fn(s), policy: s.policy + 1 })); entry('project', action, target, pol.policy + 1) },
      log: (action, target) => entry('installation', action, target),
      name, principal, groupsOf,
      effective: (id) => {
        const mine: { s: Subject; via: string }[] = [{ s: { kind: 'principal', id }, via: 'Direct' }, ...groupsOf(id).map((g) => ({ s: { kind: 'group' as const, id: g.id }, via: `Group ${g.label}` }))]
        const via = (s: Subject) => mine.find((m) => sameSubject(m.s, s))?.via
        let role: Role | null = null, roleVia = ''
        for (const b of pol.roles) { const v = via(b.subject); if (v && (!role || RANK[b.role] > RANK[role])) { role = b.role; roleVia = v } }
        const byBranch = new Map<string, { db: string; branch: string; caps: Capability[] }>()
        for (const g of pol.data) if (via(g.subject)) {
          const k = `${g.db}/${g.branch}`, cur = byBranch.get(k) ?? { db: g.db, branch: g.branch, caps: [] }
          cur.caps = CAPS.map((c) => c.id).filter((c) => cur.caps.includes(c) || g.caps.includes(c)); byBranch.set(k, cur)
        }
        const tables = new Set<string>()
        for (const g of pol.catalog) if (via(g.subject)) g.tables.forEach((t) => tables.add(t))
        return { role, roleVia, data: [...byBranch.values()], runs: pol.runs.filter((r) => via(r.subject)).map((grant) => ({ grant, via: via(grant.subject)! })), tables: [...tables] }
      },
    }
  }, [principals, groups, pol, tokens, sessions, audit])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAccess() {
  const a = useContext(Ctx)
  if (!a) throw new Error('AccessProvider missing')
  return a
}
