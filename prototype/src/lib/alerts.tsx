import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// Alerts: a fixed set of built-in conditions, evaluated by the platform.
export type Severity = 'critical' | 'warning'
export type Area = 'Sync' | 'Database' | 'Jobs' | 'Backups' | 'Analytics' | 'Services'
export type Rule = { id: string; area: Area; name: string; when: string; unit?: string; value?: number; options?: number[]; severity: Severity; enabled: boolean; notify: string[]; history?: boolean }
export type AlertState = 'open' | 'acknowledged' | 'resolved'
export type AlertEvent = { at: string; text: string }
export type Alert = { id: string; rule: string; title: string; resource: string; to: string; severity: Severity; state: AlertState; opened: string; resolved?: string; detail: string; reading?: string; ackBy?: string; mutedUntil?: string; events: AlertEvent[] }
export type Destination = { id: string; kind: 'webhook' | 'email' | 'people'; name: string; target: string; state: 'ok' | 'failing'; last: string }
export type Delivery = { id: string; at: string; alert: string; destination: string; what: 'Opened' | 'Resolved' | 'Test'; result: string; ok: boolean }

const RULES: Rule[] = [
  { id: 'sync-lag', area: 'Sync', name: 'Sync is behind', when: 'A continuous pipeline is further behind than its freshness target for', unit: 'min', value: 5, options: [1, 5, 15, 30], severity: 'warning', enabled: true, notify: ['ds_ops'], history: true },
  { id: 'sync-failed', area: 'Sync', name: 'Sync run failed or pipeline blocked', when: 'A sync run fails, or a pipeline stops because a table can no longer be synced', severity: 'critical', enabled: true, notify: ['ds_ops', 'ds_platform'] },
  { id: 'sync-budget', area: 'Sync', name: 'Change buffer is filling up', when: 'The change buffer or PostgreSQL log kept for sync is fuller than', unit: '%', value: 80, options: [60, 70, 80, 90], severity: 'warning', enabled: true, notify: ['ds_ops'] },
  { id: 'db-storage', area: 'Database', name: 'Storage is nearly full', when: 'The disk holding databases and history is fuller than', unit: '%', value: 85, options: [70, 80, 85, 90, 95], severity: 'critical', enabled: true, notify: ['ds_ops', 'ds_platform'] },
  { id: 'db-conn', area: 'Database', name: 'Connections are nearly exhausted', when: 'A database uses more of its connection limit than', unit: '%', value: 90, options: [70, 80, 90], severity: 'warning', enabled: false, notify: [], history: true },
  { id: 'job-failed', area: 'Jobs', name: 'Job failed', when: 'A job run fails after its last retry', severity: 'critical', enabled: true, notify: ['ds_ops'] },
  { id: 'job-skipped', area: 'Jobs', name: 'Job run skipped', when: 'A scheduled run is skipped because no analytical session slot was free', severity: 'warning', enabled: true, notify: [] },
  { id: 'backup-failed', area: 'Backups', name: 'Backup failed or could not be verified', when: 'A scheduled backup fails, or a finished backup does not pass verification', severity: 'critical', enabled: true, notify: ['ds_ops', 'ds_platform'] },
  { id: 'backup-stale', area: 'Backups', name: 'No recent backup', when: 'A database with a schedule has no verified backup newer than', unit: 'h', value: 36, options: [24, 36, 48, 72], severity: 'warning', enabled: true, notify: ['ds_ops'] },
  { id: 'slots-full', area: 'Analytics', name: 'Analytical sessions are full', when: 'Both analytical session slots have been in use for longer than', unit: 'min', value: 30, options: [10, 30, 60], severity: 'warning', enabled: false, notify: [], history: true },
  { id: 'svc-down', area: 'Services', name: 'A service is unhealthy', when: 'PostgreSQL storage, the analytical engine, the catalog or the notebook runtime stops answering health checks', severity: 'critical', enabled: true, notify: ['ds_ops', 'ds_platform'] },
  { id: 'idp-down', area: 'Services', name: 'Identity provider unreachable', when: 'The identity provider cannot be reached, so nobody can sign in', severity: 'critical', enabled: true, notify: ['ds_platform'] },
]
const ALERTS: Alert[] = [
  { id: 'al_2041', rule: 'job-failed', title: 'Job nightly-revenue-report failed', resource: 'nightly-revenue-report', to: '/jobs/job_nightly', severity: 'critical', state: 'open', opened: 'Oct 10, 02:42', detail: 'Run 23 failed 3 times. AnalysisException: a column named loyalty_points cannot be resolved.', events: [{ at: 'Oct 10, 02:30', text: 'Run 23 failed, attempt 1 of 3' }, { at: 'Oct 10, 02:42', text: 'Last retry failed. Alert opened' }, { at: 'Oct 10, 02:42', text: 'Sent to on-call webhook' }] },
  { id: 'al_2038', rule: 'sync-failed', title: 'Sync pipeline blocked', resource: 'app / feature/loyalty-points', to: '/sync/pl_3d9e7741', severity: 'critical', state: 'acknowledged', opened: 'Oct 9, 11:44', ackBy: 'Daniel Reyes', detail: 'Column orders.loyalty_points has type jsonb, which cannot be synced. The pipeline is stopped until the column is excluded or changed.', events: [{ at: 'Oct 9, 11:42', text: 'Schema change detected on orders' }, { at: 'Oct 9, 11:44', text: 'Pipeline blocked. Alert opened' }, { at: 'Oct 9, 11:44', text: 'Sent to on-call webhook and platform-engineers' }, { at: 'Oct 9, 11:58', text: 'Acknowledged by Daniel Reyes' }] },
  { id: 'al_2040', rule: 'backup-failed', title: 'Backup of app could not be verified', resource: 'app, backup of Oct 5, 02:00', to: '/databases/app/backups', severity: 'critical', state: 'open', opened: 'Oct 5, 02:14', mutedUntil: 'Oct 11, 09:00', detail: 'Verification stopped after reading 61% of the backup. The backup is kept but should not be relied on.', events: [{ at: 'Oct 5, 02:14', text: 'Verification failed. Alert opened' }, { at: 'Oct 5, 02:14', text: 'Sent to on-call webhook and platform-engineers' }, { at: 'Oct 10, 09:00', text: 'Muted for 1 day by Maya Okafor' }] },
  { id: 'al_2042', rule: 'sync-budget', title: 'Change buffer at 83%', resource: 'app / staging', to: '/sync/pl_19ab55d3', severity: 'warning', state: 'open', opened: 'Oct 10, 13:50', reading: '425 of 512 MiB', detail: 'Changes are arriving faster than they are published. At the limit, the pipeline pauses capture until it catches up.', events: [{ at: 'Oct 10, 13:50', text: 'Buffer passed 80%. Alert opened' }, { at: 'Oct 10, 13:50', text: 'Sent to on-call webhook' }] },
  { id: 'al_2039', rule: 'job-skipped', title: 'Run of revenue-by-region-hourly skipped', resource: 'revenue-by-region-hourly', to: '/jobs/job_region', severity: 'warning', state: 'resolved', opened: 'Oct 10, 11:15', resolved: 'Oct 10, 12:05', detail: 'Both analytical session slots were in use for the whole start window.', events: [{ at: 'Oct 10, 11:15', text: 'Run 209 skipped. Alert opened' }, { at: 'Oct 10, 12:05', text: 'Run 210 succeeded. Alert resolved' }] },
  { id: 'al_2031', rule: 'sync-lag', title: 'Sync 4 min 12 s behind', resource: 'app / main', to: '/sync/pl_7c41e0a2', severity: 'warning', state: 'resolved', opened: 'Oct 8, 16:02', resolved: 'Oct 8, 16:19', reading: 'Target 5 s', detail: 'A large backfill on order_items produced more changes than the pipeline could publish in time.', events: [{ at: 'Oct 8, 16:02', text: 'Behind target for 5 minutes. Alert opened' }, { at: 'Oct 8, 16:02', text: 'Sent to on-call webhook' }, { at: 'Oct 8, 16:19', text: 'Caught up. Alert resolved' }, { at: 'Oct 8, 16:19', text: 'Recovery sent to on-call webhook' }] },
  { id: 'al_2027', rule: 'svc-down', title: 'Notebook runtime not answering', resource: 'Notebook runtime', to: '/overview', severity: 'critical', state: 'resolved', opened: 'Oct 6, 08:31', resolved: 'Oct 6, 08:33', detail: 'The runtime was restarted by the supervisor after it stopped answering health checks.', events: [{ at: 'Oct 6, 08:31', text: 'Health check failed 3 times. Alert opened' }, { at: 'Oct 6, 08:33', text: 'Runtime restarted and healthy. Alert resolved' }] },
]
const DESTINATIONS: Destination[] = [
  { id: 'ds_ops', kind: 'webhook', name: 'On-call webhook', target: 'https://hooks.internal.example/oncall/sales-analytics', state: 'ok', last: 'Oct 10, 13:50' },
  { id: 'ds_platform', kind: 'people', name: 'platform-engineers', target: 'Group, shown in the console', state: 'ok', last: 'Oct 9, 11:44' },
  { id: 'ds_finance', kind: 'email', name: 'Finance data owners', target: 'finance-data@example.com', state: 'failing', last: 'Never delivered' },
]
const DELIVERIES: Delivery[] = [
  { id: 'dl_1', at: 'Oct 10, 13:50', alert: 'Change buffer at 83%', destination: 'On-call webhook', what: 'Opened', result: '200 OK in 84 ms', ok: true },
  { id: 'dl_2', at: 'Oct 10, 02:42', alert: 'Job nightly-revenue-report failed', destination: 'On-call webhook', what: 'Opened', result: '200 OK in 91 ms', ok: true },
  { id: 'dl_3', at: 'Oct 9, 11:44', alert: 'Sync pipeline blocked', destination: 'On-call webhook', what: 'Opened', result: '200 OK in 77 ms', ok: true },
  { id: 'dl_4', at: 'Oct 9, 11:44', alert: 'Sync pipeline blocked', destination: 'platform-engineers', what: 'Opened', result: 'Shown to 2 people', ok: true },
  { id: 'dl_5', at: 'Oct 8, 16:19', alert: 'Sync 4 min 12 s behind', destination: 'On-call webhook', what: 'Resolved', result: '200 OK in 80 ms', ok: true },
  { id: 'dl_6', at: 'Oct 8, 16:02', alert: 'Sync 4 min 12 s behind', destination: 'On-call webhook', what: 'Opened', result: '503 after 3 tries, delivered on the 4th', ok: true },
  { id: 'dl_7', at: 'Oct 7, 10:12', alert: 'Test message', destination: 'Finance data owners', what: 'Test', result: 'Email is not set up on this server', ok: false },
]

type Ctx = {
  rules: Rule[]; alerts: Alert[]; destinations: Destination[]; deliveries: Delivery[]
  setRules: (fn: (r: Rule[]) => Rule[]) => void
  setAlerts: (fn: (a: Alert[]) => Alert[]) => void
  setDestinations: (fn: (d: Destination[]) => Destination[]) => void
  setDeliveries: (fn: (d: Delivery[]) => Delivery[]) => void
  /** Open alerts that are neither acknowledged nor muted: what the bell counts. */
  unseen: Alert[]
}
const C = createContext<Ctx | null>(null)
export function AlertsProvider({ children }: { children: ReactNode }) {
  const [rules, setR] = useState(RULES)
  const [alerts, setA] = useState(ALERTS)
  const [destinations, setD] = useState(DESTINATIONS)
  const [deliveries, setL] = useState(DELIVERIES)
  const value = useMemo<Ctx>(() => ({ rules, alerts, destinations, deliveries, setRules: (fn) => setR(fn), setAlerts: (fn) => setA(fn), setDestinations: (fn) => setD(fn), setDeliveries: (fn) => setL(fn), unseen: alerts.filter((a) => a.state === 'open' && !a.mutedUntil) }), [rules, alerts, destinations, deliveries])
  return <C.Provider value={value}>{children}</C.Provider>
}
export function useAlerts() {
  const c = useContext(C)
  if (!c) throw new Error('AlertsProvider missing')
  return c
}
