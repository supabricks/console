import { useEffect, useRef, useState } from "react";
import {
  analytics,
  catalog,
  project,
  notebookSave,
  ingest,
  type ImportJob,
  type Overview,
  type Dataset,
  type DatasetTarget,
  type PublicationChoice,
  type ProjectPlan,
  type ProjectView,
  type ProjectOperation,
  type AnalyticalSnapshot,
  type AnalyticalRefresh,
} from "./api";

export type DataHandoff = {
  id: string;
  sql: string;
  catalog: boolean;
  epoch?: string;
};
type Binding = {
  owner?: string;
  logical: string;
  dataset: Dataset;
  state: string;
};
type Asset = {
  comment?: string;
  id: string;
  version: string;
  provider: string;
  kind: string;
  schema: string;
  name: string;
  state: string;
  observed_at_ms: number;
  snapshot_at_ms?: number;
  columns: { name: string; data_type: string; comment?: string }[];
};
type Preview = {
  epoch_id: string;
  preview_hash: string;
  source_revision: number;
  binding_revision: number;
  snapshot_at_ms: number;
  tables: {
    source_schema: string;
    source_name: string;
    body: { columns: { name: string; type_text: string }[] };
  }[];
};
type Pending = {
  kind: "publication" | "apply" | "refresh";
  command: Record<string, unknown>;
  id?: string;
  state?: string;
};
const current = { kind: "current" } as const;
const date = (n?: number | null) =>
  n ? new Date(n).toLocaleString() : "Unknown";
const quote = (s: string) => "`" + s.replaceAll("`", "``") + "`";
const sqlFor = (catalogName: string, schema: string, name: string) =>
  `SELECT * FROM ${[catalogName, schema, name].map(quote).join(".")} LIMIT 200`;
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Catalog request failed";
async function metadata(command: object) {
  let result = await catalog<{
    id?: string;
    state?: string;
    error?: { message: string };
    assets?: Asset[];
    next?: string;
  }>("metadata", command);
  const deadline = Date.now() + 30000;
  while (result.state === "running" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    result = await catalog("metadata", { action: "poll", id: result.id });
  }
  if (result.error || result.state === "running")
    throw new Error(
      result.error?.message ??
        "Metadata is still pending. Refresh to inspect it.",
    );
  return (
    (result as typeof result & { result?: typeof result }).result ?? result
  );
}
export function Data({
  data,
  selectedId,
  onSelect,
  onSql,
  onNotebook,
}: {
  data: Overview;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSql: (value: DataHandoff) => void;
  onNotebook: (path: string) => void;
}) {
  const branch =
    data.branches.find((b) => b.id === selectedId) ??
    data.branches.find((b) => b.is_default) ??
    data.branches[0];
  const storage = `supabricks.catalog:${data.data_dir}:${data.project.id}`;
  const [ownedCursor, setOwnedCursor] = useState<string | null>(null),
    [assetCursor, setAssetCursor] = useState<string | null>(null);
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [owned, setOwned] = useState<PublicationChoice[]>([]),
    [bindings, setBindings] = useState<Binding[]>([]);
  const [view, setView] = useState<ProjectView | null>(null),
    [assets, setAssets] = useState<Asset[]>([]),
    [health, setHealth] = useState<{
      mode?: string;
      ready?: boolean;
      state?: string;
    }>({});
  const [snapshot, setSnapshot] = useState<AnalyticalSnapshot | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const [choices, setChoices] = useState<PublicationChoice[] | null>(null),
    [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Dataset | null>(null),
    [logical, setLogical] = useState("shared"),
    [requirement, setRequirement] = useState("shared.dataset.v1");
  const [plan, setPlan] = useState<ProjectPlan | null>(null),
    [operation, setOperation] = useState<ProjectOperation | null>(null);
  const [pending, setPending] = useState<Pending | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storage) ?? "null");
    } catch {
      return null;
    }
  });
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [references, setReferences] = useState<unknown>(null);
  const alive = useRef(true),
    lock = useRef(false),
    generation = useRef(0);
  function remember(p: Pending | null) {
    if (p) sessionStorage.setItem(storage, JSON.stringify(p));
    else sessionStorage.removeItem(storage);
    setPending(p);
  }
  async function load() {
    const ticket = ++generation.current;
    const [v, b, o, h, s, receipts] = await Promise.all([
      project<ProjectView>(current, { action: "view", target: null }),
      catalog<{ bindings: Binding[] }>("datasets", { action: "list" }),
      catalog<{ items: PublicationChoice[]; next: string | null }>("datasets", {
        action: "owned",
      }),
      catalog<{ catalog: typeof health }>("metadata", { action: "health" }),
      branch
        ? analytics<AnalyticalSnapshot | null>({
            action: "snapshot",
            target: { branch: branch.id, revision: branch.revision },
          })
        : Promise.resolve(null),
      ingest<ImportJob[]>({ action: "list" }),
    ]);
    if (!alive.current || ticket !== generation.current) return;
    setImports(receipts);
    setView(v);
    setBindings(b.bindings);
    setOwned(o.items);
    setOwnedCursor(o.next);
    setHealth(h.catalog);
    setSnapshot(s);
    if (v.operation) setOperation(v.operation);
    if (branch) {
      const result = await metadata({
        action: "list",
        branch: branch.id,
        limit: 100,
      });
      if (alive.current && ticket === generation.current) {
        setAssets(result.assets ?? []);
        setAssetCursor(result.next ?? null);
      }
    }
  }
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void run(load);
    return () => {
      alive.current = false;
      ++generation.current;
    };
  }, [branch?.id, branch?.revision, data.runtime.generation]);
  async function submit(p: Pending) {
    remember(p); // Lost replies retain the exact idempotent request for explicit recovery.
    if (p.kind === "apply") {
      const result = await project<ProjectOperation>(current, {
        action: "apply",
        command: p.command as unknown as {
          action: "apply";
          plan: ProjectPlan;
          key: string;
        },
      });
      remember({ ...p, id: result.id, state: result.state });
      setOperation(result);
      setPlan(null);
    } else if (p.kind === "publication") {
      const result = await catalog<{
        publication: { id: string; state: string; error?: string };
      }>("publication", p.command);
      remember({
        ...p,
        id: result.publication.id,
        state: result.publication.state,
      });
      if (result.publication.error) throw new Error(result.publication.error);
    } else {
      const result = await analytics<AnalyticalRefresh>(
        p.command as unknown as {
          action: "refresh";
          target: { branch: string; revision: number };
          key: string;
        },
      );
      remember({ ...p, id: result.id, state: result.state });
    }
  }
  useEffect(() => {
    if (!pending?.id) return;
    let cancelled = false,
      checking = false;
    const tick = async () => {
      if (checking || lock.current) return;
      checking = true;
      try {
        let state: string, problem: string | null | undefined;
        if (pending.kind === "apply") {
          const o = await project<ProjectOperation>(current, {
            action: "apply",
            command: { action: "status", id: pending.id! },
          });
          state = o.state;
          problem = o.error;
          if (!cancelled) setOperation(o);
        } else if (pending.kind === "publication") {
          const r = await catalog<{
            publication: { state: string; error?: string };
          }>("publication", { action: "status", id: pending.id });
          state = r.publication.state;
          problem = r.publication.error;
        } else {
          const r = await analytics<AnalyticalRefresh>({
            action: "refresh_status",
            id: pending.id!,
          });
          state = r.state;
          problem = r.error;
        }
        if (cancelled) return;
        if (problem) {
          setError(problem);
          return;
        }
        const terminal =
          ["succeeded", "failed", "cancelled", "retired"].includes(state) ||
          (state === "published" && pending.command.action !== "unpublish");
        setNotice(`${pending.kind}: ${state}`);
        if (terminal) {
          remember(null);
          await load();
        }
      } catch (e) {
        if (!cancelled)
          setError(
            `${message(e)} Use Recover last request to inspect or retry the same request.`,
          );
      } finally {
        checking = false;
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pending?.id]);
  const applyPlan = async (mapping: Record<string, DatasetTarget> = {}) => {
    setPlan(
      await project<ProjectPlan>(current, {
        action: "apply",
        command: { action: "plan", options: { adopt: {}, datasets: mapping } },
      }),
    );
    setNotice(
      "Review every change before applying. Running readers keep their revisions.",
    );
  };
  async function draft(key: string, value: string | null) {
    const fresh = await project<ProjectView>(current, {
      action: "view",
      target: null,
    });
    const hash = fresh.inspection?.files["supabricks.toml"]?.sha256;
    if (!hash)
      throw new Error(
        "Project manifest is unavailable. Inspect project packages.",
      );
    await project(current, {
      action: "apply",
      command: {
        action: "dataset_draft",
        logical: key,
        requirement: value,
        expected_manifest_sha256: hash,
      },
    });
    setView(
      await project<ProjectView>(current, { action: "view", target: null }),
    );
  }
  function sql(sql: string, ownedInput?: Dataset) {
    if (ownedInput) onSelect(ownedInput.branch_id);
    onSql({
      id: crypto.randomUUID(),
      sql,
      catalog: true,
      epoch: ownedInput?.epoch_id,
    });
  }
  async function notebook(sql: string, ownedInput?: Dataset) {
    if (!branch)
      throw new Error(
        "Create a database for this project's execution context first.",
      );
    const path = `dataset-${crypto.randomUUID().slice(0, 8)}.ipynb`;
    await notebookSave(
      path,
      {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: {
          kernelspec: {
            name: "supabricks",
            display_name: "Supabricks",
            language: "python",
          },
          supabricks: {
            binding: {
              branch_id: ownedInput?.branch_id ?? branch.id,
              epoch_id: ownedInput?.epoch_id ?? null,
              catalog: true,
            },
          },
        },
        cells: [
          {
            id: crypto.randomUUID(),
            cell_type: "code",
            source: `spark.sql(${JSON.stringify(sql)}).show()`,
            metadata: {},
            outputs: [],
            execution_count: null,
          },
        ],
      },
      null,
    );
    onNotebook(path);
  }
  return (
    <section className="data-browser" aria-label="Data browser">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROJECT DATA</span>
          <h1>Data</h1>
          <p>
            Live tables, published snapshots and explicitly shared datasets.
          </p>
        </div>
        <button
          className="button"
          disabled={busy}
          onClick={() => void run(load)}
        >
          Refresh data
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="panel">
        <strong>
          Open-source Unity Catalog:{" "}
          {health.ready ? "Ready" : (health.state ?? "Unavailable")}
        </strong>
        {!health.ready && (
          <p>
            Catalog publication and new catalog readers require a ready local
            provider. Live PostgreSQL remains independent.
          </p>
        )}
        <label>
          Data branch{" "}
          <select
            aria-label="Data branch"
            value={branch?.id ?? ""}
            disabled={busy}
            onChange={(e) => {
              setPreview(null);
              setPlan(null);
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
        {!branch && <p>No database yet. Create one in Database workspace.</p>}
      </div>
      {pending && (
        <div className="panel" aria-label="Pending catalog request">
          <p>
            {pending.kind}: {pending.state ?? "Response unknown"}. Requests are
            not replayed automatically.
          </p>
          <button
            disabled={busy}
            onClick={() => void run(() => submit(pending))}
          >
            Recover last request
          </button>
          <button disabled={busy} onClick={() => remember(null)}>
            Dismiss request tracking
          </button>
        </div>
      )}
      <section className="panel">
        <h2>Live PostgreSQL and analytical snapshots</h2>
        <p>
          Freshness relative to current rows is unknown. Snapshot time is an
          observation, not live change tracking.
        </p>
        {!assets.length && <p>No tables observed in this branch.</p>}
        {assets.map((a) => (
          <details key={a.id}>
            <summary>
              {a.schema}.{a.name} ·{" "}
              {a.kind === "postgres_table"
                ? "Live PostgreSQL"
                : "Analytical snapshot"}{" "}
              · {a.state}
            </summary>
            <p>
              Provider {a.provider} · Owner {data.project.name} · Observed{" "}
              {date(a.observed_at_ms)} · Snapshot {date(a.snapshot_at_ms)}
            </p>
            <p>Comment: {a.comment ?? "Not recorded"}</p>
            <ul>
              {a.columns.map((c) => (
                <li key={c.name}>
                  {c.name} · {c.data_type}
                  {c.comment ? " · " + c.comment : ""}
                </li>
              ))}
            </ul>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await metadata({
                    action: "validate_source",
                    id: a.id,
                    expected_version: a.version,
                  });
                  setNotice(
                    "Source identity and schema validated at this observation. Row freshness remains unknown.",
                  );
                })
              }
            >
              Validate {a.schema}.{a.name}
            </button>
          </details>
        ))}
        {assetCursor && branch && (
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await metadata({
                  action: "list",
                  branch: branch.id,
                  after: assetCursor,
                  limit: 100,
                });
                setAssets([...assets, ...(r.assets ?? [])]);
                setAssetCursor(r.next ?? null);
              })
            }
          >
            More tables
          </button>
        )}
        <div className="data-actions">
          <button
            disabled={busy || !branch || !!pending}
            onClick={() =>
              void run(async () => {
                setPreview(null);
                await submit({
                  kind: "refresh",
                  command: {
                    action: "refresh",
                    target: { branch: branch.id, revision: branch.revision },
                    key: crypto.randomUUID(),
                  },
                });
              })
            }
          >
            Refresh analytical snapshot
          </button>
          <button
            disabled={busy || !snapshot || !health.ready || !!pending}
            onClick={() =>
              void run(async () => {
                await metadata({ action: "ensure_namespace" });
                setPreview(
                  await catalog("publication", {
                    action: "preview",
                    epoch_id: snapshot!.epoch_id,
                  }),
                );
              })
            }
          >
            Review publication
          </button>
        </div>
        {snapshot && (
          <p>
            Latest snapshot #{snapshot.ordinal} ·{" "}
            {date(snapshot.published_at_ms)}
          </p>
        )}
        {preview && (
          <div aria-label="Publication review">
            <h3>Publish complete snapshot</h3>
            <p>
              All {preview.tables.length} tables · Snapshot{" "}
              {date(preview.snapshot_at_ms)}. Retained until withdrawn and all
              bindings/readers drain. No data copy.
            </p>
            <ul>
              {preview.tables.map((t) => (
                <li key={t.source_schema + "." + t.source_name}>
                  {t.source_schema}.{t.source_name}:{" "}
                  {t.body.columns
                    .map((c) => `${c.name} (${c.type_text})`)
                    .join(", ")}
                </li>
              ))}
            </ul>
            <button
              disabled={busy || !!pending}
              onClick={() =>
                void run(async () => {
                  await submit({
                    kind: "publication",
                    command: {
                      action: "publish",
                      epoch_id: preview.epoch_id,
                      key: crypto.randomUUID(),
                      expected_preview: preview.preview_hash,
                      expected_source_revision: preview.source_revision,
                      expected_binding_revision: preview.binding_revision,
                    },
                  });
                  setPreview(null);
                })
              }
            >
              Publish reviewed snapshot
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Owned publications</h2>
        {!owned.length && <p>No catalog publications in this project.</p>}
        {owned.map((p) => (
          <article className="dataset-card" key={p.target.publication_id}>
            <h3>
              {p.branch} · Revision {p.revision ?? "pending"}
            </h3>
            <p>
              {p.state} · {p.head ? "Current head" : "Fixed revision"} ·{" "}
              {p.table_count} tables · {date(p.snapshot_at_ms)}
            </p>
            <code>{p.target.publication_id}</code>
            <div className="data-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    setReferences(
                      await catalog("datasets", {
                        action: "references",
                        target: p.target,
                      }),
                    ),
                  )
                }
              >
                Inspect retention
              </button>
              {p.needs_attention && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await catalog("publication", {
                        action: "resume",
                        id: p.target.publication_id,
                      });
                      await load();
                    })
                  }
                >
                  Resume publication
                </button>
              )}
              {p.state === "published" && (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const d = await catalog<{ dataset: Dataset }>(
                          "datasets",
                          { action: "describe", target: p.target },
                        );
                        setSelected(d.dataset);
                        setChoices(null);
                      })
                    }
                  >
                    Explore publication
                  </button>
                  <button
                    disabled={busy || !!pending}
                    onClick={() =>
                      void run(async () => {
                        if (
                          !confirm(
                            "Withdraw this publication? New bindings/readers will be rejected. Existing bindings and readers retain it until released.",
                          )
                        )
                          return;
                        await submit({
                          kind: "publication",
                          command: {
                            action: "unpublish",
                            id: p.target.publication_id,
                            key: crypto.randomUUID(),
                            expected_binding_revision: p.binding_revision,
                          },
                        });
                      })
                    }
                  >
                    Withdraw publication
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {ownedCursor && (
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await catalog<{
                  items: PublicationChoice[];
                  next: string | null;
                }>("datasets", { action: "owned", after: ownedCursor });
                setOwned([...owned, ...r.items]);
                setOwnedCursor(r.next);
              })
            }
          >
            More owned publications
          </button>
        )}
        {references !== null && (
          <details open>
            <summary>Retention holders</summary>
            <pre>{JSON.stringify(references, null, 2)}</pre>
          </details>
        )}
      </section>
      <section className="panel">
        <h2>Bound datasets</h2>
        <p>
          Fixed publication revisions. Updating a binding affects new sessions;
          running SQL and notebooks retain their inputs.
        </p>
        {!bindings.length && <p>No shared datasets bound to this project.</p>}
        {bindings.map((b) => (
          <article className="dataset-card" key={b.logical}>
            <h3>{b.logical}</h3>
            <p>
              {b.state} · Revision {b.dataset.revision} ·{" "}
              {date(b.dataset.snapshot_at_ms)} · Owner deployment{" "}
              {b.dataset.target.deployment_id}
            </p>
            <ul>
              {b.dataset.tables.map((t) => (
                <li key={t.schema + "." + t.name}>
                  <code>
                    {t.schema}.{t.name}
                  </code>{" "}
                  ·{" "}
                  {t.columns
                    .map((c) => `${c.name} (${c.type_text})`)
                    .join(", ")}{" "}
                  <button
                    onClick={() =>
                      sql(
                        sqlFor(
                          "dataset_" + b.logical.slice(8),
                          t.schema,
                          t.name,
                        ),
                      )
                    }
                  >
                    Query {b.logical}.{t.name}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        notebook(
                          sqlFor(
                            "dataset_" + b.logical.slice(8),
                            t.schema,
                            t.name,
                          ),
                        ),
                      )
                    }
                  >
                    Notebook {b.logical}.{t.name}
                  </button>
                </li>
              ))}
            </ul>
            <button
              disabled={busy || !!pending}
              onClick={() =>
                void run(async () => {
                  const r = await catalog<{
                    available: Dataset | null;
                    schema_changed: boolean;
                    content_changed: boolean;
                  }>("datasets", { action: "updates", logical: b.logical });
                  if (!r.available)
                    throw new Error("No current publication is available.");
                  await applyPlan({ [b.logical]: r.available.target });
                })
              }
            >
              Review update {b.logical}
            </button>
            <button
              disabled={busy || !!pending}
              onClick={() =>
                void run(async () => {
                  await draft(b.logical, null);
                  await applyPlan();
                })
              }
            >
              Review removal {b.logical}
            </button>
          </article>
        ))}
        <button
          disabled={busy || !!pending}
          onClick={() =>
            void run(async () => {
              const r = await catalog<{
                items: PublicationChoice[];
                next: string | null;
              }>("datasets", { action: "discover" });
              setChoices(r.items);
              setCursor(r.next);
              setSelected(null);
            })
          }
        >
          Add existing dataset
        </button>
        {choices && (
          <div aria-label="Dataset discovery">
            <h3>Available publications</h3>
            <p>
              Select a publication to review an explicit binding. Discovery does
              not grant access.
            </p>
            {!choices.length && (
              <p>No publications are available on this installation.</p>
            )}
            {choices
              .filter((p) => p.state === "published")
              .map((p) => (
                <button
                  disabled={busy}
                  key={p.target.publication_id}
                  onClick={() =>
                    void run(async () => {
                      setSelected(
                        (
                          await catalog<{ dataset: Dataset }>("datasets", {
                            action: "describe",
                            target: p.target,
                          })
                        ).dataset,
                      );
                    })
                  }
                >
                  {p.owner} · {p.branch} · Revision {p.revision} ·{" "}
                  {date(p.snapshot_at_ms)}
                </button>
              ))}
            {cursor && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await catalog<{
                      items: PublicationChoice[];
                      next: string | null;
                    }>("datasets", { action: "discover", after: cursor });
                    setChoices([...choices, ...r.items]);
                    setCursor(r.next);
                  })
                }
              >
                More publications
              </button>
            )}
          </div>
        )}
        {selected && (
          <div aria-label="Selected dataset">
            <h3>Selected publication · Revision {selected.revision}</h3>
            <p>
              Owner {selected.target.deployment_id} · Provider{" "}
              {selected.target.provider_id} · Snapshot{" "}
              {date(selected.snapshot_at_ms)} · Freshness unknown
            </p>
            <ul>
              {selected.tables.map((t) => (
                <li key={t.schema + "." + t.name}>
                  {t.schema}.{t.name}:{" "}
                  {t.columns
                    .map((c) => `${c.name} (${c.type_text})`)
                    .join(", ")}
                  {!choices && (
                    <>
                      <button
                        onClick={() =>
                          sql(
                            sqlFor(selected.catalog, t.schema, t.name),
                            selected,
                          )
                        }
                      >
                        Query {t.name}
                      </button>
                      <button
                        onClick={() =>
                          void run(() =>
                            notebook(
                              sqlFor(selected.catalog, t.schema, t.name),
                              selected,
                            ),
                          )
                        }
                      >
                        Notebook {t.name}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {choices && (
              <>
                <label>
                  Dataset name{" "}
                  <input
                    aria-label="Dataset name"
                    value={logical}
                    onChange={(e) => setLogical(e.target.value)}
                  />
                </label>
                <label>
                  Logical requirement{" "}
                  <input
                    aria-label="Logical requirement"
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                  />
                </label>
                <p>
                  This records a portable requirement in supabricks.toml.
                  Destination binding activates only after plan review.
                </p>
                <button
                  disabled={busy || !!pending}
                  onClick={() =>
                    void run(async () => {
                      const key = "dataset." + logical;
                      if (!view?.inspection?.resources[key])
                        await draft(key, requirement);
                      await applyPlan({ [key]: selected.target });
                    })
                  }
                >
                  Review dataset binding
                </button>
              </>
            )}
          </div>
        )}
        {view?.inspection?.unresolved_bindings
          .filter(
            (b) =>
              b.kind === "catalog_dataset" &&
              !bindings.some((i) => i.logical === b.resource),
          )
          .map((b) => (
            <p key={b.resource}>
              Unresolved requirement: {b.resource}. Choose its dataset name when
              adding a publication.
            </p>
          ))}
      </section>
      {plan && (
        <section className="panel" aria-label="Dataset plan review">
          <h2>Review project changes</h2>
          <p>Plan {plan.digest}. Review all steps before activation.</p>
          {plan.steps.map((s) => (
            <details key={s.logical} open={s.kind === "catalog_dataset"}>
              <summary>
                {s.action} · {s.logical}
              </summary>
              {s.initialization != null && (
                <pre>{JSON.stringify(s.initialization, null, 2)}</pre>
              )}
            </details>
          ))}
          <button
            disabled={
              busy ||
              !!pending ||
              plan.steps.some((s) => s.action === "unresolved")
            }
            onClick={() =>
              void run(() =>
                submit({
                  kind: "apply",
                  command: { action: "apply", plan, key: crypto.randomUUID() },
                }),
              )
            }
          >
            Apply reviewed dataset plan
          </button>
          <button onClick={() => setPlan(null)}>Discard plan</button>
        </section>
      )}
      {operation && (
        <p role="status">
          Project apply: {operation.state}
          {operation.error ? " · " + operation.error : ""}
        </p>
      )}
      <section className="panel">
        <h2>Observed provenance</h2>
        {imports
          .filter((j) => j.state === "succeeded")
          .map((j) => (
            <p key={j.id}>
              Import receipt <code>{j.id}</code> → PostgreSQL {j.load.schema}.
              {j.load.table} · Branch {j.load.branch_id} · Source SHA-256{" "}
              {j.load.source_sha256} · {j.committed_rows} rows
            </p>
          ))}
        {owned.map((p) => (
          <p key={p.target.publication_id}>
            Snapshot <code>{p.epoch_id}</code> → Publication{" "}
            <code>{p.target.publication_id}</code> · Revision{" "}
            {p.revision ?? "pending"}
          </p>
        ))}
        <p>
          Import receipts identify their PostgreSQL table. Exports identify
          snapshots; publications identify snapshots; bindings and running
          sessions record their selected revisions. Independent inputs do not
          share a source transaction. Python and column-level lineage are not
          inferred.
        </p>
      </section>
    </section>
  );
}
