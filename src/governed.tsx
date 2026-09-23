import { SyncPanel, type SyncCommand } from "./sync";
import {
  cloneElement,
  useId,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  control,
  workspace,
  session,
  requestKey,
  type Json,
} from "./governed-api";
import "./governed.css";
const text = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
function Result({ value }: { value: Json | null }) {
  if (!value) return null;
  const rows = value.result?.rows ?? value.rows;
  return rows?.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {Object.keys(rows[0]).map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: Json, i: number) => (
            <tr key={i}>
              {Object.keys(rows[0]).map((k) => (
                <td key={k}>{text(r[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <pre className="governed-result">{JSON.stringify(value, null, 2)}</pre>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="governed-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id })
        : children}
    </div>
  );
}
export function GovernedConsole() {
  const [auth, setAuth] = useState<Json | null>(null),
    [identity, setIdentity] = useState<Json | null>(null),
    [projects, setProjects] = useState<Json[]>([]),
    [deployment, setDeployment] = useState(""),
    [tab, setTab] = useState("Data"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(true);
  const generation = useRef(0);
  function clear() {
    generation.current++;
    setIdentity(null);
    setProjects([]);
    setDeployment("");
    setAuth(null);
  }
  async function refreshSession() {
    const n = generation.current;
    try {
      const a = await session();
      if (n !== generation.current) return;
      setAuth(a);
      if (a.authenticated) {
        const [me, list] = await Promise.all([
          workspace({ action: "context" }),
          control({ action: "projects" }),
        ]);
        if (n !== generation.current) return;
        setIdentity(me);
        setProjects(list.projects);
        setDeployment((d) =>
          list.projects.some((p: Json) => p.deployment_id === d) ? d : "",
        );
      } else {
        setIdentity(null);
        setProjects([]);
        setDeployment("");
      }
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setError(String(e));
    }
  }
  useEffect(() => {
    void refreshSession();
    const lost = () => {
      clear();
      void refreshSession();
    };
    window.addEventListener("governed-session-lost", lost);
    const timer = setInterval(() => void refreshSession(), 5000);
    return () => {
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("governed-session-lost", lost);
    };
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const v = await workspace({
        action: "create_project",
        name: new FormData(form).get("name"),
        key: requestKey(),
      });
      await refreshSession();
      setDeployment(v.project.deployment_id);
      form.reset();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!auth?.authenticated || !identity)
    return (
      <main className="governed-login">
        <span className="eyebrow">SUPABRICKS · GOVERNED CONSOLE</span>
        <h1>Sign in to your workspace.</h1>
        <p>
          Your identity determines which projects and datasets you can access.
        </p>
        {error && <p role="alert">{error}</p>}
        {auth && !auth.authenticated ? (
          <form method="post" action="/auth/v1/login">
            <input type="hidden" name="csrf" value={auth.csrf} />
            <button className="button primary">Sign in</button>
          </form>
        ) : (
          <p role="status">Connecting…</p>
        )}
        <p className="muted">
          {window.location.protocol === "https:"
            ? "Sign in with your organization’s identity provider."
            : "Private loopback preview. Shared network access is unavailable."}
        </p>
        <button className="text-button" onClick={() => void refreshSession()}>
          Reconnect
        </button>
      </main>
    );
  return (
    <div className="shell governed">
      <aside className="sidebar">
        <h2 className="brand">Supabricks</h2>
        <span className="eyebrow">GOVERNED WORKSPACE</span>
        <Field label="Project">
          <select
            value={deployment}
            onChange={(e) => {
              setDeployment(e.target.value);
              setError("");
            }}
          >
            <option value="">Choose a project</option>
            {projects.map((p) => (
              <option key={p.deployment_id} value={p.deployment_id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <nav aria-label="Project navigation">
          {[
            "Data",
            "SQL",
            "Notebooks",
            "Packages",
            "Access",
            ...(identity.realm_administrator
              ? ["Administration", "Audit"]
              : []),
          ].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        {identity.realm_administrator && (
          <form onSubmit={create}>
            <Field label="New project name">
              <input
                name="name"
                required
                pattern="[a-z][a-z0-9_-]*"
                maxLength={63}
              />
            </Field>
            <button className="button" disabled={busy}>
              Create project
            </button>
          </form>
        )}
        <div className="sidebar-bottom">
          <p>
            {window.location.protocol === "https:"
              ? "Governed console · TLS"
              : "Governed loopback preview"}
          </p>
          {window.location.protocol !== "https:" && (
            <p>Shared network access is unavailable.</p>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div>
            <strong>{identity.label}</strong>
            <span className="muted">
              {" "}
              ·{" "}
              {identity.realm_administrator
                ? "Realm administrator"
                : "Signed in"}
            </span>
            <details>
              <summary>Identity and session</summary>
              <p>
                Actor: <code>{identity.identity.actor_id}</code>
              </p>
              <p>
                Realm: <code>{identity.identity.realm_id}</code>
              </p>
              <p>
                Expires:{" "}
                {new Date(identity.identity.expires_ms).toLocaleString()}
              </p>
            </details>
          </div>
          <form method="post" action="/auth/v1/logout">
            <input type="hidden" name="csrf" value={auth.csrf} />
            <button className="text-button">Sign out</button>
          </form>
        </header>
        <main id="main">
          <h1>{tab}</h1>
          {!connected && (
            <p role="alert" className="notice">
              Connection unavailable. Actions require a live server check.{" "}
              <button onClick={() => void refreshSession()}>Reconnect</button>
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {tab === "Administration" ? (
            <Administration />
          ) : tab === "Audit" ? (
            <Audit />
          ) : deployment ? (
            <ProjectWorkspace
              key={deployment + tab}
              deployment={deployment}
              tab={tab}
              administrator={identity.realm_administrator}
            />
          ) : (
            <div className="empty">
              <h2>
                {projects.length ? "Choose a project" : "No projects available"}
              </h2>
              <p>
                {identity.realm_administrator
                  ? "Create a project to start. Data and execution permissions are granted separately."
                  : "Ask a project administrator to add your identity or group to the project."}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
function ProjectWorkspace({
  deployment,
  tab,
  administrator,
}: {
  deployment: string;
  tab: string;
  administrator: boolean;
}) {
  const [policy, setPolicy] = useState<Json | null>(null),
    [branches, setBranches] = useState<Json[]>([]),
    [syncCapabilities, setSyncCapabilities] = useState<Json>({}),
    [branch, setBranch] = useState(""),
    [result, setResult] = useState<Json | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [tables, setTables] = useState<Json[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [source, setSource] = useState(
      tab === "Notebooks"
        ? JSON.stringify({
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {},
            cells: [
              {
                id: crypto.randomUUID(),
                cell_type: "code",
                metadata: {},
                source: ['print(spark.sql("SELECT 1 AS value").collect())'],
                outputs: [],
                execution_count: null,
              },
            ],
          })
        : "SELECT 1 AS value",
    ),
    [asset, setAsset] = useState("query"),
    [revision, setRevision] = useState(""),
    [head, setHead] = useState<string | null>(null),
    [sources, setSources] = useState<Json[]>([]),
    [executions, setExecutions] = useState<Json[]>([]),
    [effective, setEffective] = useState(""),
    [execution, setExecution] = useState(""),
    [capability, setCapability] = useState("read"),
    [publication, setPublication] = useState<Json | null>(null),
    [preview, setPreview] = useState<Json | null>(null),
    [exportId, setExportId] = useState("");
  const branchReady = branches.some(
    (b) => b.id === branch && b.state === "running",
  );
  const live = useRef(true);
  const catalogLoaded = useRef(false);
  const call = (action: string, extra: Json = {}) =>
    control({ action, deployment, ...extra });
  async function refresh() {
    const [p, b] = await Promise.all([
      call("policy"),
      workspace({ action: "branches", deployment }),
    ]);
    if (!live.current) return;
    setPolicy((old) => {
      if (old && old.policy_revision !== p.policy_revision) {
        setResult(null);
        setTables([]);
        setSelected([]);
        setPreview(null);
        setPublication(null);
      }
      return p;
    });
    setBranches(b.branches);
    setSyncCapabilities(b.capabilities ?? {});
    setBranch((old) =>
      b.branches.some((v: Json) => v.id === old)
        ? old
        : (b.branches[0]?.id ?? ""),
    );
  }
  async function run(job: () => Promise<Json | void>) {
    setBusy(true);
    setError("");
    try {
      const v = await job();
      if (live.current && v) setResult(v);
      await refresh();
    } catch (e) {
      if (live.current) {
        setError(String(e));
        setResult(null);
        setTables([]);
        setSelected([]);
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void run(async () => {
      await refresh();
      if (tab === "SQL" || tab === "Notebooks") {
        const v = await call("sources");
        if (live.current) setSources(v.sources);
      }
    });
    const timer = setInterval(
      () =>
        void (async () => {
          await refresh();
          if (catalogLoaded.current) await discover();
        })().catch((e) => {
          if (live.current) {
            setResult(null);
            setTables([]);
            setSelected([]);
            setError(String(e));
          }
        }),
      5000,
    );
    return () => {
      live.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!execution) return;
    let polling = false;
    const timer = setInterval(
      () =>
        void (async () => {
          if (polling) return;
          polling = true;
          try {
            const v = await call("runtime", {
              command: { action: "poll", id: execution },
            });
            if (live.current) {
              setResult(v);
            }
          } catch (e) {
            if (live.current) {
              setResult(null);
              setError(String(e));
              setExecution("");
              setTables([]);
              setSelected([]);
            }
          } finally {
            polling = false;
          }
        })(),
      2000,
    );
    return () => clearInterval(timer);
  }, [execution]);
  const data = (command: Json) =>
    call("data", {
      command: {
        ...command,
        branch,
        expected_policy: policy?.policy_revision,
        key: requestKey(),
      },
    });
  async function discover() {
    catalogLoaded.current = true;
    const v = await control({
      action: "catalog",
      command: { action: "list", search: "" },
    });
    if (live.current) {
      setTables(v.items ?? []);
      setSelected((old) =>
        old.filter((id) => (v.items ?? []).some((t: Json) => t.table === id)),
      );
    }
    return { dataset_count: (v.items ?? []).length };
  }
  async function ensurePublicationNamespace() {
    await workspace({ action: "namespace", deployment, ensure: true });
    const deadline = Date.now() + 120000;
    while (live.current && Date.now() < deadline) {
      const value = await workspace({
        action: "namespace",
        deployment,
        ensure: false,
      });
      if (value.namespace?.state === "ready") return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(
      "Catalog namespace is still preparing. Review publication again when it is ready.",
    );
  }
  async function prepareSnapshot() {
    const exported = await data({ action: "export" });
    const id = exported.result.export_id;
    setExportId(id);
    const waitFor = async (
      read: () => Promise<Json>,
      ready: (v: Json) => boolean,
    ) => {
      const end = Date.now() + 120000;
      while (live.current && Date.now() < end) {
        const v = await read();
        setResult(v);
        if (ready(v)) return v;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error(
        "Snapshot is still preparing. Check its status before retrying.",
      );
    };
    await waitFor(
      () => workspace({ action: "snapshot", deployment, export: id }),
      (v) => v.state === "complete",
    );
    const built = await call("data", {
      command: {
        action: "publish",
        export: id,
        expected_policy: policy?.policy_revision,
      },
    });
    setPublication(built);
    await waitFor(
      () => workspace({ action: "snapshot", deployment, export: id }),
      (v) => v.publication?.state === "published",
    );
    await ensurePublicationNamespace();
    const reviewed = await workspace({
      action: "publication",
      deployment,
      command: { action: "preview", epoch_id: built.epoch_id },
    });
    setPreview(reviewed);
    return reviewed;
  }
  async function save() {
    const old = await call("sources");
    const head =
      old.sources.find((v: Json) => v.asset === asset)?.revision ?? null;
    const v = await call("save_source", {
      asset,
      kind: tab === "Notebooks" ? "notebook" : "sql",
      contents: source,
      expected_head: head,
      expected_policy: policy?.policy_revision,
      key: requestKey(),
    });
    setRevision(v.revision);
    setHead(v.revision);
    const list = await call("sources");
    if (live.current) setSources(list.sources);
    return v;
  }
  async function execute() {
    if (!revision)
      throw new Error("Save and review this source revision before running.");
    const v = await call("admit_execution", {
      source_revision: revision,
      effective_principal: effective || null,
      expected_policy: policy?.policy_revision,
      key: requestKey(),
    });
    const started = await call("runtime", {
      command: {
        action: "start",
        id: v.id,
        datasets: tables
          .filter((t) => selected.includes(t.table))
          .map((t) => ({
            publication: t.publication,
            publication_revision: t.publication_revision,
            table: t.table,
          })),
      },
    });
    if (live.current) setExecution(v.id);
    return started;
  }
  async function upload(file: File | undefined, kind: string) {
    if (!file) return;
    if (file.size > 22000)
      throw new Error("This preview accepts files up to 22 KB.");
    if (kind === "notebook") {
      const v = JSON.parse(await file.text());
      v.cells?.forEach((c: Json) => {
        c.outputs = [];
        c.execution_count = null;
      });
      setSource(JSON.stringify(v));
      setRevision("");
      setAsset(file.name);
      setHead(null);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return data({
      action: "import",
      archive_hex: Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
    });
  }
  return (
    <fieldset disabled={busy}>
      <div className="governed-toolbar">
        <Field label="Branch">
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setResult(null);
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.state}
              </option>
            ))}
          </select>
        </Field>
        <button
          className="button"
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          Refresh permissions
        </button>
        <span>Policy revision {policy?.policy_revision ?? "…"}</span>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {tab === "Data" && (
        <>
          <p>
            Discover only datasets your identity can read. Publishing and
            sharing require separate grants.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void run(discover)}
          >
            Discover datasets
          </button>
          <DatasetList
            tables={tables}
            selected={selected}
            setSelected={setSelected}
          />
          <section>
            <h2>Import data</h2>
            <p>
              Import a reviewed .sbdata package into this branch. Receive and
              DDL grants are required.
            </p>
            <input
              aria-label="Import data package"
              type="file"
              accept=".sbdata"
              disabled={busy || !branchReady}
              onChange={(e) =>
                void run(() => upload(e.target.files?.[0], "data"))
              }
            />
          </section>
          {branch && policy && (
            <SyncPanel
              key={`${deployment}:${branch}:${policy.policy_revision}`}
              scope={`${deployment}:${branch}`}
              branch={branch}
              governed
              onPublication={(epoch, refresh) => {
                setExportId(refresh);
                setPublication({ epoch_id: epoch });
                setPreview(null);
              }}
              capabilities={syncCapabilities}
              request={async (command: SyncCommand, service?: string) =>
                workspace({
                  action: "sync",
                  deployment,
                  request: {
                    command,
                    expected_policy: policy.policy_revision,
                    service_principal: service ?? null,
                  },
                })
              }
            />
          )}
          <section>
            <h2>Publish a snapshot</h2>
            <p>
              Copy-source and share grants are required. Review the exact
              snapshot before publishing.
            </p>
            <button
              className="button"
              disabled={busy}
              onClick={() => void run(prepareSnapshot)}
            >
              Prepare snapshot
            </button>
            <Field label="Export operation">
              <input
                value={exportId}
                onChange={(e) => setExportId(e.target.value)}
              />
            </Field>
            <button
              className="button"
              disabled={busy || !exportId}
              onClick={() =>
                void run(() =>
                  workspace({
                    action: "snapshot",
                    deployment,
                    export: exportId,
                  }),
                )
              }
            >
              Check snapshot status
            </button>
            <button
              className="button"
              disabled={busy || !exportId}
              onClick={() =>
                void run(async () => {
                  const v = await call("data", {
                    command: {
                      action: "publish",
                      export: exportId,
                      expected_policy: policy?.policy_revision,
                    },
                  });
                  setPublication(v);
                  return v;
                })
              }
            >
              Build analytical snapshot
            </button>
            {publication && (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await ensurePublicationNamespace();
                    const v = await workspace({
                      action: "publication",
                      deployment,
                      command: {
                        action: "preview",
                        epoch_id: publication.epoch_id,
                      },
                    });
                    setPreview(v);
                    return v;
                  })
                }
              >
                Review publication
              </button>
            )}
            {preview && (
              <>
                <Result value={preview} />
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      workspace({
                        action: "publication",
                        deployment,
                        command: {
                          action: "publish",
                          epoch_id: publication!.epoch_id,
                          key: requestKey(),
                          expected_preview: preview.preview_hash,
                          expected_source_revision: preview.source_revision,
                          expected_binding_revision: preview.binding_revision,
                        },
                      }),
                    )
                  }
                >
                  Publish reviewed snapshot
                </button>
              </>
            )}
          </section>
        </>
      )}
      {(tab === "SQL" || tab === "Notebooks") && (
        <>
          <Field label="Open saved source">
            <select
              defaultValue=""
              onChange={(e) =>
                void run(async () => {
                  if (!e.target.value) return;
                  const value = await call("source", {
                    revision: e.target.value,
                  });
                  setAsset(value.asset);
                  setSource(value.contents);
                  setRevision(value.revision);
                  setHead(value.revision);
                })
              }
            >
              <option value="">Choose a saved revision</option>
              {sources
                .filter(
                  (v) => v.kind === (tab === "Notebooks" ? "notebook" : "sql"),
                )
                .map((v) => (
                  <option key={v.revision} value={v.revision}>
                    {v.asset}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Source name">
            <input
              value={asset}
              onChange={(e) => {
                setAsset(e.target.value);
                setRevision("");
                setHead(null);
              }}
            />
          </Field>
          {tab === "Notebooks" && (
            <>
              <p>
                Import an .ipynb notebook. Stored outputs are removed; execution
                binds this immutable revision in the isolated Spark runtime.
              </p>
              <input
                aria-label="Import notebook"
                type="file"
                accept=".ipynb"
                onChange={(e) =>
                  void run(() => upload(e.target.files?.[0], "notebook"))
                }
              />
            </>
          )}
          {tab === "SQL" ? (
            <Field label="SQL source">
              <textarea
                rows={12}
                value={source}
                spellCheck={false}
                onChange={(e) => {
                  setSource(e.target.value);
                  setRevision("");
                }}
              />
            </Field>
          ) : (
            <NotebookEditor
              source={source}
              onChange={(value) => {
                setSource(value);
                setRevision("");
              }}
            />
          )}
          {tab === "SQL" && (
            <section>
              <h2>PostgreSQL</h2>
              <Field label="Data capability">
                <select
                  value={capability}
                  onChange={(e) => setCapability(e.target.value)}
                >
                  {["read", "write", "ddl"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <button
                className="button"
                disabled={busy || !branchReady}
                onClick={() =>
                  void run(() =>
                    data({ action: "sql", capability, sql: source }),
                  )
                }
              >
                Run PostgreSQL
              </button>
            </section>
          )}
          <section>
            <h2>Bound Spark execution</h2>
            <button
              className="button"
              onClick={() =>
                void run(async () => {
                  const v = await call("executions");
                  setExecutions(v.executions);
                })
              }
            >
              Show executions
            </button>
            {executions.map((e) => (
              <div key={e.id}>
                <code>{e.id}</code> · {e.runtime_state ?? e.state} ·{" "}
                {e.effective_principal_id}
                <button
                  className="button"
                  onClick={() =>
                    void run(() =>
                      call("stop_execution", {
                        id: e.id,
                        expected_policy: policy?.policy_revision,
                        key: requestKey(),
                      }),
                    )
                  }
                >
                  Terminate {e.id.slice(0, 8)}
                </button>
              </div>
            ))}

            <button
              className="button"
              disabled={busy}
              onClick={() => void run(save)}
            >
              Save source revision
            </button>
            {revision && (
              <p>
                Reviewed revision: <code>{revision}</code>
              </p>
            )}
            <button
              className="button"
              disabled={busy}
              onClick={() => void run(discover)}
            >
              Choose readable datasets
            </button>
            <DatasetList
              tables={tables}
              selected={selected}
              setSelected={setSelected}
            />
            <Field label="Run as service principal (optional ID)">
              <input
                value={effective}
                onChange={(e) => setEffective(e.target.value)}
                placeholder="Use my identity"
              />
            </Field>
            <p>
              Service use requires an act-as grant for this exact source
              revision. Execution requires the configured Linux isolation
              profile.
            </p>
            <button
              className="button primary"
              disabled={busy || !revision}
              onClick={() => void run(execute)}
            >
              Run bound source
            </button>
            {execution && (
              <button
                className="button"
                onClick={() =>
                  void run(() =>
                    call("stop_execution", {
                      id: execution,
                      expected_policy: policy?.policy_revision,
                      key: requestKey(),
                    }),
                  )
                }
              >
                Terminate execution
              </button>
            )}
          </section>
        </>
      )}
      {tab === "Packages" && (
        <>
          <h2>Data and source packages</h2>
          <p>
            Import .sbdata from Data and .ipynb from Notebooks. Foreign .sbproj
            activation, environment hooks and host notebook kernels are
            unavailable in this governed preview.
          </p>
          <p>
            The local-owner console retains its existing offline project
            packaging workflow; that mode does not provide multi-user isolation.
          </p>
        </>
      )}
      {tab === "Access" && (
        <Access
          deployment={deployment}
          policy={policy}
          administrator={administrator}
          refresh={refresh}
          run={run}
        />
      )}
      <Result value={result} />
    </fieldset>
  );
}
function DatasetList({
  tables,
  selected,
  setSelected,
}: {
  tables: Json[];
  selected: string[];
  setSelected: (v: string[]) => void;
}) {
  return (
    <div className="governed-datasets">
      {tables.length === 0 ? (
        <p className="muted">No readable datasets loaded.</p>
      ) : (
        tables.map((t) => (
          <label key={t.table}>
            <input
              type="checkbox"
              checked={selected.includes(t.table)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, t.table]
                    : selected.filter((id) => id !== t.table),
                )
              }
            />
            {t.catalog}.{t.schema}.{t.name}{" "}
            <small>revision {t.publication_revision}</small>
            <code>{"delta.`/admission/data/" + t.table + "`"}</code>
          </label>
        ))
      )}
    </div>
  );
}
function Access({
  deployment,
  policy,
  administrator,
  refresh,
  run,
}: {
  deployment: string;
  policy: Json | null;
  administrator: boolean;
  refresh: () => Promise<void>;
  run: (f: () => Promise<Json | void>) => Promise<void>;
}) {
  const [subject, setSubject] = useState(""),
    [kind, setKind] = useState("principal"),
    [role, setRole] = useState("viewer"),
    [cap, setCap] = useState("read"),
    [branch, setBranch] = useState(""),
    [grant, setGrant] = useState("execute"),
    [effective, setEffective] = useState(""),
    [source, setSource] = useState("");
  const base = () => ({
    deployment,
    subject: { kind, id: subject },
    expected_policy: policy?.policy_revision,
    key: requestKey(),
  });
  const change = (command: Json) =>
    run(async () => {
      const v = await workspace({ action: "policy", command });
      await refresh();
      return v;
    });
  return (
    <>
      <p>
        Project membership, branch data access and execution permissions are
        independent. Every change is checked against the displayed policy
        revision.
      </p>
      <Field label="Subject type">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="principal">Principal</option>
          <option value="group">Group</option>
        </select>
      </Field>
      <Field label="Subject ID">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Project role">
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {["viewer", "editor", "administrator"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
      {[true, false].map((present) => (
        <button
          className="button"
          key={String(present)}
          onClick={() =>
            void run(() =>
              control({
                action: "set_role",
                ...base(),
                role: present ? role : null,
              }),
            )
          }
        >
          {present ? "Grant project role" : "Remove project role"}
        </button>
      ))}
      {administrator && (
        <>
          <h2>Branch data grants</h2>
          <Field label="Branch ID">
            <input value={branch} onChange={(e) => setBranch(e.target.value)} />
          </Field>
          <Field label="Capability">
            <select value={cap} onChange={(e) => setCap(e.target.value)}>
              {[
                "read",
                "write",
                "ddl",
                "copy_source",
                "receive",
                "share",
                "manage_sync",
                "execute_sync",
                "read_sync",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          {[true, false].map((present) => (
            <button
              className="button"
              key={String(present)}
              onClick={() =>
                void change({
                  action: "set_data_grant",
                  ...base(),
                  branch,
                  capability: cap,
                  present,
                })
              }
            >
              {present ? "Grant data capability" : "Revoke data capability"}
            </button>
          ))}
          <h2>Execution and service use</h2>
          <Field label="Execution grant">
            <select value={grant} onChange={(e) => setGrant(e.target.value)}>
              {["execute", "stop_any", "act_as"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          {grant === "act_as" && (
            <>
              <Field label="Effective service principal">
                <input
                  value={effective}
                  onChange={(e) => setEffective(e.target.value)}
                />
              </Field>
              <Field label="Exact source revision">
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </Field>
            </>
          )}
          {[true, false].map((present) => (
            <button
              className="button"
              key={String(present)}
              onClick={() =>
                void change({
                  action: "set_grant",
                  ...base(),
                  grant,
                  effective_principal: grant === "act_as" ? effective : null,
                  source_revision: grant === "act_as" ? source : null,
                  present,
                })
              }
            >
              {present
                ? "Grant execution permission"
                : "Revoke execution permission"}
            </button>
          ))}
        </>
      )}
      <Result value={policy} />
    </>
  );
}
function Administration() {
  const [directory, setDirectory] = useState<Json | null>(null),
    [result, setResult] = useState<Json | null>(null),
    [error, setError] = useState(""),
    [principal, setPrincipal] = useState(""),
    [group, setGroup] = useState(""),
    [label, setLabel] = useState(""),
    [publication, setPublication] = useState(""),
    [revision, setRevision] = useState(1),
    [tables, setTables] = useState(""),
    [present, setPresent] = useState(true),
    [plan, setPlan] = useState<Json | null>(null),
    [busy, setBusy] = useState(true);
  async function run(job: () => Promise<Json>) {
    setBusy(true);
    setError("");
    try {
      setResult(await job());
      setDirectory(await workspace({ action: "directory" }));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(() => workspace({ action: "directory" }));
  }, []);
  return (
    <>
      <p>
        Changes apply to the current realm. Review exact dataset revisions and
        the grant plan before applying sharing.
      </p>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy}>
        <Field label="Principal">
          <select
            value={principal}
            onChange={(e) => {
              setPrincipal(e.target.value);
              setPlan(null);
            }}
          >
            <option value="">Choose identity</option>
            {directory?.principals
              .filter((p: Json) => p.kind !== "local_owner")
              .map((p: Json) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.kind}
                  {p.disabled ? " · disabled" : ""}
                </option>
              ))}
          </select>
        </Field>
        <p>
          <code>{principal}</code>
        </p>
        <button
          className="button"
          onClick={() =>
            void run(() => workspace({ action: "revoke", principal }))
          }
        >
          Revoke sessions
        </button>
        <button
          className="button"
          onClick={() =>
            void run(() =>
              workspace({ action: "disable", principal, disabled: true }),
            )
          }
        >
          Disable principal
        </button>
        <button
          className="button"
          onClick={() =>
            void run(() =>
              workspace({ action: "disable", principal, disabled: false }),
            )
          }
        >
          Enable principal
        </button>
        <Field label="New group or service label">
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <button
          className="button"
          onClick={() => void run(() => workspace({ action: "group", label }))}
        >
          Create group
        </button>
        <button
          className="button"
          onClick={() =>
            void run(() => workspace({ action: "service", label }))
          }
        >
          Create service principal
        </button>
        <Field label="Group">
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Choose group</option>
            {directory?.groups.map((g: Json) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        {[true, false].map((present) => (
          <button
            className="button"
            key={String(present)}
            onClick={() =>
              void run(() =>
                workspace({ action: "membership", group, principal, present }),
              )
            }
          >
            {present ? "Add group member" : "Remove group member"}
          </button>
        ))}
        <h2>Catalog sharing</h2>
        <button
          className="button"
          onClick={() =>
            void run(() =>
              workspace({ action: "catalog", command: { action: "status" } }),
            )
          }
        >
          Refresh catalog authority
        </button>
        <button
          className="button"
          onClick={() =>
            void run(() =>
              workspace({
                action: "catalog",
                command: { action: "map_principal", principal },
              }),
            )
          }
        >
          Enroll catalog identity
        </button>
        <button
          className="button"
          onClick={() =>
            void run(async () => {
              const v = await workspace({
                action: "catalog",
                command: { action: "plan", changes: [] },
              });
              setPlan(v);
              return v;
            })
          }
        >
          Review current catalog grants
        </button>
        <Field label="Publication ID">
          <input
            value={publication}
            onChange={(e) => {
              setPublication(e.target.value);
              setPlan(null);
            }}
          />
        </Field>
        <Field label="Publication revision">
          <input
            type="number"
            min={1}
            value={revision}
            onChange={(e) => {
              setRevision(Number(e.target.value));
              setPlan(null);
            }}
          />
        </Field>
        <Field label="Table IDs (comma separated)">
          <input
            value={tables}
            onChange={(e) => {
              setTables(e.target.value);
              setPlan(null);
            }}
          />
        </Field>
        <Field label="Sharing change">
          <select
            value={String(present)}
            onChange={(e) => {
              setPresent(e.target.value === "true");
              setPlan(null);
            }}
          >
            <option value="true">Grant SELECT</option>
            <option value="false">Revoke SELECT</option>
          </select>
        </Field>
        <button
          className="button"
          onClick={() =>
            void run(async () => {
              const v = await workspace({
                action: "catalog",
                command: {
                  action: "plan",
                  changes: [
                    {
                      publication,
                      publication_revision: revision,
                      subject: { kind: "principal", id: principal },
                      tables: tables
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                      present,
                    },
                  ],
                },
              });
              setPlan(v);
              return v;
            })
          }
        >
          Review sharing plan
        </button>
        {plan && (
          <>
            <Result value={plan} />
            <button
              className="button primary"
              onClick={() =>
                void run(async () => {
                  const v = await workspace({
                    action: "catalog",
                    command: {
                      action: "apply",
                      plan: plan.id,
                      key: requestKey(),
                    },
                  });
                  setPlan(null);
                  return v;
                })
              }
            >
              Apply reviewed sharing
            </button>
          </>
        )}
      </fieldset>
      <details>
        <summary>Realm directory</summary>
        <Result value={directory} />
      </details>
      <Result value={result} />
    </>
  );
}
function Audit() {
  const [page, setPage] = useState<Json | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  async function load(after = 0) {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      setPage(await workspace({ action: "audit", after }));
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <p>
        Correlate actor, effective principal, policy revision, source revision
        and execution ID. Query text, rows and credentials are excluded.
      </p>
      <button className="button" disabled={loading} onClick={() => void load()}>
        Refresh audit
      </button>
      <button
        className="button"
        disabled={loading || !page?.events.length}
        onClick={() => void load(page?.through)}
      >
        Next audit page
      </button>
      {error && <p role="alert">{error}</p>}
      <Result value={page} />
    </>
  );
}

function NotebookEditor({
  source,
  onChange,
}: {
  source: string;
  onChange: (v: string) => void;
}) {
  let notebook: Json;
  try {
    notebook = JSON.parse(source);
    if (!Array.isArray(notebook.cells)) throw new Error();
  } catch {
    return (
      <p role="alert">Import a valid .ipynb notebook to edit its cells.</p>
    );
  }
  return (
    <section aria-label="Notebook cells">
      {notebook.cells.map((cell: Json, index: number) => (
        <Field
          key={index}
          label={"Cell " + (index + 1) + " · " + cell.cell_type}
        >
          <textarea
            rows={6}
            value={
              Array.isArray(cell.source)
                ? cell.source.join("")
                : (cell.source ?? "")
            }
            onChange={(e) => {
              notebook.cells[index].source = [e.target.value];
              onChange(JSON.stringify(notebook));
            }}
          />
        </Field>
      ))}
      <button
        className="button"
        onClick={() => {
          notebook.cells.push({
            id: crypto.randomUUID(),
            cell_type: "code",
            metadata: {},
            source: [""],
            outputs: [],
            execution_count: null,
          });
          onChange(JSON.stringify(notebook));
        }}
      >
        Add code cell
      </button>
    </section>
  );
}
