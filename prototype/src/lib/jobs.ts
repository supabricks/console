// Scheduled jobs: a notebook or a saved query run unattended.
export type JobTask = { kind: 'notebook' | 'query'; ref: string; engine?: 'PostgreSQL' | 'Spark'; follow: 'pinned' | 'latest'; revision: string }
export type JobTrigger =
  | { kind: 'schedule'; every: 'minutes' | 'hourly' | 'daily' | 'weekly' | 'cron'; minutes?: number; at?: string; days?: string[]; cron?: string }
  | { kind: 'pipeline'; pipeline: string }
  | { kind: 'manual' }
export type Job = {
  id: string; name: string; description: string; task: JobTask; trigger: JobTrigger; params: [string, string][]
  timeoutMin: number; retries: number; retryWaitMin: number; overlap: 'skip' | 'queue'; runAs: string; notify: string[]
  state: 'active' | 'paused'; created: string; nextRun: string | null
}
export type RunState = 'succeeded' | 'failed' | 'running' | 'queued' | 'cancelled' | 'skipped'
export type JobRun = { id: string; job: string; n: number; trigger: 'Schedule' | 'Manual' | 'After sync' | 'Retry'; state: RunState; started: string; seconds: number; attempt: number; version: number | null; by: string; error?: string; rows?: number }

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const REVISIONS: Record<string, string> = { 'revenue-exploration.ipynb': '4e1a09c', 'churn-features.ipynb': 'b72d5f1', 'getting-started.ipynb': '0c9e3a8', 'Revenue by region': 'q1 r6', 'Daily orders (30 days)': 'q2 r3', 'Find customer by email': 'q3 r1', 'Largest tables': 'q4 r2' }

export const JOBS: Job[] = [
  { id: 'job_nightly', name: 'nightly-revenue-report', description: 'Rebuilds the revenue summary every night after the day closes.', task: { kind: 'notebook', ref: 'revenue-exploration.ipynb', follow: 'pinned', revision: '4e1a09c' }, trigger: { kind: 'schedule', every: 'daily', at: '02:30' }, params: [['report_date', '{{ run.date }}'], ['region', 'all']], timeoutMin: 30, retries: 2, retryWaitMin: 5, overlap: 'skip', runAs: 'sv_nightly', notify: ['gr_analysts'], state: 'active', created: '2026-09-18', nextRun: 'Oct 11, 02:30' },
  { id: 'job_churn', name: 'churn-features-refresh', description: 'Recomputes churn features whenever new data is published from app / main.', task: { kind: 'notebook', ref: 'churn-features.ipynb', follow: 'latest', revision: 'b72d5f1' }, trigger: { kind: 'pipeline', pipeline: 'pl_19ab55d3' }, params: [['lookback_days', '90']], timeoutMin: 60, retries: 1, retryWaitMin: 10, overlap: 'skip', runAs: 'sv_nightly', notify: ['pr_priya'], state: 'active', created: '2026-09-30', nextRun: 'After the next sync' },
  { id: 'job_region', name: 'revenue-by-region-hourly', description: 'Keeps the regional revenue query result fresh for the sales dashboard.', task: { kind: 'query', ref: 'Revenue by region', engine: 'Spark', follow: 'pinned', revision: 'q1 r6' }, trigger: { kind: 'schedule', every: 'hourly', at: '00:05' }, params: [], timeoutMin: 5, retries: 0, retryWaitMin: 1, overlap: 'skip', runAs: 'sv_nightly', notify: [], state: 'active', created: '2026-10-02', nextRun: 'Today, 15:05' },
  { id: 'job_tables', name: 'weekly-table-sizes', description: 'Records the ten largest tables every Monday.', task: { kind: 'query', ref: 'Largest tables', engine: 'PostgreSQL', follow: 'latest', revision: 'q4 r2' }, trigger: { kind: 'schedule', every: 'weekly', at: '06:00', days: ['Mon'] }, params: [], timeoutMin: 5, retries: 0, retryWaitMin: 1, overlap: 'skip', runAs: 'sv_ci', notify: [], state: 'paused', created: '2026-08-25', nextRun: null },
]

const ERR = 'AnalysisException: [UNRESOLVED_COLUMN] A column named `loyalty_points` cannot be resolved. Did you mean one of: `amount`, `status`, `placed_at`?'
const mk = (job: string, n: number, state: RunState, started: string, seconds: number, extra: Partial<JobRun> = {}): JobRun => ({ id: `run_${job.slice(4, 7)}${n}`, job, n, trigger: 'Schedule', state, started, seconds, attempt: 1, version: 4169 - (300 - n) * 3, by: 'Schedule', ...extra })
export const JOB_RUNS: JobRun[] = [
  mk('job_region', 212, 'running', 'Oct 10, 14:05', 14, { version: 4169 }),
  mk('job_region', 211, 'succeeded', 'Oct 10, 13:05', 21, { rows: 4, version: 4161 }),
  mk('job_churn', 58, 'succeeded', 'Oct 10, 13:54', 412, { trigger: 'After sync', by: 'Sync on app / staging', version: 2210 }),
  mk('job_region', 210, 'succeeded', 'Oct 10, 12:05', 19, { rows: 4, version: 4150 }),
  mk('job_region', 209, 'skipped', 'Oct 10, 11:05', 0, { version: null, error: 'Both analytical session slots were in use for the whole start window.' }),
  mk('job_region', 208, 'succeeded', 'Oct 10, 10:05', 23, { rows: 4, version: 4127 }),
  mk('job_nightly', 23, 'failed', 'Oct 10, 02:40', 96, { attempt: 3, trigger: 'Retry', error: ERR, version: 4020 }),
  mk('job_nightly', 23, 'failed', 'Oct 10, 02:35', 94, { attempt: 2, trigger: 'Retry', error: ERR, version: 4019, id: 'run_nig23b' }),
  mk('job_nightly', 23, 'failed', 'Oct 10, 02:30', 101, { error: ERR, version: 4018, id: 'run_nig23a' }),
  mk('job_churn', 57, 'succeeded', 'Oct 10, 01:39', 398, { trigger: 'After sync', by: 'Sync on app / staging', version: 2204 }),
  mk('job_nightly', 22, 'succeeded', 'Oct 9, 02:30', 318, { version: 3610 }),
  mk('job_churn', 56, 'cancelled', 'Oct 9, 13:24', 1260, { trigger: 'Manual', by: 'Priya Raman', version: 2190, error: 'Stopped by Priya Raman.' }),
  mk('job_nightly', 21, 'succeeded', 'Oct 8, 02:30', 301, { version: 3201 }),
  mk('job_nightly', 20, 'succeeded', 'Oct 7, 02:30', 296, { version: 2790 }),
  mk('job_nightly', 19, 'succeeded', 'Oct 6, 02:30', 322, { version: 2377 }),
  mk('job_tables', 6, 'succeeded', 'Oct 5, 06:00', 2, { rows: 10, version: null }),
  mk('job_nightly', 18, 'succeeded', 'Oct 5, 02:30', 288, { version: 1968 }),
]

export const fmtDur = (s: number) => (s === 0 ? '' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`)
export function describeTrigger(t: JobTrigger, pipelineName?: (id: string) => string): string {
  if (t.kind === 'manual') return 'Only when started by hand'
  if (t.kind === 'pipeline') return `After each sync of ${pipelineName?.(t.pipeline) ?? 'a pipeline'}`
  if (t.every === 'minutes') return `Every ${t.minutes} minutes`
  if (t.every === 'hourly') return `Every hour at ${t.at?.slice(3)} minutes past`
  if (t.every === 'daily') return `Every day at ${t.at} UTC`
  if (t.every === 'weekly') return `Every ${t.days?.length === 7 ? 'day' : t.days?.join(', ')} at ${t.at} UTC`
  return `Cron ${t.cron} (UTC)`
}
/** The next three start times for a schedule, from the prototype's "now" of Oct 10, 14:05 UTC. */
export function nextRuns(t: JobTrigger): string[] {
  if (t.kind !== 'schedule') return []
  const now = Date.UTC(2026, 9, 10, 14, 5), M = 60000, out: number[] = []
  const [h, m] = (t.at ?? '00:00').split(':').map(Number)
  const day = (d: number) => Date.UTC(2026, 9, 10 + d, h, m)
  if (t.every === 'minutes') { const s = (t.minutes ?? 15) * M; for (let x = Math.ceil((now + 1) / s) * s; out.length < 3; x += s) out.push(x) }
  else if (t.every === 'hourly') { for (let x = Date.UTC(2026, 9, 10, 14, m); out.length < 3; x += 60 * M) if (x > now) out.push(x) }
  else if (t.every === 'daily') { for (let d = 0; out.length < 3; d++) if (day(d) > now) out.push(day(d)) }
  else if (t.every === 'weekly') { for (let d = 0; out.length < 3 && d < 30; d++) if (day(d) > now && (t.days ?? []).includes(DAYS[(new Date(day(d)).getUTCDay() + 6) % 7])) out.push(day(d)) }
  else return ['Worked out by the server from the expression']
  return out.map((x) => { const d = new Date(x); return `${DAYS[(d.getUTCDay() + 6) % 7]} Oct ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` })
}
