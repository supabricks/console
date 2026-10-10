# Supabricks console prototype: screen and component inventory

Draft 2026-10-09. This is the build list for the clickthrough prototype. It is a
design target, not a statement of what the platform does today.

Each screen carries a backing tag, checked against platform `35fa945` and console
`23d3c34`:

- **Live** — the console already does this (usually as a bare form).
- **API** — the platform supports it; the console has no UI for it.
- **New** — no platform support yet. The prototype shows it with invented data,
  and it needs a backend contract before it can ship.

Prototype stack: React, shadcn/ui (Radix + Tailwind), TanStack Table, CodeMirror.
All data is synthetic; no request reaches a running installation.

## Navigation model

Three levels: installation, project, open resource.

```text
Installation
  Home (projects)                       Settings (runtime, catalog service, backup)
Project
  Overview
  DATABASE      Databases · Branches · Table editor · SQL editor · Object explorer
  SYNC          Pipelines · Create · Pipeline detail
  ANALYTICS     Spark SQL editor · Versions · Sessions
  NOTEBOOKS     Notebook editor · Environments
  CATALOG       Explorer · Table detail · Publications · Shared datasets
  OPERATE       Activity · Import · Settings
```

SQL has one editor with an engine switch (PostgreSQL or Spark). It is listed under
both Database and Analytics in the sidebar, opening with that engine preselected.

## 0. Shell and global

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| G-01 | App shell | Collapsible sidebar grouped as above; breadcrumb; project switcher; runtime status pill; theme toggle | Live (restructured) |
| G-02 | Command palette | Jump to a table, branch, query, notebook, pipeline or action (Ctrl/Cmd K) | New |
| G-03 | Context bar | Engine, database, branch, data version, environment for the open editor. The same component in SQL, Spark and notebooks | Live (scattered) |
| G-04 | Operation toasts and drawer | Running operation progress that survives navigation; opens Activity | Live (inline text) |
| G-05 | Home | Project cards, recent work, new project dialog, empty first-run state | Live |
| G-06 | Project overview | Database and branch count, pipeline health, active sessions and kernels, recent queries and notebooks, runtime health, "get started" checklist | Live (thin) |

## 1. Database (PostgreSQL)

### 1a. Database list and provisioning

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| DB-01 | Databases list | Each root database: name, Postgres version, state, branch count, size, last active | Live (as branch table) |
| DB-02 | Provision database dialog | Name, Postgres version, compute size, auto-suspend timeout, initial data (empty, import file, restore from backup) | Live: name only. New: size, auto-suspend, version choice |

### 1b. Database detail

One page with tabs.

| ID | Tab | Contents | Backing |
| --- | --- | --- | --- |
| DB-03 | Overview | State, default branch, compute size, storage used, connection count, sync pipelines reading from it, recent operations | Partly live |
| DB-04 | Connect | Branch and role pickers; copyable connection strings as tabs: psql, URI, JDBC, .env; driver snippets for Python (psycopg, SQLAlchemy), Node (pg, Prisma), Go, Java, Rust; pooled or direct toggle; show and hide password; reset password | Live: URI only. Formats and snippets are prototype-side rendering of the same credentials. New: reset password, pooling |
| DB-05 | API keys | Create, name, scope (project, database, read-only), expiry, last used, revoke; copy-once reveal | New (no key system exists; local access is the launch session, governed access is OIDC) |
| DB-06 | Compute | Current size; scale up or down with a review of what restarts; auto-suspend timeout; suspend and resume now; connection limits (256 total today) | Live: suspend and resume. New: sizing, auto-suspend setting |
| DB-07 | Observability | Time-range picker; charts for connections, transactions per second, query latency percentiles, CPU and memory, storage and WAL growth, cache hit ratio; slow queries table; active queries table with cancel; locks | New (no metrics endpoint; data would come from pg_stat views and the supervisor) |
| DB-08 | Roles | Postgres roles, privileges per schema, create role, rotate password | New as UI; achievable through SQL |
| DB-09 | Extensions | Available and installed extensions, enable and disable | New as UI; bundled set is limited (only `neon` is preloaded) |
| DB-10 | Backups and restore | Point-in-time restore by creating a branch at a time; stopped-cell backup bundles; retention window | API: branch at time, backup create and verify are CLI-only |
| DB-11 | Settings | Rename, default branch, delete database with typed confirmation | Partly live |

### 1c. Branches

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| BR-01 | Branch list and tree | Tree and table views: parent, state, created, expires, size delta from parent, default marker; filter | Live (flat table) |
| BR-02 | Create branch dialog | Parent; branch point as head, timestamp or log position; name; optional expiry; "also create a sync pipeline" shortcut | API: time, LSN and expiry are supported but have no UI |
| BR-03 | Branch detail | State, parent and children, branch point, connection strings, compute state, pipelines and analytical versions sourced from it, recent operations | Partly live |
| BR-04 | Branch actions | Suspend, resume, rename, set as default, set or clear expiry, delete (blocked by children and connections, with force) | Live: suspend, resume, delete. API: the rest |
| BR-05 | Schema diff | Compare two branches' schemas: added, removed and changed tables and columns | New |
| BR-06 | Reset from parent / promote | Replace a branch with its parent's current state; promote a branch to default | New: reset. API: set default |

### 1d. Table editor

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| TE-01 | Table list | Schemas and tables with row estimate and size; new table; import into new table | Live (explorer only) |
| TE-02 | Data grid | Paged rows; sort; column filters; inline cell edit, insert row, delete rows with a pending-changes bar and explicit commit; NULL and empty string shown distinctly; export CSV | New as UI (writes go through SQL; today's grid is read-only, 1,000 rows) |
| TE-03 | Create and alter table | Columns with type, default, nullable, primary key; foreign keys; generated SQL preview before applying | New as UI |
| TE-04 | Table detail tabs | Columns, indexes, constraints, triggers, policies, DDL, size and row stats, sync status ("in pipeline X, last synced …", unsupported column types flagged) | New as UI |
| TE-05 | Branch safety banner | Editing the default branch warns and offers "do this on a new branch" | New |

### 1e. SQL editor

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| SQ-01 | Editor | CodeMirror with highlighting, autocomplete from the schema, format, multiple tabs, run selection, keyboard run and cancel | Live as textarea, 8 tabs, one statement, 32 KiB |
| SQ-02 | Engine and target bar | PostgreSQL (database, branch) or Spark (version or latest, compute profile); read-only vs writes toggle for PostgreSQL | Live for PostgreSQL; engine switch is a page toggle today |
| SQ-03 | Results | Grid with types, copy cell, truncation notice, row and byte limits, elapsed time; tabs for results, messages, query plan (EXPLAIN visualised), chart | Live: grid. New: plan view, chart |
| SQ-04 | Saved queries | Folder tree, save, rename, delete with confirmation, export to project source | Live (flat list) |
| SQ-05 | Query history | Past runs with engine, target, status, duration; reopen | New (query IDs exist; no history listing) |
| SQ-06 | Stale-target and unknown-outcome states | Branch changed or deleted; runtime restarted during a write | Live |

### 1f. Object explorer

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| OE-01 | Explorer tree | Databases, branches, schemas, then tables, views, materialized views, functions, sequences, types, indexes, extensions; search; context menu (preview, open in table editor, copy name, generate SELECT or DDL) | Live: tables and columns only |
| OE-02 | Object detail panel | Definition, dependencies, owner, privileges for the selected object | New as UI |

The explorer docks beside the SQL editor and table editor, and is also a full page.

## 2. Sync (PostgreSQL to Delta)

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| SY-01 | Pipelines list | Each pipeline: source branch, mode, state, freshness, last run, tables; filter by state | Live as one panel, one policy per branch |
| SY-02 | Create pipeline wizard | 1 Source branch and prerequisite check. 2 Tables, with per-column type compatibility (unsupported types block publication). 3 Mode cards comparing snapshot, triggered and continuous on freshness, cost and compute behaviour. 4 Settings: schedule for snapshot and triggered; freshness target and batch interval for continuous; storage profile; byte and time budgets. 5 Resource acknowledgement and review | Live: mode, interval, freshness, batch interval, acknowledgement. API: storage profile, budgets. New: table selection (sync is whole-branch today) |
| SY-03 | Pipeline detail: overview | Flow diagram from source branch through capture and apply to the published version; state; freshness gauge; lag chart; source, captured and published positions; backlog, spool and retained log against their budgets; "capture keeps compute awake" notice | Live as a text list. New: charts over time |
| SY-04 | Pipeline detail: runs | Run history with trigger, state, duration, rows, published version; run detail; cancel | Live (last 20) |
| SY-05 | Pipeline detail: tables | Per-table row counts, last change, schema mapping from Postgres types to Delta types | New |
| SY-06 | Pipeline detail: settings | Edit mode and schedule; change mode (pause, change, resume); delete | Live |
| SY-07 | Lifecycle actions | Run now, pause, resume, cancel run, reviewed full resync, delete with consequences stated | Live |
| SY-08 | Failure and recovery states | Blocked on schema change, history lost, pressure at 80% of budget, source asleep, unknown outcome with exact retry | Live as raw strings |
| SY-09 | Reverse sync placeholder | "Analytics to PostgreSQL" shown as coming, not clickable | Not built |

Limits to surface honestly: one capture per installation, 512 MiB default spool
and log budgets, schedule 60 s to 30 days, freshness 1–300 s.

## 3. Analytics (Spark-compatible engine)

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| AN-01 | Spark SQL editor | Same editor as SQ-01 with the Spark engine: catalog tree of analytical tables, version selector, read-only badge, results, keep-result-for-comparison across versions | Live |
| AN-02 | Versions | Timeline of published analytical versions per branch: time, source position, how produced (manual, scheduled, continuous), tables, size; pin, open a session on it, garbage-collect with keep count | Live: latest only. API: history, pin, collect |
| AN-03 | Sessions | Active sessions with owner (SQL tab, notebook, CLI), version, compute profile, expiry; close and cancel; capacity meter (two slots today) | Live. API: compact or analytical profile |
| AN-04 | Version detail | Tables and schemas in the version, provenance back to the Postgres branch and position, readers holding it | API |
| AN-05 | Query history | Spark queries with version and duration | New |

## 4. Notebooks and Python runtime

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| NB-01 | Notebook browser | Folder tree of notebooks, new, rename, duplicate, download, delete | Live (flat list) |
| NB-02 | Notebook editor | Cells with run, add, delete, move, change type; outputs (text, tables, images); save state; include-outputs option; outline | Live (embedded Jupyter) |
| NB-03 | Kernel bar | State (stopped, starting, ready, busy, interrupting, failed, lost, expired); start, stop, restart, interrupt, reconnect; attached branch, data version and environment; "newer version available" prompt | Live |
| NB-04 | Data panel | Tables available to the kernel with a snippet to load each as a DataFrame | Partly live |
| NB-05 | Variables and resources | Variable inspector; memory and CPU of the kernel | New |
| NB-06 | Environments list | Environments with Python version, state, package count, which kernels use each | Live (one per project) |
| NB-07 | Environment detail | Declared packages, add and remove, lock, prepare (online or offline), installed versions, diff of declared vs prepared vs running, adopt into a running kernel, import and export offline bundle, operation history | Live |

## 5. Catalog (Unity Catalog)

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| UC-01 | Catalog explorer | Three-level tree of catalog, schema, table; search; filter by owner and kind (live PostgreSQL, analytical, shared) | Live as one flat page |
| UC-02 | Table detail | Overview, columns, sample data, freshness, history of versions, lineage (import to table to version to publication), permissions, "open in SQL" and "open in notebook" | Live: columns, provenance lines. New: sample, lineage graph |
| UC-03 | Publish wizard | Choose a version, review the complete table set, target namespace, confirm | Live |
| UC-04 | Publications | Owned publications with state, revision, readers and retention holders; withdraw; resume | Live |
| UC-05 | Shared datasets | Discover publications from other projects, bind, review update or removal, apply plan | Live |
| UC-06 | Catalog service | Health, local or external metastore, restart, rotate key | API (CLI-only) |
| UC-07 | Permissions | Grants on catalog objects by principal | Governed profile only |

## 6. Operate

| ID | Screen / component | Contents | Backing |
| --- | --- | --- | --- |
| OP-01 | Import wizard | Steps: file (CSV, TSV, JSON, JSONL, Parquet; 100 MiB), parse options, columns and types, destination branch and table, progress and result with "open table" and "sync to analytics" | Live as one panel |
| OP-02 | Activity | All operations across imports, branch changes, sync runs, queries, environment preparation: filter, detail with stages and error, cancel, retry | Live per feature; no combined view |
| OP-03 | Project settings | Name, project directory, deployment, packages (export, inspect, apply) | Live |
| OP-04 | Installation settings | Runtime and service health, versions, data directory, resource limits, backup, upgrade | API (CLI-only) |
| OP-05 | Agents and MCP | Connection snippet for coding agents, tool list | API (CLI-only) |

## Access control (governed server profile)

Identity belongs to the installation and sits beside the projects list; roles and
grants belong to a project and sit in its Access section.

| ID | Screen | Contents | Backend |
|---|---|---|---|
| AC-01 | Sign in (`/signin`) | Single sign-on through the identity provider | Ready |
| AC-02 | Administration: People | List, search, groups, status, disable; detail with identity, groups and effective access | Server CLI only; email, last sign-in and invitations are new |
| AC-03 | Administration: Groups | Create, members, what the group grants, delete | Server CLI only; delete and provider sync are new |
| AC-04 | Administration: Service accounts | Create, issue a token (up to 1 hour, copy once), revoke, disable | Server CLI only; long-lived keys are new |
| AC-05 | Administration: Sign-in | Identity provider settings, signed-in sessions, sign everyone out | Server CLI only; session listing is new |
| AC-06 | Access: Roles | Viewer, editor, administrator for a person or group; check someone's access | Ready; custom roles and access explanation are new |
| AC-07 | Access: Data permissions | Nine capabilities per branch, per person or group | Server CLI only; direct PostgreSQL connections are new |
| AC-08 | Access: Run permissions | Run notebooks, stop anyone's run, run as another identity for one saved revision | Server CLI only |
| AC-09 | Access: Catalog grants | Table grants on a publication, reviewed as a plan then applied | Server CLI only; row filters and column masks are new |
| AC-10 | Audit log (installation) and Access log (project) | Ordered entries with actor, on-behalf-of, action, target, outcome; export | Server CLI only; time, search and filters are new |

## Reusable components

Built once, used across sections.

| Component | Used by |
| --- | --- |
| Data grid (virtualised, typed cells, NULL handling, copy, sort, filter) | Table editor, SQL results, sample data, lists |
| Code editor (CodeMirror: SQL, Python) | SQL editor, notebooks, snippets |
| Connection snippet block (language tabs, copy, masked secrets) | Connect tab, branch detail, MCP |
| Object tree (lazy, searchable, context menu) | Object explorer, catalog, notebook data panel |
| Context bar and engine switch | SQL, Spark, notebooks |
| Freshness indicator (live, version age, lag, unknown) | Sync, versions, catalog, context bar |
| Time-series chart and stat tile | Observability, pipeline detail, overview |
| Flow diagram (source to capture to apply to version) | Pipeline detail, lineage |
| Wizard frame (steps, review, confirm) | Provision, create pipeline, import, publish |
| Review-and-confirm dialog, typed-name destructive confirm | Scale, resync, delete, withdraw |
| Status badge set | Every list |
| Operation progress (stages, cancel, unknown outcome) | Activity, toasts, wizards |
| Empty, loading, error and unavailable states | Every screen |

## Build order

1. Shell, theme, reusable components, synthetic data layer.
2. Database: list, provisioning, detail tabs (Connect, Compute, Observability first).
3. Branches, object explorer, table editor.
4. SQL editor with both engines.
5. Sync: list, create wizard, pipeline detail.
6. Analytics versions and sessions.
7. Notebooks and environments.
8. Catalog.
9. Import, activity, settings.

Roughly 70 screens and tabs. About a third are new backend work; the prototype
will mark those with a small "preview" tag so reviewers can tell what exists.

## Backups (database tab)

| ID | Screen | Contents | Backend |
|---|---|---|---|
| DB-10a | Restore to a new branch | Timeline over the history window, pick any minute | Platform supports it; no console UI |
| DB-10d | Restore in place, restore history | Replace the default branch, previous state kept as a branch, typed confirmation | New (#296) |
| DB-10e | Online backups | Back up now, list with verification, schedule, retention, destination | New (#296) |
| DB-10g | Timeline events | Schema changes and large writes marked on the timeline | New (#296) |
| DB-10c | History retention | How far back restore reaches | New (#254) |

## Jobs

| ID | Screen | Contents | Backend |
|---|---|---|---|
| JB-01 | Jobs list, New job, job Settings | Notebook or saved query, pinned or latest revision, limits and retries | New (#297) |
| JB-02 | Triggers | Schedule (interval, hourly, daily, weekdays, cron), after a sync publishes, by hand | New (#297) |
| JB-03 | Job detail, Runs | Run history, duration chart, run detail with steps, output, log, data version read | New (#297) |
| JB-04 | Run controls | Run now, pause, resume, stop, run again | New (#297) |
| JB-05 | Parameters | Named values with run-time placeholders | New (#297) |
| JB-06 | Identity | Runs as a service account, with an access check linking to Access | New (#297) |
| JB-07 | Failure notifications | People and groups told on failure and recovery | New (#298) |

## Alerts

| ID | Screen | Contents | Backend |
|---|---|---|---|
| AL-01 | Alerts, bell in the top bar | Open and resolved alerts, detail with what happened and where it was sent | New (#298) |
| AL-02 | Rules | Twelve built-in conditions by area: on or off, threshold, severity, recipients | New (#298) |
| AL-03 | Acknowledge, mute | Stop reminders without closing the alert | New (#298) |
| AL-04 | Destinations | Webhook, email, in-console group; test send; delivery log; payload sample | New (#298) |
| AL-05 | Rules over time | Lag, connection and session-slot rules | New (#298, #247, #267) |

## Secrets (under Access)

| ID | Screen | Contents | Backend |
|---|---|---|---|
| SC-01 | Secrets list, New secret, Replace value | Write-only values, description, age, delete | New (#299) |
| SC-02 | Reading a secret | Runtime read by name, redaction | New (#299) |
| SC-03 | Secret detail | Who may use or manage it, where it is used, recent reads | New (#299) |
| SC-04 | Required but missing | Names the project declares and has no value for | New (#299) |
