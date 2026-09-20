import { useEffect, useId, useRef, useState } from "react";
import {
  project,
  type Overview,
  type ProjectSource,
  type ProjectOperation,
} from "./api";

type Pending = { id: string; name: string; attempt: string };
type Entry = { source: ProjectSource; name: string; worktree: string };
type Creation = Entry & { operation: ProjectOperation };
const current: ProjectSource = { kind: "current" };
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Unable to create the project.";

export function NewProject({ data }: { data: Overview }) {
  const formId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(false);
  const alive = useRef(true);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const storage = `supabricks.project.create.${data.data_dir}`;
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  async function show() {
    setError("");
    dialog.current?.showModal();
    try {
      const saved = localStorage.getItem(storage);
      if (saved) {
        const value = JSON.parse(saved) as Pending;
        if (
          typeof value.id !== "string" ||
          typeof value.name !== "string" ||
          typeof value.attempt !== "string"
        )
          throw new Error(
            "The saved setup is invalid. Clear this site's saved data and select the project below.",
          );
        setPending(value);
        setName(value.name);
      }
      const list = await project<{ projects: Entry[] }>(current, {
        action: "list",
      });
      if (alive.current) setEntries(list.projects);
    } catch (e) {
      setError(message(e));
    }
  }

  async function open(source: ProjectSource) {
    for (let i = 0; i < 50; i++) {
      const result = await project<{ state: string; url?: string }>(source, {
        action: "reopen",
        environment: null,
      });
      if (!alive.current) return;
      if (result.url) {
        const url = new URL(result.url);
        if (
          url.protocol !== "http:" ||
          url.hostname !== "127.0.0.1" ||
          !url.hash.startsWith("#launch=")
        )
          throw new Error("Unexpected local console URL.");
        location.assign(url.href);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(
      "Your project is ready, but its console is still starting. Try opening it again.",
    );
  }

  async function create() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    let request = pending ?? {
      id: crypto.randomUUID(),
      name: name.trim().toLowerCase(),
      attempt: crypto.randomUUID(),
    };
    if (failed) request = { ...request, attempt: crypto.randomUUID() };
    try {
      // Save the public request identity before sending. A lost response or reload
      // resumes this same durable operation, never creates another project.
      localStorage.setItem(storage, JSON.stringify(request));
      setPending(request);
      setName(request.name);
      setFailed(false);
      setProgress("Creating your project and main database…");
      for (let i = 0; i < 180 && alive.current; i++) {
        const result = await project<Creation>(current, {
          action: "create",
          ...request,
        });
        if (!alive.current) return;
        const state = result.operation.state;
        if (state === "succeeded") {
          setProgress("Your database is ready. Opening your project…");
          // Keep the request until opening succeeds, so a lost launch reply can
          // be retried from the original tab without another initialization.
          await open(result.source);
          localStorage.removeItem(storage);
          setPending(null);
          return;
        }
        if (state === "failed" || state === "cancelled") {
          setFailed(true);
          throw new Error(
            result.operation.error ||
              "Project setup stopped. Retry to continue with the same project.",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error(
        "Setup is still running. Continue setup to check its progress.",
      );
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function switchTo(entry: Entry) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setProgress("Opening your project…");
    try {
      await open(entry.source);
    } catch (e) {
      setError(message(e));
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <>
      <button className="new-project-trigger" onClick={() => void show()}>
        + New project
      </button>
      <dialog
        ref={dialog}
        className="new-project-dialog"
        aria-labelledby={`${formId}-title`}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <div className="new-project-heading">
          <h2 id={`${formId}-title`}>Create a project</h2>
          <button
            type="button"
            aria-label="Close project dialog"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p>
          Give your project a name. We’ll create its PostgreSQL database and
          open the workspace.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label htmlFor={`${formId}-name`}>Project name</label>
          <input
            id={`${formId}-name`}
            autoFocus
            required
            maxLength={40}
            pattern={"[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,38}[a-zA-Z0-9])?"}
            placeholder="my-project"
            value={name}
            disabled={busy || !!pending}
            onChange={(e) => setName(e.target.value)}
            aria-describedby={`${formId}-hint`}
          />
          <p id={`${formId}-hint`} className="muted">
            Letters, numbers and hyphens, up to 40 characters. Project files are
            saved on this device.
          </p>
          {busy && (
            <p role="status" aria-live="polite">
              {progress}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <button
            className="button primary"
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy
              ? "Setting up…"
              : failed
                ? "Retry setup"
                : pending
                  ? "Continue setup"
                  : "Create and open"}
          </button>
        </form>
        {entries.length > 0 && (
          <section aria-label="Your projects">
            <h3>Your projects</h3>
            <ul>
              {entries.map((entry) => (
                <li key={entry.worktree}>
                  <span>{entry.name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void switchTo(entry)}
                    aria-label={`Open ${entry.name}`}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </dialog>
    </>
  );
}
