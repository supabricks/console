import { useEffect, useRef, useState } from "react";
import {
  environment,
  type EnvironmentStatus,
  type EnvironmentOperation,
  type EnvironmentChange,
  type EnvironmentInputs,
  type NotebookContext,
  type Overview,
} from "../api";

const working = (o: EnvironmentOperation) =>
  !["ready", "failed", "cancelled"].includes(o.state);
function retainedKey(storage: string) {
  try {
    return sessionStorage.getItem(storage);
  } catch {
    return null;
  }
}
const normalized = (s: string) => s.toLowerCase().replace(/[-_.]+/g, "-");

export function EnvironmentPanel({
  visible,
  data,
  context,
  onPrepared,
}: {
  visible: boolean;
  data: Overview;
  context: NotebookContext | null;
  onPrepared: (id: string | null) => void;
}) {
  const [status, setStatus] = useState<EnvironmentStatus | null>(null);
  const [error, setError] = useState("");
  const [requirement, setRequirement] = useState("");
  const [offline, setOffline] = useState(true);
  const [source, setSource] = useState(".");
  const [bundle, setBundle] = useState("");
  const [busy, setBusy] = useState(false);
  const [unsubmitted, setUnsubmitted] = useState(false);
  // Only keys are retained. An interrupted browser request is discovered, never replayed.
  const storage = `supabricks:environment:${data.project.id}:${data.worktree}`;
  const [pending, setPending] = useState<string | null>(() =>
    retainedKey(storage),
  );
  const pendingRef = useRef(pending),
    locked = useRef(false),
    mounted = useRef(true),
    revision = useRef(0);
  function remember(key: string | null) {
    pendingRef.current = key;
    setUnsubmitted(false);
    try {
      if (key) sessionStorage.setItem(storage, key);
      else sessionStorage.removeItem(storage);
    } catch {
      /* Keep recovery available in memory when browser storage is disabled. */
    }
    if (mounted.current) setPending(key);
  }
  async function refresh() {
    const requested = ++revision.current;
    const next = await environment<EnvironmentStatus>({ action: "inspect" });
    if (!mounted.current || requested !== revision.current) return;
    setStatus(next);
    if (pendingRef.current) {
      const key = pendingRef.current;
      const found = await environment<{
        operation: EnvironmentOperation | null;
      }>({ action: "find", key });
      if (mounted.current && pendingRef.current === key) {
        if (found.operation) {
          remember(null);
          setError("");
        } else setUnsubmitted(true);
      }
    }
  }
  async function perform(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    revision.current++;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!visible) return;
    let alive = true,
      checking = false;
    async function poll() {
      if (!alive || locked.current || checking) return;
      checking = true;
      try {
        await refresh();
      } catch (e) {
        if (alive && mounted.current)
          setError(e instanceof Error ? e.message : String(e));
      } finally {
        checking = false;
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [visible]);
  async function submit(change?: EnvironmentChange) {
    if (!status || pendingRef.current) return;
    const key = crypto.randomUUID();
    remember(key);
    try {
      await environment<EnvironmentOperation>(
        change && status.inputs
          ? {
              action: "manage",
              key,
              expected: status.inputs,
              change,
              offline: change.kind === "import_bundle" || offline,
            }
          : { action: "initialize", key, template: "base" },
      );
      remember(null);
    } catch (e) {
      // Even a timeout may have admitted the operation. Resolve its key first.
      const found = await environment<{
        operation: EnvironmentOperation | null;
      }>({ action: "find", key });
      if (found.operation) remember(null);
      else {
        remember(null);
        throw e;
      }
    }
    await refresh();
  }
  const active = status?.operations.filter(working) ?? [];
  const disabled = busy || !!pending || active.length > 0 || !status;
  const editable =
    !disabled && !!status?.inputs && status.declaration.state === "present";
  const prepared = status?.environments.find(
    (e) => e.id === status.active_generation,
  );
  const selected = status?.environments.find(
    (e) => e.id === context?.environment?.id,
  );
  const packages = Object.keys({
    ...prepared?.packages,
    ...selected?.packages,
  }).sort();
  const declared = status?.declaration.requirements ?? [];
  const latest = status?.operations[0];
  useEffect(() => {
    onPrepared(
      status && !status.preparation_needed && prepared?.compatible
        ? status.active_generation
        : null,
    );
  }, [status, onPrepared]);
  return (
    <details className="environment-panel">
      <summary>
        Python environment and packages
        {status &&
          ` · Python ${status.python_version} · ${active.length ? active[0].state : error || status.declaration.error || latest?.state === "failed" ? "needs attention" : status.preparation_needed ? "preparation needed" : "ready"}`}
      </summary>
      {!status && <p role="status">Reading environment status…</p>}
      {status && (
        <>
          <p>
            Python{" "}
            {context?.environment
              ? (selected?.python_version ?? "version not recorded")
              : status.python_version}
            .{" "}
            {context?.environment
              ? `Selected kernel environment: ${context.environment.id.slice(0, 8)} (${context.state}).`
              : "No kernel environment selected."}
          </p>
          <p data-testid="prepared-environment">
            {status.preparation_needed
              ? "Preparation needed for the next start."
              : `Ready for next start: ${status.active_generation?.slice(0, 8)}.`}{" "}
            {context?.environment &&
              context.environment.id !== status.active_generation &&
              "The selected kernel keeps its existing packages."}
          </p>
          {prepared && !prepared.compatible && (
            <p role="alert">
              The prepared environment belongs to another runtime version.
              Prepare it again before starting.
            </p>
          )}
          {status.declaration.state === "absent" && (
            <p>
              Start kernel prepares the bundled base environment offline. To add
              packages first, choose Initialize environment.
            </p>
          )}
          {status.declaration.error && (
            <p role="alert">{status.declaration.error}</p>
          )}
          <p>
            Package changes take effect after “Use prepared environment”. This
            restarts Python and discards variables, keeps the analytical
            snapshot, and does not run saved cells.
          </p>
          <p className="subtle">
            Use these controls for packages instead of %pip or %uv. Project
            packages are available in Python notebook cells; Sail worker
            dependencies are separate.
          </p>
          <div className="toolbar">
            <button disabled={busy} onClick={() => void perform(refresh)}>
              Refresh environment status
            </button>
            {status.declaration.state === "absent" && (
              <button
                disabled={disabled}
                onClick={() => void perform(() => submit())}
              >
                Initialize environment
              </button>
            )}
            <button
              disabled={!editable}
              onClick={() => void perform(() => submit({ kind: "sync" }))}
            >
              Prepare environment
            </button>
            <label>
              <input
                type="checkbox"
                checked={offline}
                onChange={(e) => setOffline(e.target.checked)}
              />{" "}
              Offline packages only
            </label>
          </div>
          <p className="subtle">
            {offline
              ? "Uses bundled or cached wheels. Missing wheels require a bundle import or enabling downloads."
              : "Downloads approved registry wheels from PyPI when you add, remove or prepare packages. Source builds and private indexes are unsupported."}
          </p>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              if (editable && requirement.trim())
                void perform(() =>
                  submit({ kind: "add", requirement: requirement.trim() }),
                );
            }}
          >
            <label>
              Package requirement{" "}
              <input
                value={requirement}
                maxLength={1024}
                placeholder="example-package==1.2.3"
                onChange={(e) => setRequirement(e.target.value)}
              />
            </label>
            <button type="submit" disabled={!editable || !requirement.trim()}>
              Add package
            </button>
          </form>
          <p>
            Declared packages:{" "}
            {declared.length ? declared.join(", ") : "No declarations loaded."}
          </p>
          {declared.map((req) => {
            const name = req.trim().match(/^[A-Za-z0-9][A-Za-z0-9._-]*/)?.[0];
            return (
              name &&
              !status.protected_packages[normalized(name)] && (
                <button
                  key={req}
                  disabled={!editable}
                  onClick={() =>
                    void perform(() =>
                      submit({ kind: "remove", package: name }),
                    )
                  }
                >
                  Remove {name}
                </button>
              )
            );
          })}
          <details>
            <summary>Installed package versions ({packages.length})</summary>
            <p>
              Versions recorded at preparation. Starting or adopting a kernel
              verifies its files again.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Selected kernel</th>
                  <th>Prepared</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((name) => (
                  <tr key={name}>
                    <td>
                      {name}
                      {status.protected_packages[name] ? " (runtime)" : ""}
                    </td>
                    <td>{selected?.packages?.[name] ?? "—"}</td>
                    <td>{prepared?.packages?.[name] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {active.map((o) => (
            <div key={o.id} role="status">
              Environment operation: {o.state}
              {o.cancel_requested ? " (cancelling)" : ""}.{" "}
              <button
                disabled={busy || o.cancel_requested}
                onClick={() =>
                  void perform(async () => {
                    await environment({ action: "cancel", id: o.id });
                    await refresh();
                  })
                }
              >
                Cancel package operation
              </button>
            </div>
          ))}
          {!active.length && latest && (
            <p role={latest.state === "failed" ? "alert" : "status"}>
              Last environment operation: {latest.state}. {latest.error}{" "}
              {latest.result?.changes
                ?.map(
                  (c) =>
                    `${c.package}: ${c.before ?? "absent"} → ${c.after ?? "removed"}`,
                )
                .join("; ")}
            </p>
          )}
          <details>
            <summary>Import environment and diagnostics</summary>
            <p>
              Paths are on the machine running Supabricks. Review the
              declaration or bundle before importing. Initialize an environment
              first if none exists.
            </p>
            <label>
              Project declaration directory{" "}
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <button
              disabled={!editable || !source}
              onClick={() =>
                void perform(async () => {
                  const declaration = await environment<{
                    inputs: EnvironmentInputs;
                  }>({ action: "declaration", path: source });
                  await submit({
                    kind: "adopt",
                    path: source,
                    expected: declaration.inputs,
                  });
                })
              }
            >
              Import project declaration
            </button>
            <label>
              Offline bundle path{" "}
              <input
                value={bundle}
                onChange={(e) => setBundle(e.target.value)}
              />
            </label>
            <button
              disabled={!editable || !bundle.startsWith("/")}
              onClick={() =>
                void perform(() =>
                  submit({ kind: "import_bundle", path: bundle }),
                )
              }
            >
              Import offline bundle
            </button>
            <button
              disabled={!editable}
              onClick={() => void perform(() => submit({ kind: "lock" }))}
            >
              Resolve lock
            </button>
            <p>
              After moving a project, prepare its checked-in declarations again.
              Environments are bound to the project location. A missing lock
              must be restored before preparation.
            </p>
            <pre>
              {JSON.stringify(
                {
                  target: status.target,
                  inputs: status.inputs,
                  prepared: status.active_generation,
                  selected: context?.environment,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      )}
      {pending && busy && <p role="status">Submitting package request…</p>}
      {pending && !busy && (
        <p role="alert">
          The package request outcome is unknown. Refresh status to recover
          request {pending}. Do not submit it again.
        </p>
      )}
      {pending && unsubmitted && (
        <button disabled={busy} onClick={() => remember(null)}>
          Clear request confirmed unsubmitted
        </button>
      )}
      {error && (
        <p role="alert">
          {error} Refresh status before explicitly retrying; notebook edits are
          retained.
        </p>
      )}
    </details>
  );
}
