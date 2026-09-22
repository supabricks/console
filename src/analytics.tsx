import { SyncPanel, localSync } from "./sync";
import type { DataHandoff } from "./data";
import { useEffect, useRef, useState } from "react";
import {
  analytics,
  type AnalyticsCommand,
  type AnalyticalQuery,
  type AnalyticalRefresh,
  type AnalyticalSession,
  type AnalyticalSnapshot,
  type Overview,
} from "./api";
import { Results } from "./workspace";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Analytics request failed";
const terminal = (s: string) =>
  ["published", "failed", "cancelled"].includes(s);
const date = (n?: number) => (n ? new Date(n).toLocaleString() : "Unknown");
function QueryResult({ query }: { query: AnalyticalQuery }) {
  return (
    <div className="analytics-result" data-query-id={query.id}>
      <p>
        Query: <strong>{query.state}</strong> · Epoch{" "}
        <code>{query.epoch_id}</code>
      </p>
      {query.sql && <pre>{query.sql}</pre>}
      {query.error && <p role="alert">{query.error}</p>}
      {query.columns && query.rows && (
        <>
          {query.truncated && (
            <p role="status">
              Result truncated by the row or 256 KiB byte limit.
            </p>
          )}
          <Results
            result={{
              branch_id: "",
              columns: query.columns.map((c) => ({ ...c, oid: 0 })),
              rows: query.rows,
              affected_rows: 0,
              read_only: true,
            }}
          />
        </>
      )}
    </div>
  );
}
export function Analytics({
  data,
  selectedId,
  onSelect,
  visible,
  handoff,
}: {
  data: Overview;
  selectedId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
  handoff?: DataHandoff | null;
}) {
  const branch =
    data.branches.find((b) => b.id === selectedId) ??
    data.branches.find((b) => b.is_default) ??
    data.branches[0];
  const [catalogEpoch, setCatalogEpoch] = useState<string | undefined>();
  const [catalogMode, setCatalogMode] = useState(false);
  useEffect(() => {
    if (handoff) {
      setActive("");
      setSql(handoff.sql);
      setCatalogMode(handoff.catalog);
      setCatalogEpoch(handoff.epoch);
    }
  }, [handoff?.id]);
  const [sessions, setSessions] = useState<AnalyticalSession[]>([]);
  const [active, setActive] = useState("");
  const [snapshot, setSnapshot] = useState<AnalyticalSnapshot | null>(null);
  const [refresh, setRefresh] = useState<AnalyticalRefresh | null>(null);
  const [sql, setSql] = useState("SELECT * FROM _supabricks.epoch");
  const [rows, setRows] = useState(200),
    [timeout, setTimeoutMs] = useState(10000);
  const sequence = useRef(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [comparison, setComparison] = useState<AnalyticalQuery | null>(null);
  const session = sessions.find((s) => s.id === active);
  const state = useRef({ branch, refresh, active });
  state.current = { branch, refresh, active };
  const key = `supabricks.analytics.refresh:${data.data_dir}:${data.project.id}`;
  useEffect(() => {
    const id = sessionStorage.getItem(key);
    if (id)
      analytics<AnalyticalRefresh>({ action: "refresh_status", id })
        .then(setRefresh)
        .catch((e) => setError(message(e)));
  }, [key]);
  useEffect(() => {
    let stopped = false,
      working = false;
    const tick = async () => {
      if (working) return;
      working = true;
      const current = state.current,
        ticket = sequence.current;
      try {
        const values = await analytics<AnalyticalSession[]>({ action: "list" });
        if (current.active && values.some((s) => s.id === current.active)) {
          const value = await analytics<AnalyticalSession>({
            action: "status",
            id: current.active,
          });
          values.splice(
            values.findIndex((s) => s.id === current.active),
            1,
            value,
          );
        }
        if (
          !stopped &&
          ticket === sequence.current &&
          current.active === state.current.active
        )
          setSessions(values);
        if (current.branch) {
          const value = await analytics<AnalyticalSnapshot | null>({
            action: "snapshot",
            target: {
              branch: current.branch.id,
              revision: current.branch.revision,
            },
          });
          if (!stopped && state.current.branch?.id === current.branch.id)
            setSnapshot(value);
        }
        if (current.refresh && !terminal(current.refresh.state)) {
          const value = await analytics<AnalyticalRefresh>({
            action: "refresh_status",
            id: current.refresh.id,
          });
          if (!stopped && state.current.refresh?.id === current.refresh.id)
            setRefresh(value);
        }
      } catch (e) {
        if (!stopped)
          setError(
            `${message(e)} Requests are never replayed automatically. Reconnect to inspect session state.`,
          );
      } finally {
        working = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [data.runtime.generation]);
  useEffect(() => {
    setSnapshot(null);
  }, [branch?.id]);
  const generation = useRef(data.runtime.generation);
  useEffect(() => {
    if (generation.current !== data.runtime.generation) {
      generation.current = data.runtime.generation;
      setActive("");
      setSessions([]);
      setError(
        "Runtime restarted. Previous analytical sessions cannot be rebound; open a new session explicitly. Retained results remain historical.",
      );
    }
  }, [data.runtime.generation]);
  async function action(command: AnalyticsCommand) {
    if (busy) return;
    ++sequence.current;
    setBusy(true);
    setError("");
    try {
      if (command.action === "refresh" || command.action === "cancel_refresh") {
        const value = await analytics<AnalyticalRefresh>(command);
        sessionStorage.setItem(key, value.id);
        setRefresh(value);
      } else {
        const value = await analytics<AnalyticalSession>(command);
        setSessions((ss) => [...ss.filter((s) => s.id !== value.id), value]);
        setActive(value.id);
      }
    } catch (e) {
      setError(
        `${message(e)} Admission may have completed if the response was lost. Inspect sessions before retrying.`,
      );
    } finally {
      ++sequence.current;
      setBusy(false);
    }
  }
  const query = session?.query;
  const canRun =
    !busy && session?.state === "ready" && query?.state !== "running";
  return (
    <section
      hidden={!visible}
      aria-label="Analytical workspace"
      className="analytical-workspace"
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">ANALYTICS · SPARK SQL</span>
          <h1>Query a published snapshot.</h1>
          <p>
            Sail reads a fixed publication. Managed sync publishes new epochs;
            open a new session explicitly to read newer data.
          </p>
        </div>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="panel workspace-controls">
        {catalogEpoch && (
          <p>
            Selected fixed publication epoch: <code>{catalogEpoch}</code>{" "}
            <button onClick={() => setCatalogEpoch(undefined)}>
              Use current publication for new sessions
            </button>
          </p>
        )}
        {data.capabilities.catalog_workspace === 1 && (
          <label>
            New session inputs{" "}
            <select
              aria-label="Analytical input mode"
              value={catalogMode ? "catalog" : "snapshot"}
              onChange={(e) => setCatalogMode(e.target.value === "catalog")}
            >
              <option value="snapshot">Project snapshot</option>
              <option value="catalog">
                Catalog publications and bound datasets
              </option>
            </select>
          </label>
        )}
        <label>
          Snapshot source branch
          <select
            aria-label="Analytics branch"
            value={branch?.id ?? ""}
            onChange={(e) => {
              setCatalogEpoch(undefined);
              onSelect(e.target.value);
            }}
          >
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          disabled={busy || !branch || (!!refresh && !terminal(refresh.state))}
          onClick={() =>
            branch &&
            void action({
              action: "refresh",
              target: { branch: branch.id, revision: branch.revision },
              key: crypto.randomUUID(),
            })
          }
        >
          Publish fresh snapshot
        </button>
        <button
          className="button primary"
          disabled={busy || !branch || (!snapshot && !catalogMode)}
          onClick={() =>
            branch &&
            void action({
              action: "open",
              catalog: catalogMode,
              epoch: catalogMode ? catalogEpoch : undefined,
              target: { branch: branch.id, revision: branch.revision },
              key: crypto.randomUUID(),
            })
          }
        >
          Open latest session
        </button>
        <p>
          Refresh after importing files. JSONB and other unsupported PostgreSQL
          types block publication; no tables are silently skipped.
        </p>
      </div>
      {branch && (
        <SyncPanel
          key={`${data.project.id}:${branch.id}:${data.runtime.generation}`}
          scope={`${data.project.id}:${branch.id}`}
          branch={branch.id}
          capabilities={data.capabilities}
          request={localSync}
        />
      )}
      <div className="panel analytics-snapshot">
        <h2>Latest publication</h2>
        {snapshot ? (
          <>
            <p>
              Epoch <code>{snapshot.epoch_id}</code> · #{snapshot.ordinal}
            </p>
            <p>
              Database {snapshot.database} · Source LSN{" "}
              <code>{snapshot.source?.lsn ?? "Unknown"}</code>
            </p>
            <p>
              Source observed {date(snapshot.observed_at_ms)} · Published{" "}
              {date(snapshot.published_at_ms)}
            </p>
            <p>
              Snapshot age:{" "}
              {Math.max(
                0,
                Math.floor((Date.now() - snapshot.observed_at_ms) / 1000),
              )}{" "}
              seconds. PostgreSQL may have changed since this observation; live
              change tracking is unavailable.
            </p>
            <details>
              <summary>Published tables</summary>
              {snapshot.tables?.map((t) => (
                <p key={`${t.schema}.${t.name}`}>
                  <code>
                    {t.schema}.{t.name}
                  </code>{" "}
                  · {t.columns?.map((c) => `${c.name} (${c.type})`).join(", ")}
                </p>
              ))}
            </details>
          </>
        ) : (
          <p>No published snapshot. Publish one before opening a session.</p>
        )}
        {refresh && (
          <div className="analytics-refresh" role="status">
            <p>
              Refresh <code>{refresh.id}</code> ·{" "}
              <strong>{refresh.state}</strong> · Branch{" "}
              <code>{refresh.branch_id}</code>
            </p>
            {refresh.error && <p>{refresh.error}</p>}
            {!terminal(refresh.state) && (
              <button
                disabled={busy}
                onClick={() =>
                  void action({ action: "cancel_refresh", id: refresh.id })
                }
              >
                Cancel snapshot refresh
              </button>
            )}
          </div>
        )}
      </div>
      <div className="panel analytics-session">
        <h2>Analytical sessions</h2>
        <p>
          Two slots shared with notebooks and CLI. Sessions expire after 15
          minutes and close after two minutes without a browser heartbeat.
          Cancel stops the entire session.
        </p>
        <label>
          Active session
          <select
            aria-label="Analytical session"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setError("");
            }}
          >
            <option value="">Select a session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {data.branches.find((b) => b.id === s.branch_id)?.name ??
                  s.branch_id}{" "}
                · {s.state} · {s.epoch_id} · {s.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        {session && (
          <>
            <p className="analytics-binding">
              Session <code>{session.id}</code> ·{" "}
              <strong>{session.state}</strong> · Branch{" "}
              <code>{session.branch_id}</code> · Epoch{" "}
              <code>{session.epoch_id}</code>
            </p>
            <p>
              Source observed {date(session.metadata?.observed_at_ms)} · Expires{" "}
              {date(session.expires_at_ms)}
            </p>
            {snapshot &&
              snapshot.branch_id === session.branch_id &&
              snapshot.epoch_id !== session.epoch_id && (
                <p role="status">
                  A newer epoch is published. This session stays pinned to its
                  original epoch. Open latest session to use the new
                  publication.
                </p>
              )}
            {branch?.id !== session.branch_id && (
              <p role="status">
                The active session belongs to a different branch from the
                snapshot source selection.
              </p>
            )}
            {(session.metadata?.catalog || session.metadata?.datasets) && (
              <details open>
                <summary>Resolved data inputs</summary>
                <pre>
                  {JSON.stringify(
                    {
                      catalog: session.metadata.catalog,
                      datasets: session.metadata.datasets,
                      shared_source_transaction:
                        session.metadata.shared_source_transaction,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
            {session.error && <p role="alert">{session.error}</p>}
            <button
              className="button"
              disabled={busy}
              onClick={() => void action({ action: "close", id: session.id })}
            >
              Close analytical session
            </button>
            <button
              className="button danger"
              disabled={
                busy ||
                !["waiting", "starting", "ready"].includes(session.state)
              }
              onClick={() => void action({ action: "cancel", id: session.id })}
            >
              Cancel analytical session
            </button>
          </>
        )}
      </div>
      <div className="panel sql-panel">
        <h2>Spark SQL · read only</h2>
        <label>
          Analytics SQL
          <textarea
            aria-label="Analytics SQL"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            rows={7}
          />
        </label>
        <div className="workspace-controls">
          <label>
            Row limit
            <input
              aria-label="Analytics row limit"
              type="number"
              min={1}
              max={1000}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </label>
          <label>
            Deadline (ms)
            <input
              aria-label="Analytics deadline"
              type="number"
              min={100}
              max={30000}
              value={timeout}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
            />
          </label>
          <button
            className="button primary"
            disabled={!canRun}
            onClick={() =>
              session &&
              void action({
                action: "sql",
                id: session.id,
                sql,
                max_rows: rows,
                timeout_ms: timeout,
              })
            }
          >
            Run Analytics SQL
          </button>
        </div>
        {query && <QueryResult query={query} />}
        <button
          className="button"
          disabled={query?.state !== "complete"}
          onClick={() => query && setComparison(structuredClone(query))}
        >
          Keep result for comparison
        </button>
        {comparison && (
          <details open>
            <summary>Retained result · epoch {comparison.epoch_id}</summary>
            <p>
              Compare these bounded results with the active result. Row order
              requires ORDER BY; this is not a full database diff.
            </p>
            <QueryResult query={comparison} />
            <button onClick={() => setComparison(null)}>
              Clear comparison
            </button>
          </details>
        )}
      </div>
    </section>
  );
}
