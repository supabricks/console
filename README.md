# Supabricks Console

The Apache-2.0 browser UI for Supabricks: PostgreSQL and Spark SQL workspaces, CSV/TSV/JSON/Parquet ingestion,
branch controls and JupyterLab notebooks connected to local Sail kernels.
This repository owns the React application, browser API client, locked frontend
dependencies, asset inventory, notices and product browser tests.

Extracted with Git history from `supabricks/platform` PR #33 at
`3d51a05c3d3df0ce67131e09ba8759720ea17252`. The notebook repairs and macOS
qualification fixture fixes are included. The legacy Kubernetes `platform/ui`
is a separate application.

## Build

Requires Git, Node 22 (minimum supported by the package: 20.19) and npm.

```bash
npm ci
npm run build
```

The result is `dist/`, including an API-versioned `console.json` inventory of
every asset and its SHA-256. Build needs no Rust, platform checkout, system
Python, database or CDN. Locked dependencies are downloaded at build time;
the installed application loads its assets locally.

`build/console-source.json` records the source commit, dirty state and lockfile
and asset-manifest hashes. Release assembly requires a clean build of the exact platform gitlink;
stale assets from a different checkout are rejected. Development builds may
record a dirty tree, but cannot be assembled into a pinned native release.

## Platform integration

`supabricks/platform` pins this repository as the `console/` Git submodule.
It builds that exact source revision and packages `dist/` under `share/console`.
The platform serves the UI and owns authentication, the HTTP/WebSocket bridge,
PostgreSQL/Sail/Jupyter processes, ingestion, notebook files and installation.

For local development, edit the console submodule in a platform worktree:

```bash
git submodule update --init console
npm ci --prefix console
npm run build --prefix console
cargo run -p supabricks-local -- console --project /absolute/project --no-open
```

Start/configure the runtime using platform's source-build instructions first.
Commit UI changes here; update the platform gitlink in a separate PR after
qualification. Both repositories retain lockfiles and their own CI.

The current host contract is same-origin `/api/`, an authenticated launch
fragment, and a host-generated `supabricks-style-nonce` meta element for notebook
styles. Opening `dist/index.html` as a file is not a functioning runtime.
Moving the source makes future reuse on `supabricks.io` possible; hosted-to-local
authentication and connection transport remain a later product phase.

## Qualification

Standalone CI typechecks and builds on Linux and macOS. Real product tests
accept an explicitly supplied Supabricks binary and create disposable local
projects/data roots:

```bash
npm exec -- playwright install chromium
node scripts/qualify.mjs --binary /absolute/installed/supabricks --report /tmp/console.json
node scripts/qualify-notebooks.mjs --binary /absolute/installed/supabricks --report /tmp/notebooks.json
```

The binary must serve this console build. For source qualification, scripts
also accept `--bundle`, `--helpers`, `--python` and `--worker` paths. All assets
and runtime processes must remain local; network-isolated, exact-archive
qualification stays in platform's native-release CI. Platform combines these
product tests with its separate notebook crash/recovery harness.

`fixtures/orders.csv` is the synthetic browser scenario fixture imported from
platform's `examples/console/orders.csv` at the extraction revision. It is test
input, not a runtime dependency on platform source. `licenses/` supplements
upstream package notices where their npm tarballs omit license text.

Notebook package controls are capability gated by
`notebook_environment_controls: 1`. They use the bound console workspace API and
never prepare an environment simply by opening a notebook. The panel distinguishes
selected-kernel packages from prepared versions and uses explicit environment
adoption. `scripts/qualify-environments.mjs --binary /path/to/supabricks --report
/path/to/report.json` exercises the packaged product, including real kernels,
PyPI resolution, offline preparation/import and an older capability response.
The corresponding platform plan and transport contract are in
`docs/architecture/ne05-console-environments.md` in `supabricks/platform`.

The C03 Analytics mode uses the platform's `analytical_workspace: 1` capability.
It publishes immutable snapshots, opens owned Sail readers and compares bounded
results across epochs. The real browser harness includes import-to-Spark,
refresh isolation, capacity, expiry, cancellation and reconnect qualification.
`--slice analytics` runs the C03 scenarios for local iteration; release CI always
runs the full harness without a slice filter.

Project packaging (`project_packaging: 1`) adds `.sbproj` preview, device upload,
verified unpack into a new project, explicit deployment creation/attachment,
CLI-equivalent plan/apply with lost-reply recovery, installed revision/source
comparison, deterministic download and installed asset drafts. Opening a package
or reopening its console starts no kernel. The native product harness includes
these scenarios; use `scripts/qualify-projects.mjs` with the same `--binary` and
source runtime options to run them alone. Platform's contract and bounds are in
`docs/architecture/pk06-console-projects.md`.
