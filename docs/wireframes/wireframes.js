"use strict";

// Documentation prototype: no fetch, uploads, storage or runtime integration.
const screens = {
  entry: { id: "WF-01", title: "Enter your workspace", nav: "", flows: "UF-01", note: "One recognizable entry; retain separate local launch and governed OIDC contracts." },
  home: { id: "WF-02", title: "Your work, in one place.", nav: "home", flows: "UF-01 · UF-02", note: "Accessible projects and authorized recents. Durable recents and restoration require a contract." },
  project: { id: "WF-03", title: "Sales analytics", nav: "project", flows: "UF-02 · UF-13", note: "Project orientation, readiness and useful next actions rather than an infrastructure dashboard." },
  workspace: { id: "WF-04", title: "Workspace", nav: "workspace", flows: "UF-01 · UF-05 · UF-08 · UF-14", note: "One project asset browser for saved source. Persistent tabs and asset routes are proposed." },
  data: { id: "WF-05", title: "Find the right data.", nav: "data", flows: "UF-03 · UF-04", note: "Explicit browse scope. Metadata discovery is distinct from data access or binding." },
  table: { id: "WF-06", title: "public.orders", nav: "data", flows: "UF-04 · UF-05 · UF-08 · UF-10", note: "Schema, bounded sample and provenance before an authorized editor handoff." },
  sql: { id: "WF-07", title: "Revenue by region", nav: "sql", flows: "UF-05", note: "Source, execution and result state are separate. A changed engine never silently converts SQL." },
  notebook: { id: "WF-08", title: "Revenue exploration", nav: "notebook", flows: "UF-08 · UF-09 · UF-14", note: "Opening is not executing. Saved outputs, kernel memory, environment and input versions are distinct." },
  import: { id: "WF-09", title: "Bring your data in.", nav: "data", flows: "UF-03", note: "Interpret → review → commit → follow. The demo uses a built-in sample; it does not read files." },
  branches: { id: "WF-10", title: "Database branches", nav: "branches", flows: "UF-06", note: "Data experiments, not Git branches. No implicit merge or editor retargeting." },
  snapshots: { id: "WF-11", title: "Analytical snapshots", nav: "snapshots", flows: "UF-07", note: "Keep live source, latest published data and active session inputs visibly distinct." },
  environment: { id: "WF-12", title: "Project environment", nav: "environment", flows: "UF-09", note: "Declared, prepared and active versions are separate. Adoption is a deliberate restart." },
  publication: { id: "WF-13", title: "Publish & reuse data", nav: "data", flows: "UF-10", note: "Review complete snapshot sets; binding does not transfer ownership or grant access." },
  packages: { id: "WF-14", title: "Portable projects", nav: "packages", flows: "UF-11 · UF-14", note: "Separate source, offline dependencies and logical data; review destination changes before apply." },
  activity: { id: "WF-15", title: "Activity", nav: "activity", flows: "UF-13", note: "An operation view, not a scheduler. Aggregate history and retention require API design." },
  access: { id: "WF-16", title: "Project access", nav: "access", flows: "UF-12", note: "Server-enforced authority. Separate project, data, execution and service-use permissions." },
  admin: { id: "WF-17", title: "Administration", nav: "admin", flows: "UF-12 · UF-13", note: "Operator-scoped identity, catalog policy, audit and health. No automatic role escalation." },
};
const journeys = {
  first: ["home", "project", "import", "table", "sql", "snapshots", "notebook"],
  shared: ["data", "table", "publication", "notebook", "activity"],
  governance: ["entry", "access", "admin", "activity"],
  portable: ["workspace", "packages", "environment", "notebook"],
};
let page = "home", profile = "local", state = "ready", journey = "free";
let notes = false, dialogTrigger = null, notificationTimer;
const mock = {
  project: "Sales analytics", branch: "main", engine: "PostgreSQL", dataScope: "live",
  detailTab: "schema", importStep: 0, publicationMode: "publish", packageMode: "export",
  query: "SELECT region, SUM(amount) AS revenue\nFROM public.orders\nGROUP BY region\nORDER BY revenue DESC;",
  queryDirty: false, sqlRan: false, kernel: false, notebookRan: false, notebookDirty: false, notebookSnapshot: "09:30",
  code: "revenue = spark.sql(\"SELECT region, sum(amount) AS revenue FROM public.orders GROUP BY region\")\nrevenue.show()",
  refreshed: false, prepared: false, adopted: false, adminTab: "audit", grant: false,
  cancelled: false, newBranch: "", publicationDone: false, packageDone: false,
};
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const url = (id) => `#${id}?profile=${profile}&state=ready`;
const link = (id, label, cls = "") => `<a href="${url(id)}" class="${cls}">${label}</a>`;
const button = (label, action, cls = "", attrs = "") => `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const badge = (label, dark = false) => `<span class="badge${dark ? " dark" : ""}">${label}</span>`;
const panel = (title, body, extra = "") => `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div>${body}</section>`;
const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const detail = (entries) => `<dl class="detail-list">${entries.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("")}</dl>`;
const notice = (text) => `<div class="notice">${text}</div>`;
const head = (description, actions = "") => `<div class="page-head"><div><div class="eyebrow">${screens[page].id} / ${page === "home" || page === "entry" ? "Your installation" : esc(mock.project)}</div><h1>${page === "project" ? esc(mock.project) : screens[page].title}</h1><p>${description}</p></div><div class="actions">${actions}</div></div>`;
const assetTabs = (active) => `<div class="asset-tabs">${link("sql", "▤ Revenue by region.sql", active === "sql" ? "active" : "")}${link("notebook", "▧ Revenue exploration.ipynb", active === "notebook" ? "active" : "")}</div>`;
const rows = [["1001", "North", "$12,400.00", "2026-09-21"], ["1002", "South", "$8,200.00", "2026-09-21"], ["1003", "West", "$10,600.00", "2026-09-22"]];
const actor = () => profile === "governed" ? "Alex Morgan · own identity" : "Local OS owner";
const inputStrip = () => `<div class="context-strip"><span>Project <strong>${esc(mock.project)}</strong></span><span>Branch <strong>${esc(mock.branch)}</strong></span><span>Input <strong>${"Snapshot " + mock.notebookSnapshot}</strong></span><span>Run as <strong>${actor()}</strong></span></div>`;
const assetTree = () => `<aside class="asset-tree" aria-label="Project assets"><div class="eyebrow">Project files</div>${link("workspace", "⌄ Queries")}${link("sql", "Revenue by region", "indent")}${link("workspace", "⌄ Notebooks")}${link("notebook", "Revenue exploration", "indent")}<hr class="rule"><div class="eyebrow">Data / public</div>${link("table", "▤ orders")}${link("table", "▤ customers")}${link("data", "Browse all data →")}</aside>`;

const views = {
  entry() {
    return `<div class="sign-in panel pad"><div class="eyebrow">${profile === "governed" ? "Company analytics · governed server" : "On this device · local owner"}</div><h1>A place for your<br>next question.</h1><p class="description">${profile === "governed" ? "Sign in to find your projects and work with the data you can access." : "Open the console using a fresh local launch link. Your projects and data stay on this device."}</p><hr class="rule">${detail([["Instance", "Supabricks · Example installation"], ["Connection", profile === "governed" ? "TLS · company identity provider" : "Loopback · local runtime"]])}${button(profile === "governed" ? "Continue with company sign-in" : "Simulate a valid local launch", "sign-in", "primary")}<p class="description">This is a simulated entry. No credentials are requested.</p>${link("home", "Explore the wireframes →")}</div>`;
  },
  home() {
    return head("Open a project, pick up an analysis or start with a new question.", button("+ New project", "new-project", "primary")) +
      `<div class="grid"><section class="panel pad"><div class="card-title">${link("project", esc(mock.project))}${badge("READY")}</div><p class="description">Orders, revenue and customer exploration.</p><div class="card-number">3 <small style="font-size:12px;letter-spacing:0">saved assets</small></div>${link("workspace", "Open workspace →")}</section><section class="panel pad"><div class="card-title">Customer research ${badge("READY")}</div><p class="description">A second project's context stays independent.</p><div class="card-number">2 <small style="font-size:12px;letter-spacing:0">saved assets</small></div>${button("Preview this project →", "other-project")}</section><section class="panel pad"><div class="eyebrow">Getting started</div><h2 style="margin-top:12px">From a file to an answer</h2><p class="description">Import a sample, query a table and continue in a notebook.</p><div style="margin-top:18px">${button("Follow the first-result journey", "start-journey")}</div></section></div>` +
      `<div class="section-gap">${panel("Pick up where you left off", table(["Asset", "Project", "Last saved", "Type"], [[link("notebook", "Revenue exploration"), esc(mock.project), "Today, 09:42", "Notebook"], [link("sql", "Revenue by region"), esc(mock.project), "Today, 09:38", "SQL query"], [link("workspace", "Customer questions"), "Customer research", "Yesterday", "Project assets"]]), badge("AUTHORIZED RECENTS · PROPOSED"))}</div>`;
  },
  project() {
    return head("A shared context for your data, queries and notebooks.", link("workspace", "Open workspace →", "primary-link")) +
      `<div class="grid"><section class="panel pad"><div class="eyebrow">Database</div><div class="card-number">${esc(mock.branch)}</div>${badge("READY")}<p class="description">PostgreSQL 17.8 · live data</p></section><section class="panel pad"><div class="eyebrow">Analytical input</div><div class="card-number">09:30</div><p class="description">Latest available snapshot · today</p>${link("snapshots", "Review freshness →")}</section><section class="panel pad"><div class="eyebrow">Working context</div><div class="card-number">3</div><p class="description">Saved queries and notebooks</p>${link("workspace", "Browse assets →")}</section></div>` +
      `<div class="split section-gap">${panel("Continue working", `<div class="panel-body"><div class="row"><div><strong>Explore your data</strong><small>Inspect schemas and bounded samples.</small></div>${link("data", "Browse →")}</div><div class="row"><div><strong>Bring in a file</strong><small>Review schema before importing a new table.</small></div>${link("import", "Import →")}</div><div class="row"><div><strong>Ask a question</strong><small>Start from saved SQL or a notebook.</small></div>${link("sql", "Open SQL →")}</div></div>`)}<section class="panel pad"><h2>Project details</h2><hr class="rule">${detail([["Owner", profile === "local" ? "Local owner" : "Analytics team"], ["Profile", profile === "local" ? "On this device" : "Governed server"], ["Services", "Available"], ["Source", "Editable project"]])}<hr class="rule">${link("activity", "View recent activity →")}</section></div>`;
  },
  workspace() {
    return head("Saved source for this project. Opening an asset does not execute it.", button("+ New asset", "new-asset", "primary")) +
      `<div class="toolbar"><label>Filter assets<input id="asset-filter" placeholder="Filter by name…" type="search"></label><span class="push">${badge("3 SAVED ASSETS")}</span></div><div class="editor-layout">${assetTree()}<section class="editor-main">${table(["Name", "Type", "Saved", "Owner"], [[link("sql", "Revenue by region.sql"), "SQL query", "Today, 09:38", "You"], [link("notebook", "Revenue exploration.ipynb"), "Notebook", "Today, 09:42", "You"], [link("environment", "Environment declaration"), "Dependencies", "Yesterday", "Project"]])}<div class="panel-body"><p class="description">Select an asset to open its editor. Changes are saved separately from running queries or cells.</p></div></section></div>`;
  },
  data() {
    const published = mock.dataScope !== "live";
    return head("Inspect sources and freshness before choosing what to query.", link("import", "+ Import file", "primary-link")) +
      `<div class="tabs" role="tablist" aria-label="Data scope">${[["live", "Live tables"], ["published", "Published snapshots"], ["catalog", "Catalog datasets"]].map(([k, v]) => button(v, `scope:${k}`, "", `role="tab" aria-selected="${mock.dataScope === k}"`)).join("")}</div><div class="toolbar"><label>Filter this scope<input id="data-filter" type="search" placeholder="Table or dataset name…"></label><span class="push">${badge(published ? "FIXED PUBLICATION REVISIONS" : "POSTGRESQL · MAIN")}</span></div>` +
      panel(published ? "Available publications" : "Tables in this branch", table(["Name", "Source", "Version", "Status", ""], [[link("table", published ? "sales.analytics.orders" : "public.orders"), esc(mock.project), published ? "Today, 09:30" : "Live", badge("AVAILABLE"), link("table", "Inspect →")], [link("table", published ? "sales.analytics.customers" : "public.customers"), esc(mock.project), published ? "Today, 09:30" : "Live", badge("AVAILABLE"), link("table", "Inspect →")]])) +
      `<p class="description">${published ? "Discovery does not bind a dataset or grant access. Review the selected revision before consuming it." : "Live PostgreSQL changes become analytical data only after an explicit snapshot refresh."}</p>`;
  },
  table() {
    const pub = mock.dataScope !== "live";
    const body = mock.detailTab === "schema" ? table(["Column", "Type", "Nullable", "Description"], [["id", "bigint", "No", "Order identifier"], ["region", "text", "No", "Sales region"], ["amount", "numeric(12,2)", "No", "Order value"], ["ordered_at", "date", "No", "Order date"]]) : mock.detailTab === "sample" ? table(["id", "region", "amount", "ordered_at"], rows) : `<div class="panel-body">${detail([["Owning project", esc(mock.project)], ["Source branch", "main"], ["Publication", pub ? "Today, 09:30 · revision 7" : "Not applicable to live data"], ["Data class", pub ? "Read-only snapshot" : "Live PostgreSQL"], ["Exact identity", "Available in implementation details"]])}</div>`;
    return head("Order data used for regional revenue analysis.", link("sql", "Open in SQL", "primary-link") + link("notebook", "Open in notebook", "button-link")) +
      `<div class="context-strip">${badge(pub ? "PUBLISHED SNAPSHOT" : "LIVE POSTGRESQL", true)}<span>Source <strong>${esc(mock.project)} / main</strong></span><span>${pub ? "Published today, 09:30" : "Values reflect this branch at query time"}</span></div><div class="split"><div><div class="tabs" role="tablist" aria-label="Dataset details">${[["schema", "Schema"], ["sample", "Sample data"], ["provenance", "Source & freshness"]].map(([k, v]) => button(v, `detail:${k}`, "", `role="tab" aria-selected="${mock.detailTab === k}"`)).join("")}</div><section class="panel">${body}</section><p class="description">${mock.detailTab === "sample" ? "Fictional bounded sample · 3 rows shown. A preview is not a completeness guarantee." : "Use a table or publication's identity, not its name alone, when opening related work."}</p></div><section class="panel pad"><h2>Use this data</h2><hr class="rule">${detail([["Owner", "Analytics team"], ["Access", profile === "local" ? "Local owner" : "Granted for this example"], ["Input", pub ? "Revision 7" : "main / live"]])}<hr class="rule">${link("publication", pub ? "Review project binding →" : "Publish a snapshot →")}<p class="description">${pub ? "A consuming project gets an explicit binding, not ownership." : "Publishing is separate from refreshing analytical data."}</p></section></div>`;
  },
  sql() {
    const analytical = mock.engine === "Spark SQL";
    return head(`${mock.queryDirty ? "Unsaved changes" : "Saved query"} · source and results have separate lifecycles.`, button("Save", "save-sql") + button("Run query", "run-sql", "primary")) +
      `<div class="context-strip"><label>Engine<select id="engine"><option${!analytical ? " selected" : ""}>PostgreSQL</option><option${analytical ? " selected" : ""}>Spark SQL</option></select></label><span>Branch <strong>${esc(mock.branch)}</strong></span><span>Input <strong>${analytical ? "Snapshot today, 09:30" : "Live data"}</strong></span><span>${badge("READ ONLY")}</span><span>Run as <strong>${actor()}</strong></span></div>` +
      `<div class="editor-layout">${assetTree()}<section class="editor-main">${assetTabs("sql")}<div class="code-area"><div class="line-numbers" aria-hidden="true">1\n2\n3\n4</div><textarea id="sql-source" aria-label="SQL source" spellcheck="false">${esc(mock.query)}</textarea></div><div class="result-toolbar"><strong>Results</strong><span>${mock.sqlRan ? "Sample run complete · 3 rows · 42 ms" : "No query run in this prototype session"}</span></div>${mock.sqlRan ? table(["region", "revenue"], [["North", "12,400.00"], ["West", "10,600.00"], ["South", "8,200.00"]]) : `<div class="placeholder">Run the query to preview the result layout.<br>No SQL is executed.</div>`}<div class="panel-body"><p class="description">${mock.sqlRan ? "Synthetic result · Changing the SQL does not change this sample. Production results show input provenance, nulls and truncation." : "A failed query retains its source. Switching engines clears displayed sample results."}</p></div></section></div>`;
  },
  notebook() {
    return head(`${mock.notebookDirty ? "Unsaved changes" : "Saved notebook"} · Revenue exploration.ipynb`, button("Save", "save-notebook") + button(mock.kernel ? "Stop kernel" : "Start kernel", "toggle-kernel") + button("Run cell", "run-cell", "primary", mock.kernel ? "" : "disabled")) + inputStrip() +
      `<div class="toolbar">${badge(mock.kernel ? "KERNEL READY" : "KERNEL STOPPED", true)}<span class="muted" style="font-size:12px">Environment: ${mock.adopted ? "Prepared revision 4" : "Project base · revision 3"}</span><span class="push">${link("environment", "Manage environment")}</span></div><section class="panel" style="margin-bottom:18px">${assetTabs("notebook")}<div class="panel-body"><h2>Where is revenue growing?</h2><p class="description">Explore the selected analytical snapshot, then save the explanation with the code.</p></div></section><div class="split"><div><section class="notebook-cell"><div class="cell-label"><span>Python · cell 1</span><span>${mock.notebookRan ? "Sample executed" : "Not run"}</span></div><div class="code-area"><div class="line-numbers" aria-hidden="true">1\n2</div><textarea id="notebook-source" aria-label="Notebook cell source" spellcheck="false">${esc(mock.code)}</textarea></div>${mock.notebookRan ? `<div class="cell-output">Synthetic output<br><br>North &nbsp; 12400.00<br>South &nbsp;&nbsp; 8200.00<br>West &nbsp;&nbsp; 10600.00</div>` : `<div class="cell-output muted">No output from this prototype session.</div>`}</section><div class="placeholder" style="min-height:72px">Additional code and narrative cells</div></div><section class="panel pad"><h2>Execution context</h2><hr class="rule">${detail([["Data", "Snapshot " + mock.notebookSnapshot], ["Environment", mock.adopted ? "Revision 4" : "Revision 3"], ["Identity", actor()], ["Source", mock.notebookDirty ? "Unsaved edits" : "Saved notebook"]])}<hr class="rule">${link("snapshots", "Review newer inputs →")}<p class="description">Opening a notebook never runs it. Old outputs do not prove the current source was executed.</p></section></div>`;
  },
  import() {
    const steps = ["Choose file", "Interpret", "Review", "Complete"];
    let content;
    if (mock.importStep === 0) content = `<div class="placeholder" style="min-height:215px"><div><h2>Bring a supported file</h2><p style="margin:10px 0 20px">CSV / TSV · JSON / JSONL · Parquet</p>${button("Use sample orders.csv", "import-next", "primary")}<p class="description">Prototype sample only · no file picker or upload</p></div></div>`;
    else if (mock.importStep === 1) content = panel("Interpret sample orders.csv", table(["Source column", "Destination", "Type", "Sample"], [["order_id", "id", "bigint", "1001"], ["region", "region", "text", "North"], ["amount", "amount", "numeric(12,2)", "12400.00"], ["ordered_at", "ordered_at", "date", "2026-09-21"]])) + `<p class="description">Mappings are illustrative. The production screen will expose supported parser/type corrections and row-level diagnostics.</p>`;
    else if (mock.importStep === 2) content = `<div class="split"><section class="panel pad"><h2>Review destination</h2><hr class="rule"><div class="form-grid"><label>New table name<input value="orders" aria-label="Destination table name" readonly></label><label>Schema<input value="public" readonly></label></div><hr class="rule">${detail([["Project", esc(mock.project)], ["Branch", esc(mock.branch)], ["Mode", "Create a new table"], ["Input", "orders.csv · synthetic sample"], ["Schema", "4 reviewed columns"]])}</section><section class="panel pad"><h2>Before importing</h2><p class="description">This creates a new table. It will not replace an existing table or automatically refresh analytical data.</p><hr class="rule">${badge("REVIEWED SAMPLE")}</section></div>`;
    else content = `<div class="empty-state"><div class="symbol">✓</div><h2>Sample import complete</h2><p>public.orders · 3 example rows<br>This simulated outcome did not create a database table.</p>${link("table", "Inspect table →", "primary-link")} ${link("sql", "Open SQL", "button-link")}</div>`;
    return head("Inspect the interpretation and destination before creating a new table.") + `<div class="steps">${steps.map((x, i) => `<div class="step${i === mock.importStep ? " current" : ""}"><span>${i + 1}</span>${x}</div>`).join("")}</div>` + content + `<div class="footer-actions">${mock.importStep > 0 && mock.importStep < 3 ? button("Back", "import-back") : ""}${mock.importStep === 1 ? button("Review destination →", "import-next", "primary") : mock.importStep === 2 ? button("Simulate import", "import-next", "primary") : ""}</div>`;
  },
  branches() {
    return head("Keep experiments separate from the original database branch.", button("+ Create branch", "new-branch", "primary")) + panel("Project branches", table(["Branch", "Parent", "State", "Purpose", ""], [["main", "—", badge("READY"), "Primary database", link("sql", "Open SQL")], [mock.newBranch ? esc(mock.newBranch) : "pricing-experiment", "main", badge("READY"), "Independent data experiment", button("Open experiment", "open-branch")]])) + `<div class="grid two section-gap"><section class="panel pad"><h2>Explicit execution target</h2><p class="description">Creating a branch does not retarget existing editors or running sessions. Choose the experiment before applying a change.</p></section><section class="panel pad"><h2>Lifecycle and cleanup</h2><p class="description">Review affected work before deleting a branch. No automatic database merge is implied.</p><div style="margin-top:16px">${button("Review sample deletion", "delete-branch")}</div></section></div>`;
  },
  snapshots() {
    return head("A known data version for every analytical result.", button("Refresh snapshot", "refresh-snapshot", "primary")) + notice("Live PostgreSQL can change after publication. Existing sessions keep their selected inputs until you explicitly open or restart with another version.") +
      `<div class="grid"><section class="panel pad"><div class="eyebrow">Live source</div><div class="card-number">main</div><p class="description">Current PostgreSQL branch</p>${link("sql", "Query live data →")}</section><section class="panel pad"><div class="eyebrow">Latest available</div><div class="card-number">${mock.refreshed ? "09:45" : "09:30"}</div><p class="description">Today · complete publication</p>${badge("PUBLISHED")}</section><section class="panel pad"><div class="eyebrow">Existing session</div><div class="card-number">09:30</div><p class="description">Pinned input · unchanged by refresh</p>${badge(mock.refreshed ? "NEWER VERSION AVAILABLE" : "CURRENT SELECTION")}</section></div>` + `<div class="section-gap">${panel("Versions", table(["Snapshot", "Tables", "Outcome", "Use"], [[mock.refreshed ? "Today, 09:45" : "Today, 09:30", "2", badge("PUBLISHED"), button("Open notebook with this input", "snapshot-notebook")], ["Yesterday, 16:20", "2", badge("RETAINED"), link("activity", "Inspect operation")]]))}</div>`;
  },
  environment() {
    return head("Prepare dependencies, then explicitly choose when a kernel adopts them.", button("Prepare changes", "prepare-environment", "primary")) +
      `<div class="grid"><section class="panel pad"><div class="eyebrow">Declared</div><div class="card-number">Revision 4</div><p class="description">Project dependency declaration</p></section><section class="panel pad"><div class="eyebrow">Prepared</div><div class="card-number">${mock.prepared ? "Revision 4" : "Revision 3"}</div><p class="description">${mock.prepared ? "Verified sample preparation" : "Changes need preparation"}</p></section><section class="panel pad"><div class="eyebrow">Active kernel</div><div class="card-number">${mock.adopted ? "Revision 4" : "Revision 3"}</div><p class="description">${mock.adopted ? "Explicitly adopted" : "Unchanged by preparation"}</p></section></div>` + `<div class="split section-gap">${panel("Declared dependencies", table(["Package", "Constraint", "Change"], [["pandas", "Project lock", "Unchanged"], ["pyarrow", "Project lock", "Unchanged"], ["matplotlib", "Reviewed declaration", "Example addition"]]))}<section class="panel pad"><h2>Adopt prepared version</h2><p class="description">Adoption restarts the kernel. Saved source remains; in-memory variables are lost.</p><hr class="rule">${button("Review adoption", "adopt-environment", "primary", mock.prepared ? "" : "disabled")}<p class="description">Preparation controls follow the selected profile's package policies.</p></section></div>`;
  },
  publication() {
    const publish = mock.publicationMode === "publish";
    return head("A stable data input with clear ownership and explicit updates.") + `<div class="tabs" role="tablist" aria-label="Publication action">${button("Publish from this project", "publication:publish", "", `role="tab" aria-selected="${publish}"`)}${button("Bind into this project", "publication:bind", "", `role="tab" aria-selected="${!publish}"`)}</div>` +
      (mock.publicationDone ? notice("Sample review confirmed. This prototype has not published data or changed a binding.") : "") + `<div class="split"><section class="panel"><div class="panel-head"><h2>${publish ? "Complete snapshot set" : "Selected publication"}</h2>${badge("REVISION 7")}</div><div class="panel-body">${detail([["Producer", "Sales analytics"], ["Snapshot", "Today, 09:30"], ["Catalog", "sales.analytics"], [publish ? "Visibility" : "Consumer", publish ? "Existing access rules" : esc(mock.project)]])}</div>${table(["Table", "Columns", "Selection"], [["orders", "4", "Included"], ["customers", "6", "Included"]])}</section><section class="panel pad"><h2>${publish ? "Publish review" : "Destination binding"}</h2><p class="description">${publish ? "Publish the complete reviewed snapshot set. This does not grant access to everyone." : "Create a logical reference to this exact publication revision. Source ownership stays with the producer."}</p><hr class="rule">${!publish ? `<label>Logical dataset name<input id="binding-name" value="sales_reference"></label><hr class="rule">` : ""}${button(publish ? "Review publication" : "Review binding", "review-publication", "primary")}<p class="description">Running sessions remain pinned when a binding is later updated.</p></section></div>`;
  },
  packages() {
    const exp = mock.packageMode === "export";
    return head("Transfer source, dependencies and data as deliberate, separate choices.") + `<div class="tabs" role="tablist" aria-label="Package action">${button("Export project", "package:export", "", `role="tab" aria-selected="${exp}"`)}${button("Import & apply", "package:import", "", `role="tab" aria-selected="${!exp}"`)}</div>` + (mock.packageDone ? notice("Simulated package review confirmed. No archive was created and no source or data changed.") : "") +
      `<div class="split"><section class="panel pad"><h2>${exp ? "Choose what travels" : "Inspected sample package"}</h2><hr class="rule">${exp ? `<label class="check-row"><input type="checkbox" checked disabled><span><strong>Project source</strong><br><small>Saved queries, notebooks and declarations</small></span></label><label class="check-row"><input id="package-offline" type="checkbox"><span><strong>Offline dependencies</strong><br><small>Target-specific qualified wheel bundle</small></span></label><label class="check-row"><input id="package-data" type="checkbox"><span><strong>Logical table data</strong><br><small>Separate bounded .sbdata companion</small></span></label>` : detail([["Package", "sales-analytics.sbproj"], ["Source", "Saved revision 12"], ["Destination", esc(mock.project)], ["Binding", "Explicit review required"], ["Changes", "2 source assets · retained database"], ["Dependencies", "Environment preparation required"]])}<hr class="rule"><p class="description">No credentials, grants, runtime IDs or implicit full database backup are included.</p></section><section class="panel pad"><h2>${exp ? "Review export" : "Review destination plan"}</h2><p class="description">${exp ? "Verify the source revision and chosen companions before exporting." : "Confirm creates, retained resources and unresolved inputs. Apply only the plan you reviewed."}</p><hr class="rule">${button(exp ? "Review export" : "Review apply", "review-package", "primary")}</section></div>`;
  },
  activity() {
    return head("Follow outcomes, inspect failures and continue safely.", button("Refresh status", "activity-refresh")) +
      `<div class="split">${panel("Current and recent work", table(["Operation", "Resource", "State", "Started"], [["Snapshot refresh", "main", badge("COMPLETE"), "09:30"], ["Notebook execution", "Revenue exploration", badge(mock.cancelled ? "CANCELLED" : "RUNNING"), "09:42"], ["Environment preparation", "Revision 4", badge(mock.prepared ? "READY" : "NEEDS ATTENTION"), "09:41"]]))}<section class="panel pad"><h2>Notebook execution</h2><p class="description">Revenue exploration · selected example operation</p><hr class="rule">${detail([["Actor", actor()], ["Data", "Snapshot 09:30"], ["Stage", mock.cancelled ? "Cancellation complete" : "Running cell 1"], ["Result", mock.cancelled ? "Partial output retained" : "Not complete"]])}<hr class="rule">${button("Cancel execution", "cancel-execution", "", mock.cancelled ? "disabled" : "")}<p class="description">Closing this view does not stop the operation.</p></section></div>` + `<div class="section-gap">${notice("If a request times out, reconcile the original operation before retrying a mutation. This page proposes an aggregate view over existing operation records.")}</div>`;
  },
  access() {
    return head("Separate project membership, data access and execution authority.", button("Review access change", "review-access", "primary")) + notice("Governed example · UI visibility is not enforcement. The server authorizes each request and records the outcome.") +
      panel("Project membership", table(["Principal", "Origin", "Project role", "Data / execution"], [["Alex Morgan", "Direct", "Administrator", "Separately granted"], ["Analytics team", "Group", "Editor", "Separately granted"], ["Jordan Lee", mock.grant ? "Direct" : "None", mock.grant ? "Viewer" : "No project role", "No new grant"]])) +
      `<div class="grid section-gap"><section class="panel pad"><h2>PostgreSQL data</h2><p class="description">Branch and data privileges are independent of project membership.</p></section><section class="panel pad"><h2>Execution / service use</h2><p class="description">Choose actor and effective identity explicitly; never silently run as an owner.</p></section><section class="panel pad"><h2>Catalog grants</h2><p class="description">Review provider grants and overlapping origins.</p>${link("admin", "Open administration →")}</section></div><div class="footer-actions">${button("Review revocation", "review-revoke")}</div>`;
  },
  admin() {
    let content;
    if (mock.adminTab === "audit") content = panel("Audit events", table(["Time", "Actor", "Action", "Outcome"], [["09:44", "Alex Morgan", "Reviewed project role", mock.grant ? "Applied in example" : "Recorded example"], ["09:42", "Jordan Lee", "Execution admission", "Denied · insufficient authority"], ["09:30", "Alex Morgan", "Snapshot publication", "Succeeded"]]));
    else if (mock.adminTab === "identity") content = panel("Principals", table(["Name", "Type", "State"], [["Alex Morgan", "User", badge("ACTIVE")], ["Jordan Lee", "User", badge("ACTIVE")], ["analytics-service", "Service identity", badge("SCOPED")]]));
    else if (mock.adminTab === "catalog") content = panel("Catalog grant review", `<div class="panel-body">${detail([["Provider", "Managed OSS Unity Catalog"], ["Resource", "sales.analytics.orders"], ["Principal", "Analytics team"], ["Grant origin", "Group"], ["Revision", "Review required before mutation"]])}<hr class="rule">${button("Preview grant review", "review-catalog")}</div>`);
    else content = `<div class="grid"><section class="panel pad"><h2>Database services</h2><p class="description">Ready · PostgreSQL / storage</p></section><section class="panel pad"><h2>Catalog</h2><p class="description">Ready · metadata available</p></section><section class="panel pad"><h2>Execution capacity</h2><p class="description">1 of 2 qualified execution slots in use</p></section></div><div class="section-gap">${notice("Health is an operator projection. Backup/restore and runtime preparation remain explicit runbook operations until a browser contract exists.")}</div>`;
    return head("Scoped controls and evidence for the trusted installation operator.") + `<div class="tabs" role="tablist" aria-label="Administration section">${[["audit", "Audit"], ["identity", "Identities"], ["catalog", "Catalog grants"], ["health", "Service health"]].map(([k, v]) => button(v, `admin:${k}`, "", `role="tab" aria-selected="${mock.adminTab === k}"`)).join("")}</div>` + content + `<p class="description">Synthetic records only. Production lists and diagnostics require administrator authority and redaction.</p>`;
  },
};

function stateView(kind) {
  const messages = {
    empty: ["Nothing here yet", "There are no items in this example scope. Start with a project, import data or return to saved work.", "Choose a next step", "empty-next"],
    error: ["This part of your work is unavailable", "Keep your input. Check the original operation before retrying a change; a lost response does not prove failure.", "Retry this read", "ready"],
    denied: ["This page is unavailable", "It may not exist or you may not have access. Return to the projects available to you.", "Back to your projects", "home"],
  };
  if (kind === "loading") return head("Loading the current scope…") + `<section class="panel pad" aria-busy="true" aria-label="Loading content"><div class="skeleton" style="width:35%"></div><div class="skeleton" style="width:65%"></div><div class="skeleton big"></div><p class="description">Loading sample page state. Use the review controls to return to Ready.</p></section>`;
  const [title, text, cta, action] = messages[kind];
  // Denied state deliberately does not render resource title or cached content.
  return (kind === "denied" ? "" : head(kind === "empty" ? "A useful next step for an empty scope." : "An actionable recovery state.")) + `<div class="empty-state"><div class="symbol" aria-hidden="true">${kind === "empty" ? "□" : kind === "error" ? "!" : "—"}</div><h1>${title}</h1><p>${text}</p>${button(cta, action, "primary")}${kind === "error" ? `<div style="margin-top:18px">${link("activity", "Inspect activity →")}</div>` : ""}</div>`;
}
function render() {
  const protectedPage = ["access", "admin"].includes(page) && profile !== "governed";
  const denied = protectedPage || state === "denied";
  $("screen").value = page; $("profile").value = profile; $("state").value = state;
  document.title = `${denied ? "Unavailable" : screens[page].title} · Supabricks wireframes`;
  const nav = (id, label) => `<a class="nav-link" href="${url(id)}" ${screens[page].nav === id && !denied ? 'aria-current="page"' : ""}>${label}</a>`;
  $("rail").innerHTML = `<div><a href="${url("home")}" class="brand">supabricks.</a><div class="instance">${profile === "local" ? "On this device" : "Company analytics"}</div></div><nav aria-label="Installation">${nav("home", "⌂ &nbsp; Home / projects")}</nav>${link("project", `<span class="eyebrow">Selected project</span><br><strong>${denied ? "Choose a project" : esc(mock.project)}</strong>`, "project-switch")}<div><div class="nav-heading">Work</div><nav aria-label="Project work">${[["project", "Overview"], ["workspace", "Workspace"], ["data", "Data"], ["sql", "SQL editor"], ["notebook", "Notebooks"], ["branches", "Branches"], ["snapshots", "Snapshots"], ["activity", "Activity"]].map(([k, v]) => nav(k, v)).join("")}</nav></div><div><div class="nav-heading">Project settings</div><nav aria-label="Project settings">${nav("environment", "Environment")}${nav("packages", "Packages")}${profile === "governed" ? nav("access", "Access") : ""}</nav></div>${profile === "governed" ? `<nav aria-label="Administration">${nav("admin", "Administration")}</nav>` : ""}<div class="rail-bottom">${profile === "local" ? "LOCAL OWNER" : "GOVERNED SERVER"}<br>Sample identity and data</div>`;
  $("topbar").innerHTML = `<div class="crumb">${link("home", "Home")}<span>/</span>${denied ? "Unavailable" : ["home", "entry"].includes(page) ? "Your installation" : `${link("project", esc(mock.project))}<span>/</span>${esc(page === "project" ? "Overview" : screens[page].title)}`}</div>${button("Search project assets…", "search", "search-button")}<span class="identity">${profile === "governed" ? "Alex Morgan · administrator" : "Local owner"}</span>`;
  if (page === "entry") {
    $("rail").innerHTML = `<div><a href="${url("home")}" class="brand">supabricks.</a><div class="instance">Example installation</div></div><div class="rail-bottom">${profile === "local" ? "LOCAL LAUNCH" : "GOVERNED SIGN-IN"}<br>Projects load after authentication</div>`;
    $("topbar").innerHTML = '<div class="crumb">Supabricks <span>/</span> Enter your workspace</div>';
  }
  $("design-notes").hidden = !notes;
  $("design-notes").innerHTML = `<p><strong>${screens[page].id} · ${screens[page].flows}</strong> — ${esc(screens[page].note)}</p><p>Proposed structure · ${link("home", "Return to gallery home")} · <a href="../page-structure.md">Page specification</a></p>`;
  $("notes-toggle").setAttribute("aria-expanded", String(notes));
  $("content").innerHTML = denied ? stateView("denied") : state !== "ready" ? stateView(state) : views[page]();
  const sequence = journeys[journey] || [], position = sequence.indexOf(page);
  document.querySelectorAll('[role="tablist"] [role="tab"]').forEach((tab) => {
    tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
  });
  $("journey").value = journey;
  $("previous").disabled = position <= 0;
  $("next").disabled = position < 0 || position >= sequence.length - 1;
  $("journey-position").textContent = position < 0 ? "Choose any screen or follow a journey" : `${position + 1} / ${sequence.length} · ${sequence.map((s) => screens[s].title === "Sales analytics" ? "Project" : s[0].toUpperCase() + s.slice(1)).join(" → ")}`;
}
function navigate(id, nextState = "ready") {
  const hash = `#${id}?profile=${profile}&state=${nextState}`;
  if (location.hash === hash) { page = id; state = nextState; render(); }
  else location.hash = hash;
}
function readRoute() {
  const [name, query = ""] = location.hash.slice(1).split("?");
  page = Object.hasOwn(screens, name) ? name : "home";
  const params = new URLSearchParams(query);
  profile = params.get("profile") === "governed" ? "governed" : "local";
  state = ["loading", "empty", "error", "denied"].includes(params.get("state")) ? params.get("state") : "ready";
  render();
}
function announce(text) {
  clearTimeout(notificationTimer);
  $("announcement").textContent = text; $("announcement").hidden = false;
  notificationTimer = setTimeout(() => { $("announcement").hidden = true; }, 6500);
}
function dialog(title, body, actions = "") {
  dialogTrigger = document.activeElement;
  $("dialog").innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2>${button("×", "close-dialog", "", 'aria-label="Close dialog"')}</div><div class="dialog-body">${body}<div class="dialog-caption">WIREFRAME · NO REAL CHANGES WILL BE MADE</div></div><div class="dialog-actions">${button("Cancel", "close-dialog")}${actions}</div>`;
  $("dialog").showModal();
}
function closeDialog() { $("dialog").close(); }
$("dialog").addEventListener("close", () => {
  if (dialogTrigger?.isConnected) dialogTrigger.focus();
  else $("content").focus({ preventScroll: true });
});
function review(title, summary, action, label = "Confirm sample change") {
  dialog(title, `<p>Review the target and consequences before submitting.</p>${detail(summary)}`, button(label, action, "primary"));
}
function searchResults(value = "") {
  const list = [["sql", "Revenue by region", "Saved SQL query"], ["notebook", "Revenue exploration", "Saved notebook"], ["table", "public.orders", "Table detail"], ["environment", "Project environment", "Dependencies"]];
  $("search-results").innerHTML = list.filter(([, n]) => n.toLowerCase().includes(value.toLowerCase())).map(([id, n, type]) => `<a data-close-dialog href="${url(id)}">${n}<small>${type} · ${esc(mock.project)}</small></a>`).join("") || '<p class="description">No matching example assets.</p>';
}
const actions = {
  "close-dialog": closeDialog,
  "sign-in": () => { navigate("home"); announce("Simulated session opened. No authentication request was sent."); },
  home: () => navigate("home"), ready: () => navigate(page),
  "empty-next": () => dialog("Choose a next step", `<p>Continue with a project or a supported data workflow.</p><div class="stack">${link("project", "Open sample project", "button-link")}${link("import", "Import sample data", "button-link")}${link("workspace", "Browse saved work", "button-link")}</div>`),
  "start-journey": () => { journey = "first"; navigate("home"); },
  "other-project": () => { mock.project = "Customer research"; navigate("project"); announce("Example context changed. This prototype reuses fixture assets; production project assets are independent."); },
  "new-project": () => dialog("Create a project", '<p>Start with a name. Setup creates the project and its main database where supported.</p><label>Project name<input id="new-project-name" value="Sales exploration" required maxlength="40"></label>', button("Create sample project", "create-project", "primary")),
  "create-project": () => { const input = $("new-project-name"); if (!input.reportValidity()) return; mock.project = input.value.trim() || "Sales exploration"; closeDialog(); navigate("project"); announce("Sample project setup complete. No runtime was provisioned."); },
  "new-asset": () => dialog("Create an asset", `<p>New work belongs to ${esc(mock.project)}.</p><div class="stack">${link("sql", "New SQL query", "button-link")}${link("notebook", "New notebook", "button-link")}</div>`),
  search: () => { dialog("Search project assets", '<p>Illustrative project-scoped search over fixture assets.</p><label>Search<input id="search-input" type="search" placeholder="Query, notebook or table…"></label><div class="search-results" id="search-results"></div>'); searchResults(); $("search-input").focus(); },
  "save-sql": () => { mock.queryDirty = false; render(); announce("Sample query marked saved in memory. Reload resets this prototype."); },
  "run-sql": () => { mock.sqlRan = true; render(); announce("Sample query complete. The displayed fixture is not computed from your SQL."); },
  "save-notebook": () => { mock.notebookDirty = false; render(); announce("Sample notebook marked saved in memory. No file was written."); },
  "toggle-kernel": () => { mock.kernel = !mock.kernel; render(); announce(mock.kernel ? "Simulated kernel ready." : "Simulated kernel stopped; saved source remains."); },
  "run-cell": () => { if (!mock.kernel) return; mock.notebookRan = true; render(); announce("Simulated cell complete. No Python was executed."); },
  "import-next": () => { mock.importStep = Math.min(3, mock.importStep + 1); render(); },
  "import-back": () => { mock.importStep = Math.max(0, mock.importStep - 1); render(); },
  "new-branch": () => dialog("Create a database branch", `<p>Source: ${esc(mock.project)} / main. Existing editors keep their target.</p><label>Branch name<input id="new-branch-name" value="pricing-experiment" required maxlength="40"></label>`, button("Create sample branch", "create-branch", "primary")),
  "create-branch": () => { const input = $("new-branch-name"); if (!input.reportValidity()) return; mock.newBranch = input.value.trim() || "experiment"; closeDialog(); render(); announce("Sample branch created. Choose Open experiment to change editor context."); },
  "open-branch": () => { mock.branch = mock.newBranch || "pricing-experiment"; navigate("sql"); },
  "delete-branch": () => review("Review branch deletion", [["Branch", esc(mock.newBranch || "pricing-experiment")], ["Impact", "Experimental branch data removed; main remains"], ["Running work", "Check dependencies before confirmation"]], "confirm-delete"),
  "confirm-delete": () => { closeDialog(); announce("Deletion review illustrated. Fixture rows remain for navigation; no database changed."); },
  "refresh-snapshot": () => { mock.refreshed = true; render(); announce("Sample refresh complete. An existing session remains on 09:30."); },
  "snapshot-notebook": () => { mock.notebookSnapshot = mock.refreshed ? "09:45" : "09:30"; mock.kernel = false; mock.notebookRan = false; navigate("notebook"); announce("Opened notebook with selected sample inputs; no execution started."); },
  "prepare-environment": () => { mock.prepared = true; render(); announce("Sample environment revision 4 prepared; active kernel unchanged."); },
  "adopt-environment": () => review("Adopt prepared environment", [["Prepared", "Revision 4"], ["Affected work", "Current notebook kernel"], ["Consequence", "Restart clears in-memory variables; source stays saved"]], "confirm-adopt", "Simulate adoption"),
  "confirm-adopt": () => { mock.adopted = true; mock.kernel = true; mock.notebookRan = false; closeDialog(); render(); announce("Sample environment adopted; prior runtime output cleared."); },
  "review-publication": () => review(mock.publicationMode === "publish" ? "Review complete publication" : "Review dataset binding", [["Publication", "sales.analytics · revision 7"], ["Tables", "orders, customers"], ["Destination", esc(mock.publicationMode === "publish" ? "Existing catalog scope" : $("binding-name").value)], ["Permissions", "No new grant; current authorization required"]], "confirm-publication"),
  "confirm-publication": () => { mock.publicationDone = true; closeDialog(); render(); announce("Sample publication/binding confirmed. No catalog state changed."); },
  "review-package": () => review(mock.packageMode === "export" ? "Review project export" : "Review destination apply", [["Project", esc(mock.project)], ["Source", "Saved revision 12"], ["Offline dependencies", mock.packageMode === "export" ? ($("package-offline").checked ? "Included in example" : "Not included") : "Prepare after apply"], ["Logical data", mock.packageMode === "export" ? ($("package-data").checked ? "Separate companion" : "Not included") : "No automatic load"], ["Secrets / grants", "Never included"]], "confirm-package"),
  "confirm-package": () => { mock.packageDone = true; closeDialog(); render(); announce("Sample package operation confirmed. No files were exported or applied."); },
  "activity-refresh": () => announce("Sample status refreshed. No network request was made."),
  "cancel-execution": () => review("Cancel execution", [["Notebook", "Revenue exploration"], ["Consequence", "Interrupt current execution; partial output may remain"]], "confirm-cancel", "Simulate cancellation"),
  "confirm-cancel": () => { mock.cancelled = true; closeDialog(); render(); announce("Simulated cancellation confirmed."); },
  "review-access": () => review("Review project role", [["Principal", "Jordan Lee"], ["Resource", esc(mock.project)], ["Before → after", "No direct project role → Viewer"], ["Not granted", "PostgreSQL data, execution, service use or catalog access"]], "confirm-access"),
  "confirm-access": () => { mock.grant = true; closeDialog(); render(); announce("Sample role change applied. No real permission changed."); },
  "review-revoke": () => review("Review access revocation", [["Principal", "Jordan Lee"], ["Change", "Remove direct project role"], ["Review", "Check overlapping group grants and affected execution scope"], ["Completion", "Wait for confirmed policy/revocation outcome"]], "confirm-revoke"),
  "confirm-revoke": () => { mock.grant = false; closeDialog(); render(); announce("Sample direct role removed. This does not simulate revocation enforcement."); },
  "review-catalog": () => review("Review catalog grant", [["Principal", "Analytics team"], ["Resource", "sales.analytics.orders"], ["Origin", "Group"], ["Guard", "Provider identity and policy revision must still match"]], "confirm-catalog"),
  "confirm-catalog": () => { closeDialog(); announce("Illustrative catalog review complete; no grant changed."); },
};
document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action) {
    if (action.includes(":")) {
      const [type, value] = action.split(":");
      const keys = { scope: "dataScope", detail: "detailTab", publication: "publicationMode", package: "packageMode", admin: "adminTab" };
      if (keys[type]) { mock[keys[type]] = value; render(); }
    } else actions[action]?.();
  }
  const anchor = event.target.closest('a[href^="#"]');
  if (anchor && page === "table") {
    if (anchor.getAttribute("href").startsWith("#sql?")) {
      mock.engine = mock.dataScope === "live" ? "PostgreSQL" : "Spark SQL";
      mock.sqlRan = false;
    }
    if (anchor.getAttribute("href").startsWith("#publication?")) {
      mock.publicationMode = mock.dataScope === "live" ? "publish" : "bind";
    }
  }
  if (anchor && $("dialog").open) closeDialog();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("dialog").open) {
    event.preventDefault();
    event.stopPropagation();
    closeDialog();
    return;
  }
  const tab = event.target.closest('[role="tab"]');
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(tab);
  const target = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
    (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  const label = tab.parentElement.getAttribute("aria-label");
  event.preventDefault();
  tabs[target].click();
  [...document.querySelectorAll('[role="tablist"]')].find((list) => list.getAttribute("aria-label") === label)
    ?.querySelector('[aria-selected="true"]')?.focus();
}, true);
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.id === "sql-source") { mock.query = el.value; mock.queryDirty = true; $("content").querySelector(".page-head p").textContent = "Unsaved changes · source and results have separate lifecycles."; }
  if (el.id === "notebook-source") { mock.code = el.value; mock.notebookDirty = true; $("content").querySelector(".page-head p").textContent = "Unsaved changes · Revenue exploration.ipynb"; }
  if (el.id === "search-input") searchResults(el.value);
  if (["asset-filter", "data-filter"].includes(el.id)) {
    document.querySelectorAll("#content tbody tr").forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(el.value.toLowerCase()); });
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "engine") { mock.engine = event.target.value; mock.sqlRan = false; render(); announce("Example engine changed; source retained and old results cleared. Review the dialect before running."); }
});
$("screen").innerHTML = Object.entries(screens).map(([key, v]) => `<option value="${key}">${v.id} · ${key === "project" ? "Project overview" : v.title}</option>`).join("");
$("screen").addEventListener("change", (event) => navigate(event.target.value));
$("profile").addEventListener("change", (event) => { profile = event.target.value; navigate(page, state); });
$("state").addEventListener("change", (event) => navigate(page, event.target.value));
$("notes-toggle").addEventListener("click", () => { notes = !notes; render(); });
$("journey").addEventListener("change", (event) => { journey = event.target.value; if (journey === "governance") profile = "governed"; if (journeys[journey]) navigate(journeys[journey][0]); else render(); });
$("previous").addEventListener("click", () => { const sequence = journeys[journey]; if (sequence) navigate(sequence[sequence.indexOf(page) - 1]); });
$("next").addEventListener("click", () => { const sequence = journeys[journey]; if (sequence) navigate(sequence[sequence.indexOf(page) + 1]); });
window.addEventListener("hashchange", () => { readRoute(); $("content").focus({ preventScroll: true }); });
readRoute();
