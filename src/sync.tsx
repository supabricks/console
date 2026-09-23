import { useEffect, useRef, useState } from "react";
import { analytics } from "./api";

export type SyncConfig = {
  limits?: { max_bytes: number; timeout_ms: number };
  mode: "snapshot" | "triggered" | "continuous";
  strategy: "full" | "incremental";
  schedule: {
    interval_seconds: number;
    timezone: "UTC";
    missed_run: "coalesce";
  } | null;
  continuous?: { freshness_ms: number; batch_interval_ms: number };
};
export type SyncCommand =
  | { kind: "list" }
  | { kind: "inspect"; branch: string }
  | { kind: "get" | "review_resync"; id: string }
  | { kind: "runs"; id: string; limit: number }
  | { kind: "create"; branch: string; config: SyncConfig; key: string }
  | {
      kind: "update";
      id: string;
      config: SyncConfig;
      expected_revision: number;
      key: string;
    }
  | {
      kind: "pause" | "resume" | "delete" | "run_now";
      id: string;
      expected_revision: number;
      key: string;
    }
  | {
      kind: "resync";
      id: string;
      expected_revision: number;
      review_hash: string;
      key: string;
    }
  | { kind: "cancel"; id: string; key: string };
type Metrics = {
  state: string;
  error?: string;
  observed_at_ms?: number;
  captured_lsn?: string;
  published_lsn?: string;
  source_lsn?: string;
  spool_bytes?: number;
  retained_wal_bytes?: number;
  oldest_unpublished_commit_age_ms?: number | null;
  lag_observed_at_ms?: number;
  backlog_bytes?: number | null;
  capture_keeps_compute_awake?: boolean;
};
type Policy = {
  id: string;
  branch_id: string;
  revision: number;
  state: string;
  config: SyncConfig;
  last_success_at_ms?: number;
  next_due_at_ms?: number;
  last_epoch_id?: string;
  error?: string;
  pause_requested: boolean;
  authority_status?: string;
  capture_status?: Metrics;
  continuous_status?: Metrics;
};
type Run = {
  id: string;
  state: string;
  trigger: string;
  admitted_at_ms: number;
  epoch_id?: string;
  source_lsn?: string;
  refresh_id?: string;
  published_artifact_id?: string;
  error?: string;
};
type Review = {
  policy_id: string;
  expected_revision: number;
  review_hash: string;
  effect: string;
};
type Inspection = {
  source_available: boolean;
  source_qualification: string;
  requirements: string[];
};
export type SyncRequest = (
  command: SyncCommand,
  service?: string,
) => Promise<unknown>;
export const localSync: SyncRequest = (command) =>
  analytics({ action: "managed_snapshots", command });
const date = (v?: number) =>
  v == null ? "Unknown" : new Date(v).toLocaleString();
const number = (v?: number | null) =>
  v == null ? "Unknown" : v.toLocaleString();
const active = (state: string) =>
  ["queued", "starting", "running"].includes(state);

export function SyncPanel({
  scope,
  branch,
  capabilities,
  request,
  governed = false,
  onPublication,
}: {
  scope: string;
  branch: string;
  request: SyncRequest;
  governed?: boolean;
  onPublication?: (epoch: string, refresh: string) => void;
  capabilities: {
    sync_controls?: number;
    managed_snapshot_scheduling?: boolean;
    incremental_triggered?: boolean;
    continuous_sync?: boolean;
  };
}) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [mode, setMode] = useState<SyncConfig["mode"]>("snapshot");
  const [interval, setIntervalSeconds] = useState(0);
  const [freshness, setFreshness] = useState(5000);
  const [batch, setBatch] = useState(500);
  const [service, setService] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState<{
    command: SyncCommand;
    service?: string;
  } | null>(null);
  const [deleteReview, setDeleteReview] = useState<number | null>(null);
  const requestRef = useRef(request);
  requestRef.current = request;
  const alive = useRef(true);
  const mutation = useRef(false);
  const enabled = capabilities.sync_controls === 1;
  const refresh = async () => {
    const values = (await requestRef.current({ kind: "list" })) as Policy[];
    const p =
      values.find((p) => p.branch_id === branch && p.state !== "deleted") ??
      null;
    const history = p
      ? ((await requestRef.current({
          kind: "runs",
          id: p.id,
          limit: 20,
        })) as Run[])
      : [];
    if (alive.current) {
      setPolicy(p);
      setRuns(history);
      setConnected(true);
    }
  };
  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    let working = false;
    const tick = async () => {
      if (working || mutation.current) return;
      working = true;
      try {
        await refresh();
      } catch {
        if (alive.current) {
          setConnected(false);
          setError(
            "Sync status unavailable. Refresh before changing the policy; lag is unknown.",
          );
        }
      } finally {
        working = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
    };
  }, [scope, enabled]);
  useEffect(() => {
    if (policy) {
      setMode(policy.config.mode);
      setIntervalSeconds(policy.config.schedule?.interval_seconds ?? 0);
      setFreshness(policy.config.continuous?.freshness_ms ?? 5000);
      setBatch(policy.config.continuous?.batch_interval_ms ?? 500);
    }
    setReview(null);
    setAcknowledged(false);
    setDeleteReview(null);
  }, [policy?.id, policy?.revision]);
  async function send(command: SyncCommand, servicePrincipal?: string) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    const write = "key" in command;
    if (write) setPending({ command, service: servicePrincipal });
    try {
      const value = await requestRef.current(command, servicePrincipal);
      if (!alive.current) return;
      if (command.kind === "inspect") setInspection(value as Inspection);
      if (command.kind === "review_resync") setReview(value as Review);
      if (write) {
        setPending(null);
        setReview(null);
        setDeleteReview(null);
      }
      await refresh();
    } catch (e) {
      if (alive.current)
        setError(
          `${e instanceof Error ? e.message : "Sync request failed"}${write ? " The outcome may be unknown. Inspect status or retry this exact request." : ""}`,
        );
    } finally {
      mutation.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const metrics = policy?.continuous_status ?? policy?.capture_status;
  const revoked = policy?.authority_status === "revoked_or_unavailable";
  const lagKnown =
    connected &&
    metrics?.lag_observed_at_ms != null &&
    Date.now() - metrics.lag_observed_at_ms <= 5000 &&
    Date.now() >= metrics.lag_observed_at_ms;
  const selectedAvailable =
    mode === "snapshot"
      ? capabilities.managed_snapshot_scheduling
      : mode === "triggered"
        ? capabilities.incremental_triggered
        : capabilities.continuous_sync;
  const config: SyncConfig = {
    limits: policy?.config.limits,
    mode,
    strategy: mode === "snapshot" ? "full" : "incremental",
    schedule:
      mode !== "continuous" && interval > 0
        ? {
            interval_seconds: interval,
            timezone: "UTC",
            missed_run: "coalesce",
          }
        : null,
    ...(mode === "continuous"
      ? { continuous: { freshness_ms: freshness, batch_interval_ms: batch } }
      : {}),
  };
  const blocked = busy || !connected || !!pending;
  function control(kind: "pause" | "resume" | "run_now" | "delete") {
    if (policy)
      void send({
        kind,
        id: policy.id,
        expected_revision: policy.revision,
        key: crypto.randomUUID(),
      });
  }
  return (
    <section className="panel sync-panel" aria-label="Managed analytical sync">
      <h2>Managed analytical sync</h2>
      {!enabled ? (
        <p role="status">
          This runtime does not expose managed sync controls. Existing snapshots
          remain available. Upgrade the runtime to configure policies.
        </p>
      ) : (
        <>
          <p>
            Publish PostgreSQL changes for new analytical sessions. Existing SQL
            and notebook sessions keep their selected epoch.
          </p>
          {governed && (
            <p>
              Sync runs use a service identity scoped to this branch. Sharing an
              incremental epoch creates a separate immutable copy for its
              readers.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {pending && (
            <div role="status">
              <p>
                A request needs reconciliation. Retrying uses its original key
                and revision.
              </p>
              <button
                disabled={busy}
                onClick={() => void send(pending.command, pending.service)}
              >
                Retry exact sync request
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setError("");
                }}
              >
                Dismiss retry after inspection
              </button>
            </div>
          )}
          <button
            disabled={busy}
            onClick={() => void send({ kind: "inspect", branch })}
          >
            Inspect sync prerequisites
          </button>
          {inspection && (
            <div>
              <p>
                Source {inspection.source_available ? "running" : "unavailable"}
                . Source schema: {inspection.source_qualification}. Creating a
                policy validates the source before publication.
              </p>
              <ul>
                {inspection.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (blocked) return;
              void send(
                policy
                  ? {
                      kind: "update",
                      id: policy.id,
                      expected_revision: policy.revision,
                      config,
                      key: crypto.randomUUID(),
                    }
                  : {
                      kind: "create",
                      branch,
                      config,
                      key: crypto.randomUUID(),
                    },
                governed && !policy ? service : undefined,
              );
            }}
          >
            <label>
              Sync mode
              <select
                aria-label="Sync mode"
                value={mode}
                disabled={blocked}
                onChange={(e) => {
                  setMode(e.target.value as SyncConfig["mode"]);
                  setAcknowledged(false);
                }}
              >
                <option
                  value="snapshot"
                  disabled={!capabilities.managed_snapshot_scheduling}
                >
                  Snapshot · full copy
                </option>
                <option
                  value="triggered"
                  disabled={!capabilities.incremental_triggered}
                >
                  Triggered · incremental
                  {!capabilities.incremental_triggered ? " (unavailable)" : ""}
                </option>
                <option
                  value="continuous"
                  disabled={!capabilities.continuous_sync}
                >
                  Continuous · incremental
                  {!capabilities.continuous_sync ? " (unavailable)" : ""}
                </option>
              </select>
            </label>
            {mode !== "continuous" ? (
              <label>
                Schedule interval in seconds (0 = manual)
                <input
                  aria-label="Sync schedule seconds"
                  type="number"
                  min="0"
                  max="2592000"
                  value={interval}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                />
              </label>
            ) : (
              <>
                <label>
                  Desired freshness in milliseconds
                  <input
                    aria-label="Sync freshness milliseconds"
                    type="number"
                    min="1000"
                    max="300000"
                    value={freshness}
                    onChange={(e) => setFreshness(Number(e.target.value))}
                  />
                </label>
                <label>
                  Minimum batch interval in milliseconds
                  <input
                    aria-label="Sync batch milliseconds"
                    type="number"
                    min="200"
                    max="60000"
                    value={batch}
                    onChange={(e) => setBatch(Number(e.target.value))}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  I understand continuous sync keeps compute awake and uses
                  bounded WAL, disk and memory. Desired freshness is not a
                  latency guarantee.
                </label>
              </>
            )}
            {mode !== "snapshot" && (
              <p>
                Capture retains source history, including while publication is
                paused. One capture per installation; default spool and WAL
                budgets are 512 MiB each. History loss requires a reviewed full
                bootstrap.
              </p>
            )}
            {governed && !policy && (
              <label>
                Service principal ID
                <input
                  aria-label="Sync service principal"
                  required
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                />
                <span>
                  The service needs project membership, source Read and Execute
                  sync. Managers need Read and Manage sync; status requires Read
                  sync.
                </span>
              </label>
            )}
            <button
              className="button primary"
              disabled={
                blocked ||
                revoked ||
                !selectedAvailable ||
                (mode === "continuous" && !acknowledged) ||
                (interval > 0 && interval < 60) ||
                (mode === "continuous" && batch > freshness)
              }
            >
              {policy ? "Save sync settings" : "Create sync policy"}
            </button>
          </form>
          {policy && (
            <>
              <dl className="sync-status">
                <dt>Policy</dt>
                <dd>
                  <code>{policy.id}</code> · Revision {policy.revision}
                </dd>
                <dt>State</dt>
                <dd>
                  {connected
                    ? policy.state === "blocked"
                      ? "blocked"
                      : policy.pause_requested
                        ? "pausing"
                        : (metrics?.state ?? policy.state)
                    : "unavailable"}
                </dd>
                <dt>Last success</dt>
                <dd>{date(policy.last_success_at_ms)}</dd>
                <dt>Next scheduled run</dt>
                <dd>
                  {policy.next_due_at_ms == null
                    ? "None"
                    : date(policy.next_due_at_ms)}
                </dd>
                <dt>Published epoch</dt>
                <dd>
                  <code>{policy.last_epoch_id ?? "None"}</code>
                </dd>
                <dt>Captured / published boundary</dt>
                <dd>
                  {metrics?.captured_lsn ?? "Unknown"} /{" "}
                  {metrics?.published_lsn ?? "Unknown"}
                </dd>
                <dt>Source observation</dt>
                <dd>
                  {date(metrics?.observed_at_ms)} ·{" "}
                  {metrics?.source_lsn ?? "Unknown boundary"}
                </dd>
                <dt>Oldest unpublished commit age</dt>
                <dd>
                  {lagKnown
                    ? `${number(metrics?.oldest_unpublished_commit_age_ms)} ms`
                    : "Unknown"}
                </dd>
                <dt>Lag observation</dt>
                <dd>{date(metrics?.lag_observed_at_ms)}</dd>
                <dt>Backlog / spool / retained WAL bytes</dt>
                <dd>
                  {number(connected ? metrics?.backlog_bytes : null)} /{" "}
                  {number(metrics?.spool_bytes)} /{" "}
                  {number(metrics?.retained_wal_bytes)}
                </dd>
              </dl>
              {(policy.error || metrics?.error) && (
                <p role="status">{policy.error ?? metrics?.error}</p>
              )}
              <div className="sync-actions">
                {policy.config.mode !== "continuous" && (
                  <button
                    disabled={
                      blocked ||
                      policy.state !== "active" ||
                      runs.some((r) => active(r.state))
                    }
                    onClick={() => control("run_now")}
                  >
                    Run sync now
                  </button>
                )}
                <button
                  disabled={
                    blocked ||
                    policy.state !== "active" ||
                    policy.pause_requested
                  }
                  onClick={() => control("pause")}
                >
                  Pause sync
                </button>
                <button
                  disabled={
                    blocked ||
                    revoked ||
                    policy.pause_requested ||
                    (policy.state === "active" && !policy.error)
                  }
                  onClick={() => control("resume")}
                >
                  Resume sync
                </button>
                {policy.config.mode !== "snapshot" && (
                  <button
                    disabled={blocked || revoked}
                    onClick={() =>
                      void send({ kind: "review_resync", id: policy.id })
                    }
                  >
                    Review full resync
                  </button>
                )}
                <button
                  disabled={blocked}
                  onClick={() => setDeleteReview(policy.revision)}
                >
                  Delete sync policy…
                </button>
              </div>
              {deleteReview === policy.revision && (
                <div role="status">
                  <p>
                    Stop this policy and retire its capture. Existing
                    publications remain retained for their readers.
                  </p>
                  <button disabled={blocked} onClick={() => control("delete")}>
                    Confirm delete sync policy
                  </button>
                  <button onClick={() => setDeleteReview(null)}>
                    Keep policy
                  </button>
                </div>
              )}
              {review && (
                <div role="status">
                  <p>{review.effect}</p>
                  <button
                    disabled={
                      blocked ||
                      revoked ||
                      review.expected_revision !== policy.revision
                    }
                    onClick={() =>
                      void send({
                        kind: "resync",
                        id: review.policy_id,
                        expected_revision: review.expected_revision,
                        review_hash: review.review_hash,
                        key: crypto.randomUUID(),
                      })
                    }
                  >
                    Approve resync and pause
                  </button>
                </div>
              )}
              <h3>Sync activity</h3>
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Trigger / started</th>
                    <th>State</th>
                    <th>Published epoch / boundary</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.id}</code>
                      </td>
                      <td>
                        {r.trigger}
                        <br />
                        {date(r.admitted_at_ms)}
                      </td>
                      <td>
                        {r.state}
                        {r.error && <p>{r.error}</p>}
                      </td>
                      <td>
                        <code>{r.epoch_id ?? "None"}</code>
                        <br />
                        {r.source_lsn ?? "Unknown"}
                      </td>
                      <td>
                        {active(r.state) && (
                          <button
                            disabled={blocked}
                            onClick={() =>
                              void send({
                                kind: "cancel",
                                id: r.id,
                                key: crypto.randomUUID(),
                              })
                            }
                          >
                            Cancel run
                          </button>
                        )}
                        {r.state === "succeeded" &&
                          r.epoch_id &&
                          (r.refresh_id || r.published_artifact_id) &&
                          onPublication && (
                            <button
                              disabled={blocked || revoked}
                              onClick={() =>
                                onPublication(
                                  r.epoch_id!,
                                  (r.refresh_id || r.published_artifact_id)!,
                                )
                              }
                            >
                              Select epoch for sharing review
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!runs.length && <p>No runs have been admitted.</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
