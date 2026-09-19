import { useEffect, useRef, useState } from "react";
import {
  project,
  type ProjectSource,
  type ProjectView,
  type ProjectInspection,
  type PackageReport,
  type ProjectPlan,
  type ProjectOperation,
  type Overview,
} from "./api";
const current: ProjectSource = { kind: "current" };
const pending = (op: ProjectOperation | null) =>
  !!op && ["queued", "preparing", "activating"].includes(op.state);
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Project request failed.";
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
type Import = { source: ProjectSource; name: string; worktree: string };
type Transfer = {
  id: string;
  bytes: number;
  report: PackageReport;
  kind: "upload" | "export";
  destination: string;
};
function Graph({ inspection }: { inspection: ProjectInspection }) {
  return (
    <>
      <p>
        Target: <strong>{inspection.target}</strong> · Required capabilities:{" "}
        {inspection.capabilities.join(", ") || "None"}
      </p>
      <div className="table-scroll">
        <table aria-label="Package resource graph">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Kind</th>
              <th>Source</th>
              <th>Depends on</th>
            </tr>
          </thead>
          <tbody>
            {inspection.order.map((key) => {
              const r = inspection.resources[key];
              return (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{r.declaration.kind}</td>
                  <td>{r.declaration.file ?? "—"}</td>
                  <td>{r.dependencies.join(", ") || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Object.entries(inspection.environments).map(([name, env]) => (
        <p key={name}>
          <strong>{name}</strong>:{" "}
          {Object.keys(env.bundles ?? {}).length
            ? `Dependency bundle inventories verified for ${Object.keys(env.bundles!).join(", ")}. Runtime preparation is checked by apply.`
            : "No offline dependency bundle declared. Export an environment bundle with supabricks env export and add it to this environment before planning."}
        </p>
      ))}
      <details>
        <summary>
          Files that travel ({Object.keys(inspection.files).length})
        </summary>
        <ul>
          {Object.keys(inspection.files).map((file) => (
            <li key={file}>
              <code>{file}</code>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
export function Projects({
  data,
  visible,
}: {
  data: Overview;
  visible: boolean;
}) {
  const [source, setSource] = useState<ProjectSource>(current);
  const [imports, setImports] = useState<Import[]>([]);
  const [view, setView] = useState<ProjectView | null>(null);
  const [target, setTarget] = useState("");
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [plan, setPlan] = useState<ProjectPlan | null>(null);
  const [operation, setOperation] = useState<ProjectOperation | null>(null);
  const [key, setKey] = useState("");
  const [bindKey, setBindKey] = useState(() => crypto.randomUUID());
  const [attach, setAttach] = useState("");
  const [adopt, setAdopt] = useState("{}");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [asset, setAsset] = useState<{
    logical: string;
    content: string;
    revision: string;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const cancelled = useRef(false);
  const mounted = useRef(false);
  const refreshEpoch = useRef(0);
  async function refresh(selected = source, recoverLatest = true) {
    const epoch = ++refreshEpoch.current;
    const [v, list] = await Promise.all([
      project<ProjectView>(selected, {
        action: "view",
        target: target || null,
      }),
      project<{ imports: Import[] }>(current, { action: "list" }),
    ]);
    if (epoch !== refreshEpoch.current) return;
    setView(v);
    setImports(list.imports);
    if (recoverLatest && v.operation) {
      setOperation(v.operation);
      setKey(v.operation.key);
      setUncertain(false);
    }
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    if (!visible || mounted.current) return;
    mounted.current = true;
    void run("Loading project", refresh);
  }, [visible]);
  useEffect(() => {
    if (!pending(operation)) return;
    let alive = true,
      polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const next = await project<ProjectOperation>(source, {
          action: "apply",
          command: { action: "status", id: operation!.id },
        });
        if (!alive) return;
        setOperation(next);
        setUncertain(false);
        if (!pending(next)) await refresh();
      } catch (e) {
        if (alive) {
          setError(message(e));
          setUncertain(true);
        }
      } finally {
        polling = false;
      }
    }, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [operation?.id, operation?.state, source]);
  async function select(selected: ProjectSource) {
    setSource(selected);
    setView(null);
    setPlan(null);
    setOperation(null);
    setKey("");
    setUncertain(false);
    setAsset(null);
    setAttach("");
    setBindKey(crypto.randomUUID());
    await refresh(selected);
  }
  async function discard() {
    if (transfer)
      await project(current, { action: "dispose", id: transfer.id }).catch(
        () => {},
      );
    setTransfer(null);
  }
  async function upload(file: File) {
    if (file.size === 0 || file.size > 300 * 1024 * 1024)
      throw new Error("Select a .sbproj package between 1 byte and 300 MiB.");
    await discard();
    cancelled.current = false;
    const slot = await project<{ id: string; chunk_bytes: number }>(current, {
      action: "begin",
      bytes: file.size,
    });
    try {
      for (let offset = 0; offset < file.size; offset += slot.chunk_bytes) {
        if (cancelled.current)
          throw new Error(
            "Upload cancelled. Your open query and notebook drafts are preserved.",
          );
        const bytes = new Uint8Array(
          await file.slice(offset, offset + slot.chunk_bytes).arrayBuffer(),
        );
        await project(current, {
          action: "chunk",
          id: slot.id,
          offset,
          hex: hex(bytes),
        });
        setBusy(
          `Uploading ${Math.round(((offset + bytes.length) / file.size) * 100)}%`,
        );
      }
      if (cancelled.current) throw new Error("Upload cancelled.");
      const report = await project<PackageReport>(current, {
        action: "verify",
        id: slot.id,
        target: target || null,
      });
      setTransfer({
        id: slot.id,
        bytes: file.size,
        report,
        kind: "upload",
        destination: crypto.randomUUID(),
      });
    } catch (e) {
      await project(current, { action: "dispose", id: slot.id }).catch(
        () => {},
      );
      throw e;
    }
  }
  async function download() {
    if (!transfer) return;
    const parts: ArrayBuffer[] = [];
    for (let offset = 0; offset < transfer.bytes; ) {
      const part = await project<{ hex: string }>(current, {
        action: "download",
        id: transfer.id,
        offset,
      });
      const bytes = Uint8Array.from(part.hex.match(/../g) ?? [], (v) =>
        parseInt(v, 16),
      );
      if (!bytes.length)
        throw new Error(
          "Package download ended early. Preview the export again.",
        );
      parts.push(bytes.buffer);
      offset += bytes.length;
      setBusy(`Downloading ${Math.round((offset / transfer.bytes) * 100)}%`);
    }
    const url = URL.createObjectURL(
      new Blob(parts, { type: "application/gzip" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "project.sbproj";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setNotice(
      "Package downloaded. Credentials and runtime data stay on this device.",
    );
  }
  async function reopen(environment: string | null) {
    // Create a new tab from the user's gesture, preserving all drafts in this tab.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      for (let attempt = 0; attempt < 15; attempt++) {
        const result = await project<{ state?: string; url?: string }>(source, {
          action: "reopen",
          environment,
        });
        if (result.url) {
          const url = new URL(result.url);
          if (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
            throw new Error("Unexpected local console URL.");
          if (!tab)
            throw new Error(
              "Allow pop-ups, then choose Open console again. Your deployment is ready.",
            );
          tab.location.href = url.href;
          setNotice(
            "Opened the deployment in another tab. No kernel was started.",
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      throw new Error("Console is still starting. Choose Open console again.");
    } catch (e) {
      tab?.close();
      throw e;
    }
  }
  const locked = !!busy || pending(operation);
  const inspection = view?.inspection;
  const installed = view?.installed;
  return (
    <section
      className="project-packages"
      hidden={!visible}
      aria-label="Project packages"
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROJECT PACKAGES</span>
          <h1>Build here. Bring it with you.</h1>
          <p>
            Inspect source, choose a deployment, review its plan and apply it
            locally.
          </p>
        </div>
      </div>
      <p>
        Queries, notebooks, declared fixtures and dependency bundles travel.
        Credentials, live databases, notebook outputs and prepared environments
        stay local. Opening a package never starts a kernel.
      </p>
      {error && (
        <div className="notice" role="alert">
          {error}
          <p>
            Your drafts are preserved. Fix the reported input or binding, then
            refresh or plan again. If a reply was lost, recover its request key
            before retrying.
          </p>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">{busy}</p>}
      <div className="package-actions">
        <label>
          Project source
          <select
            aria-label="Project source"
            disabled={locked || uncertain}
            value={source.kind === "current" ? "current" : source.id}
            onChange={(e) =>
              void run("Loading project", () =>
                select(
                  e.target.value === "current"
                    ? current
                    : { kind: "imported", id: e.target.value },
                ),
              )
            }
          >
            <option value="current">
              Current project — {data.project.name}
            </option>
            {imports.map((i) => (
              <option
                key={i.source.kind === "imported" ? i.source.id : "current"}
                value={i.source.kind === "imported" ? i.source.id : "current"}
              >
                {i.name} — {i.worktree.split("/").pop()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Package target
          <input
            aria-label="Package target"
            value={target}
            disabled={locked || (!!view?.context && source.kind !== "current")}
            placeholder="Default target"
            onChange={(e) => {
              setTarget(e.target.value);
              setPlan(null);
            }}
          />
        </label>
        <button
          className="button"
          disabled={locked}
          onClick={() => void run("Refreshing project", refresh)}
        >
          Refresh project
        </button>
        <label className="button">
          Inspect package
          <input
            aria-label="Select project package"
            type="file"
            accept=".sbproj"
            disabled={locked || uncertain}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void run("Uploading package", () => upload(file));
            }}
          />
        </label>
        {busy.startsWith("Uploading") && (
          <button
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Cancel upload
          </button>
        )}
        <button
          className="button"
          disabled={locked || inspection?.definition.format_version !== 2}
          onClick={() =>
            void run("Preparing export preview", async () => {
              await discard();
              const result = await project<{
                id: string;
                bytes: number;
                report: PackageReport;
              }>(source, {
                action: "export",
                target: view?.context?.target ?? (target || null),
              });
              setTransfer({ ...result, kind: "export", destination: "" });
            })
          }
        >
          Preview export
        </button>
      </div>
      {transfer && (
        <article className="package-card" aria-label="Package preview">
          <h2>
            Verified package: {transfer.report.inspection.definition.name}
          </h2>
          <code>{transfer.report.archive_sha256}</code>
          <Graph inspection={transfer.report.inspection} />
          <ul>
            {transfer.report.exclusions.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {transfer.kind === "upload" ? (
            <button
              className="button primary"
              disabled={locked || uncertain}
              onClick={() =>
                void run("Unpacking project", async () => {
                  const result = await project<{ source: ProjectSource }>(
                    current,
                    {
                      action: "unpack",
                      id: transfer.id,
                      destination: transfer.destination,
                      target: transfer.report.inspection.target,
                    },
                  );
                  await select(result.source);
                  setNotice(
                    "Unpacked into a new source directory. Choose a deployment before planning.",
                  );
                })
              }
            >
              Unpack as new project
            </button>
          ) : (
            <button
              className="button primary"
              disabled={locked}
              onClick={() => void run("Downloading package", download)}
            >
              Download package
            </button>
          )}
          <button
            className="button"
            disabled={!!busy}
            onClick={() => void run("Discarding preview", discard)}
          >
            Discard preview
          </button>
        </article>
      )}
      {view && (
        <article className="package-card" aria-label="Project identity">
          <h2>Source and deployment</h2>
          <dl>
            <dt>Worktree</dt>
            <dd>
              <code>{view.worktree}</code>
            </dd>
            <dt>Definition</dt>
            <dd>
              <code>
                {inspection?.definition.id ?? view.context?.definition_id}
              </code>
            </dd>
            <dt>Source revision</dt>
            <dd>
              <code>
                {inspection?.source_sha256 ?? "Source needs attention"}
              </code>
            </dd>
            <dt>Installed revision</dt>
            <dd>
              <code>{installed?.active_revision ?? "Not installed"}</code>
            </dd>
            <dt>Source state</dt>
            <dd>
              {!installed?.active_revision
                ? "Not installed"
                : inspection?.source_sha256 === view.installed_source_sha256
                  ? "Matches installed source"
                  : "Local source differs from installed revision"}
            </dd>
          </dl>
          {view.source_error && <p role="alert">{view.source_error.message}</p>}
          {view.context ? (
            <>
              <dl>
                <dt>Deployment</dt>
                <dd>
                  <code>{view.context.deployment_id}</code>
                </dd>
                <dt>Runtime project</dt>
                <dd>
                  <code>{view.context.runtime_project_id}</code>
                </dd>
                <dt>Target</dt>
                <dd>{view.context.target}</dd>
                <dt>Access</dt>
                <dd>Local OS owner · {view.context.workspace_id}</dd>
              </dl>
              <button
                className="button"
                disabled={!!busy}
                onClick={() => void run("Opening console", () => reopen(null))}
              >
                Open console in new tab
              </button>
            </>
          ) : (
            <>
              <p>
                {view.binding_error?.message ??
                  "This source has no deployment."}
              </p>
              <button
                className="button primary"
                disabled={locked || !inspection}
                onClick={() =>
                  void run("Creating deployment", async () => {
                    await project(source, {
                      action: "bind",
                      key: bindKey,
                      target: target || null,
                    });
                    await refresh();
                  })
                }
              >
                Create local deployment
              </button>
              <label>
                Existing deployment
                <select
                  aria-label="Existing deployment"
                  value={attach}
                  disabled={locked}
                  onChange={(e) => setAttach(e.target.value)}
                >
                  <option value="">Choose explicitly</option>
                  {view.deployments.map((d) => (
                    <option key={d.deployment_id} value={d.deployment_id}>
                      {d.deployment_id} — {d.target}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button"
                disabled={locked || !attach}
                onClick={() =>
                  void run("Attaching deployment", async () => {
                    await project(source, {
                      action: "attach",
                      deployment: attach,
                    });
                    await refresh();
                  })
                }
              >
                Attach selected deployment
              </button>
            </>
          )}
          {inspection?.definition.format_version === 1 && (
            <p>
              This is a legacy runtime project. To export it, declare its
              portable resources in a format-2 supabricks.toml, then use project
              adopt with the existing runtime identity.
            </p>
          )}
          {inspection && <Graph inspection={inspection} />}
        </article>
      )}
      {view?.context && !view.context.legacy && (
        <article className="package-card" aria-label="Deployment plan">
          <h2>Review and apply</h2>
          <p>
            Database bindings are explicit. New databases are retained when an
            apply fails or is cancelled.
          </p>
          <details>
            <summary>Adopt existing database bindings</summary>
            <label>
              Logical name to branch UUID (JSON)
              <textarea
                aria-label="Database bindings"
                value={adopt}
                disabled={locked || uncertain}
                onChange={(e) => {
                  setAdopt(e.target.value);
                  setPlan(null);
                }}
              />
            </label>
            <p>
              For example: {`{"database.main":"branch-uuid"}`}. Adoption and
              data initialization require separate applies.
            </p>
          </details>
          <button
            className="button"
            disabled={locked || uncertain}
            onClick={() =>
              void run("Planning deployment", async () => {
                const options = {
                  adopt: JSON.parse(adopt) as Record<string, string>,
                };
                const result = await project<ProjectPlan>(source, {
                  action: "apply",
                  command: { action: "plan", options },
                });
                setPlan(result);
                setOperation(null);
                setKey(crypto.randomUUID());
              })
            }
          >
            Plan deployment
          </button>
          {plan && (
            <>
              <p>
                Plan digest: <code>{plan.digest}</code>
              </p>
              <div className="table-scroll">
                <table aria-label="Deployment steps">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Action</th>
                      <th>Database binding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.steps.map((s) => (
                      <tr key={s.logical}>
                        <td>{s.logical}</td>
                        <td>{s.action}</td>
                        <td>{s.branch ?? s.database ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Offline dependencies:{" "}
                {Object.keys(plan.dependency_closure ?? {}).length
                  ? "Bundle inventories verified. Apply prepares and validates the runtime closure before activation."
                  : "No notebook environments require preparation."}
              </p>
              {plan.retained.length > 0 && (
                <p>Retained resources: {plan.retained.join(", ")}</p>
              )}
              <button
                className="button primary"
                disabled={locked || uncertain || !!operation}
                onClick={() =>
                  void run("Applying reviewed plan", async () => {
                    setUncertain(true);
                    try {
                      const op = await project<ProjectOperation>(source, {
                        action: "apply",
                        command: { action: "apply", plan, key },
                      });
                      setOperation(op);
                      setUncertain(false);
                    } catch (e) {
                      throw e;
                    }
                  })
                }
              >
                Apply reviewed plan
              </button>
            </>
          )}
          <label>
            Apply request key
            <input
              aria-label="Apply request key"
              value={key}
              readOnly={!!plan || pending(operation)}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={!!busy || !key}
            onClick={() =>
              void run("Recovering apply", async () => {
                const found = await project<{
                  operation: ProjectOperation | null;
                }>(source, {
                  action: "apply",
                  command: { action: "find", key },
                });
                setOperation(found.operation);
                setUncertain(false);
                if (found.operation) setPlan(found.operation.plan);
                else {
                  setPlan(null);
                  setNotice(
                    "No apply was admitted for this key. Plan again before applying.",
                  );
                }
                await refresh(source, false);
              })
            }
          >
            Recover apply by key
          </button>
          {operation && (
            <div role="status">
              <h3>Apply {operation.state}</h3>
              <p>
                {operation.next_step} of {operation.plan.steps.length} steps
                complete · <code>{operation.id}</code>
              </p>
              {operation.error && <p>{operation.error}</p>}
              {pending(operation) && (
                <button
                  className="button"
                  disabled={!!busy || operation.cancel_requested}
                  onClick={() =>
                    void run("Cancelling apply", async () => {
                      setOperation(
                        await project(source, {
                          action: "apply",
                          command: { action: "cancel", id: operation.id },
                        }),
                      );
                    })
                  }
                >
                  {operation.cancel_requested
                    ? "Cancellation requested"
                    : "Cancel apply"}
                </button>
              )}
              {!pending(operation) && operation.state !== "succeeded" && (
                <p>
                  Previous installed revision remains active. Fix the
                  preparation error and plan again; committed initialization and
                  retained databases are reconciled.
                </p>
              )}
            </div>
          )}
        </article>
      )}
      {installed?.active_revision && (
        <article className="package-card" aria-label="Installed resources">
          <h2>Installed resources</h2>
          <p>
            {installed.preparation_needed
              ? "Environment preparation is needed. Plan and apply again before running notebooks."
              : "Installed environment preparation is current."}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Database / environment</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(installed.resources).map(([logical, r]) => (
                  <tr key={logical}>
                    <td>{logical}</td>
                    <td>
                      <code>
                        {r.branch ?? r.generation ?? r.database ?? "—"}
                      </code>
                    </td>
                    <td>
                      {r.file &&
                        ["postgres_query", "spark_query", "notebook"].includes(
                          r.kind,
                        ) && (
                          <button
                            disabled={!!busy}
                            onClick={() =>
                              void run("Reading installed asset", async () => {
                                setAsset(
                                  await project(source, {
                                    action: "apply",
                                    command: { action: "asset", logical },
                                  }),
                                );
                              })
                            }
                          >
                            View {logical}
                          </button>
                        )}
                      {r.kind === "environment" && (
                        <button
                          disabled={!!busy}
                          onClick={() =>
                            void run("Opening environment console", () =>
                              reopen(logical),
                            )
                          }
                        >
                          Open {logical}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {asset && (
            <div>
              <h3>{asset.logical} · installed source (read only)</h3>
              <pre className="package-asset">{asset.content}</pre>
              <label>
                New draft path
                <input
                  aria-label="New draft path"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="queries/new-name.sql or notebooks/new-name.ipynb"
                />
              </label>
              <button
                className="button"
                disabled={!!busy || !draft}
                onClick={() =>
                  void run("Copying installed asset", async () => {
                    await project(source, {
                      action: "apply",
                      command: {
                        action: "draft",
                        logical: asset.logical,
                        path: draft,
                      },
                    });
                    setNotice(
                      `Created ${draft}. Existing files were preserved. Declare the new file in supabricks.toml to package it.`,
                    );
                  })
                }
              >
                Copy to new source draft
              </button>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
