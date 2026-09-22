# Supabricks Console

The Apache-2.0 browser UI for Supabricks: PostgreSQL and analytical workspaces,
file ingestion, branch controls, catalog datasets, portable projects, notebooks
and governed access.
This repository owns the React application, browser API client, locked frontend
dependencies, asset inventory, notices and product browser tests.

## Product documentation

Start with the [console product documentation](docs/README.md):

- [Current state and direction](docs/current-state.md): implemented surfaces, product vocabulary and the Databricks reference.
- [Jobs to be done](docs/jobs-to-be-done.md): users, desired outcomes, priorities and success measures.
- [User flows](docs/user-flows.md): connected journeys, decisions, permission boundaries and recovery behavior.
- [Page structure](docs/page-structure.md): navigation, proposed routes and screen responsibilities.
- [Interactive wireframes](docs/wireframes/README.md): a standalone, clickable 17-screen structure study with synthetic data.
- [Design system](docs/design-system.md) and [visual reference](docs/design-system/README.md): cool colors, typography, controls, tables, themes and density.
- [Component architecture](docs/component-architecture.md): reusable React/TypeScript contracts and the path from shared tokens to product components.

These documents define the next product experience; proposed interactions are
distinguished from existing functionality. The
[platform documentation home](https://github.com/supabricks/platform/blob/main/docs/README.md)
owns stack architecture, implementation plans and release evidence.

## Source history

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

The local host contract is same-origin `/api/`, an authenticated launch fragment,
and a host-generated `supabricks-style-nonce` meta element for notebook styles.
The governed console uses its separate authenticated API and server-managed
OIDC session; it must not fall back to local-owner authorization. See the
[governed server guide](https://github.com/supabricks/platform/blob/main/docs/handbook/governed-server.md).
Opening `dist/index.html` as a file is not a functioning runtime.
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

Project creation is a browser operation when the platform advertises
`project_creation: 1`: **New project → Create and open** provisions the project
and its `main` database through the durable platform apply journal. The console
home only launches projects; databases, saved queries, notebooks, imports and
Spark execution belong to the selected project. The browser retains only a public
creation request ID for interrupted-setup recovery. It never chooses a host path
or supplies a runtime project ID to asset requests.

`scripts/project-create.mjs` exercises the real browser/runtime creation flow,
reload and lost-response recovery, project switching and asset isolation. It is
also part of the installed console qualification suite.

The UC06 **Data** browser uses the platform's publication, dataset and reviewed
project-apply contracts. It separates live PostgreSQL from snapshots, discovers
publications only for explicit binding, and hands selected inputs to Spark SQL or
a saved notebook. It requires the `catalog_workspace: 1` runtime capability.

`node scripts/qualify-catalog.mjs --binary /absolute/installed/bin/supabricks
--root /absolute/isolated/test-root --report /absolute/report.json` runs the real
browser workflow against an installed fixture with the managed catalog available.
The platform's `e2e/native/catalog/console.py` assembles that fixture from pinned
engines, UC, the current binary and these built assets. Existing browser suites
remain required alongside this additional workflow.


The UC09.7 governed console is selected by the platform's explicit
`console --governed --provider NAME --redirect LOOPBACK_CALLBACK` launcher.
It uses OIDC sign-in and HttpOnly sessions with project-filtered Data, SQL,
notebook and package workflows, reviewed catalog sharing, source-bound service
use, revocation and audit. Project roles, data grants and execution grants remain
separate. Session loss clears signed-in state; the existing local-owner console
keeps its current launcher and reconnect behavior.

This preview supports bounded `.sbdata` and notebook imports. It does not enable
shared ingress, foreign `.sbproj` activation, host kernels or environment hooks.
The platform contract and source qualification results are in
`docs/architecture/uc097-governed-console.md` in `supabricks/platform`.

`scripts/governed-qualify.mjs --config /private/browser.json` runs the independent
Alice/Bob browser scenarios. Use platform's
`e2e/native/governed-console/qualify.py` to provision its disposable pinned IdP,
native database, managed UC and isolated runtime fixture; the config contains
fixture credentials and must stay private. The test verifies a real Spark result,
source-specific service use, live notebook revocation and correlated audit.
