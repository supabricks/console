// UC06: actual browser controls over an installed local catalog/PG/Sail/Jupyter runtime.
import { chromium, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const exec = promisify(execFile);
const opts = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((all, v, i, a) => (i % 2 ? all : [...all, [v, a[i + 1]]]), []),
);
const binary = resolve(opts["--binary"]),
  root = resolve(opts["--root"]);
const cwd = join(root, "empty"),
  data = join(root, "data");
await mkdir(cwd, { recursive: true });
const env = { ...process.env, SUPABRICKS_DATA_DIR: data };
for (const k of Object.keys(env))
  if (/^(PG|AWS_|PC_|OTEL_)/.test(k) || /_PROXY$/i.test(k)) delete env[k];
async function cli(...args) {
  try {
    return JSON.parse(
      (
        await exec(binary, args, {
          env,
          cwd,
          timeout: 180000,
          maxBuffer: 3 * 1024 * 1024,
        })
      ).stdout,
    );
  } catch (e) {
    throw new Error(
      `CLI ${args[0]} failed: ${String(e.stderr ?? e.code).slice(-1000)}`,
    );
  }
}
const report = { status: "FAIL", checks: [] };
let browser, page;
const check = (name) => {
  report.checks.push(name);
  console.log("PASS", name);
};
const exact = (name) => page.getByRole("button", { name, exact: true });
async function dataView() {
  await exact("Data").click();
  await expect(exact("Refresh data")).toBeEnabled({ timeout: 30000 });
}
async function create(name) {
  await page
    .getByRole("button", { name: "+ New project", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await dialog.getByLabel("Project name", { exact: true }).fill(name);
  await dialog
    .getByRole("button", { name: "Create and open", exact: true })
    .click();
  await expect(page.locator(".project-card strong")).toHaveText(name, {
    timeout: 120000,
  });
  return page.evaluate(async () =>
    (
      await fetch("/api/overview", { headers: { "X-Supabricks-Console": "1" } })
    ).json(),
  );
}
async function publish() {
  await exact("Refresh analytical snapshot").click();
  await expect(exact("Review publication")).toBeEnabled({ timeout: 120000 });
  await exact("Review publication").click();
  await expect(exact("Publish reviewed snapshot")).toBeEnabled({
    timeout: 30000,
  });
  await exact("Publish reviewed snapshot").click();
  await expect(page.getByLabel("Pending catalog request")).toHaveCount(0, {
    timeout: 90000,
  });
  await expect(
    page.getByRole("heading", { name: /main · Revision/ }).last(),
  ).toBeVisible();
}
async function runSql(sql) {
  const ui = page.getByRole("region", {
    name: "Analytical workspace",
    exact: true,
  });
  await ui.getByLabel("Analytics SQL").fill(sql);
  await ui
    .getByRole("button", { name: "Run Analytics SQL", exact: true })
    .click();
  await expect(ui.locator(".analytics-result").last()).toContainText(
    "complete",
    { timeout: 45000 },
  );
  return ui;
}
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--disable-background-networking", "--disable-component-update"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  await context.route("**/*", (route) =>
    ["127.0.0.1", "localhost", "[::1]"].includes(
      new URL(route.request().url()).hostname,
    )
      ? route.continue()
      : route.abort(),
  );
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const home = await cli("console", "--no-open");
  await page.goto(home.url);
  const producer = await create("catalog-producer");
  await dataView();
  await expect(
    page.getByText("No catalog publications in this project.", { exact: true }),
  ).toBeVisible();
  await exact("Database workspace").click();
  await exact("Import file").click();
  await page.getByLabel("Choose data file").setInputFiles({
    name: "sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,amount\n1,10\n2,20\n"),
  });
  await expect(page.getByRole("table", { name: "Column mapping" })).toBeVisible(
    { timeout: 30000 },
  );
  await page.getByLabel("New table name", { exact: true }).fill("sales");
  await page
    .getByLabel("I approve these columns and this destination.")
    .check();
  await exact("Create table and import").click();
  await expect(
    page.locator(".import-job").filter({ hasText: "public.sales" }),
  ).toContainText("2 committed rows", { timeout: 60000 });
  await exact("Publish imported data").click();
  await expect(exact("Refresh data")).toBeEnabled({ timeout: 30000 });
  await publish();
  check("producer_created_ingested_and_published_in_browser");
  const owned = await cli(
    "catalog",
    "datasets",
    "owned",
    "--project",
    producer.worktree,
  );
  const first = owned.items[0];
  const consumer = await create("catalog-consumer");
  await dataView();
  await exact("Add existing dataset").click();
  await page
    .getByRole("button", { name: /catalog-producer · main · Revision 1/ })
    .click();
  await page.getByLabel("Dataset name", { exact: true }).fill("sales");
  await exact("Review dataset binding").click();
  await expect(page.getByLabel("Dataset plan review")).toContainText(
    "bind · dataset.sales",
  );
  // Admission succeeds but the response is lost; explicit recovery after reload is idempotent.
  let lost = false;
  const drop = async (route) => {
    const c = route.request().postDataJSON();
    if (!lost && c?.command?.command?.action === "apply") {
      lost = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  };
  await page.route("**/api/workspace", drop);
  await exact("Apply reviewed dataset plan").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.unroute("**/api/workspace", drop);
  expect(lost).toBe(true);
  await page.reload();
  await dataView();
  await exact("Recover last request").click();
  await expect(page.getByLabel("Pending catalog request")).toHaveCount(0, {
    timeout: 90000,
  });
  await expect(
    page.getByRole("heading", { name: "dataset.sales", exact: true }),
  ).toBeVisible();
  check(
    "explicit_binding_recovers_lost_response_and_reload_without_duplicate_apply",
  );
  const origin = new URL(page.url()).origin;
  const forged = await context.request.post(origin + "/api/workspace", {
    headers: { Origin: origin, "X-Supabricks-Console": "1" },
    data: { action: "catalog_datasets", command: { action: "list" } },
  });
  expect(forged.status()).toBe(403);
  const cross = await context.request.get(origin + "/api/session", {
    headers: { "X-Supabricks-Console": "1" },
  });
  const csrf = (await cross.json()).csrf;
  const foreign = await context.request.post(origin + "/api/workspace", {
    headers: {
      Origin: origin,
      "X-Supabricks-Console": "1",
      "X-Supabricks-CSRF": csrf,
    },
    data: {
      action: "catalog_publication",
      command: { action: "status", id: first.target.publication_id },
    },
  });
  expect(foreign.ok()).toBe(false);
  check("csrf_and_foreign_project_publication_status_are_rejected");
  await exact("Query dataset.sales.sales").click();
  const analytics = page.getByRole("region", {
    name: "Analytical workspace",
    exact: true,
  });
  await expect(analytics.getByLabel("Analytical input mode")).toHaveValue(
    "catalog",
  );
  await analytics
    .getByRole("button", { name: "Open latest session", exact: true })
    .click();
  await expect(
    analytics.getByRole("button", { name: "Run Analytics SQL", exact: true }),
  ).toBeEnabled({ timeout: 120000 });
  await runSql("SELECT count(*) AS n FROM dataset_sales.public.sales");
  await expect(
    analytics.getByRole("table", { name: "SQL results" }),
  ).toContainText("2");
  check("bound_dataset_queried_in_spark_workspace");
  const producerPage = await context.newPage();
  const consumerPage = page;
  page = producerPage;
  await page.goto(
    (await cli("console", "--no-open", "--project", producer.worktree)).url,
  );
  await dataView();
  // A schema/data change creates a new producer publication; consumer remains pinned.
  for (const sql of [
    "ALTER TABLE sales ADD COLUMN note text",
    "INSERT INTO sales(id,amount,note) VALUES(3,30,'new')",
  ])
    await cli(
      "sql",
      "--branch",
      "main",
      "--write",
      "--sql",
      sql,
      "--project",
      producer.worktree,
    );
  await page.locator("details").filter({hasText:"Live PostgreSQL"}).locator("summary").click();
  await page
    .locator("details")
    .filter({ hasText: "Live PostgreSQL" })
    .getByRole("button", { name: "Validate public.sales", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/changed|schema|stale/i, {
    timeout: 30000,
  });
  check("live_schema_drift_requires_explicit_reinspection");
  await publish();
  await page
    .locator(".dataset-card")
    .filter({ hasText: "Revision 1" })
    .getByRole("button", { name: "Explore publication", exact: true })
    .click();
  await exact("Query sales").click();
  const historic = page.getByRole("region", {
    name: "Analytical workspace",
    exact: true,
  });
  await expect(historic).toContainText(first.epoch_id);
  await historic
    .getByRole("button", { name: "Open latest session", exact: true })
    .click();
  await expect(
    historic.getByRole("button", { name: "Run Analytics SQL", exact: true }),
  ).toBeEnabled({ timeout: 120000 });
  // The copied SQL is fully qualified to the selected owned catalog.
  const draft = await historic.getByLabel("Analytics SQL").inputValue();
  await runSql(draft.replace("SELECT *", "SELECT count(*) AS n"));
  await expect(
    historic.getByRole("table", { name: "SQL results" }),
  ).toContainText("2");
  await historic
    .getByRole("button", { name: "Close analytical session", exact: true })
    .click();
  await expect(historic.locator(".analytics-binding")).toContainText("closed", {
    timeout: 30000,
  });
  check("owned_publication_handoff_pins_selected_historical_epoch");
  await page.close();
  page = consumerPage;
  await runSql("SELECT count(*) AS n FROM dataset_sales.public.sales");
  await expect(
    analytics.getByRole("table", { name: "SQL results" }),
  ).toContainText("2");
  await dataView();
  await exact("Review update dataset.sales").click();
  await expect(page.getByLabel("Dataset plan review")).toContainText(
    '"schema_changed": true',
  );
  await exact("Apply reviewed dataset plan").click();
  await expect(page.getByLabel("Pending catalog request")).toHaveCount(0, {
    timeout: 90000,
  });
  await exact("Database workspace").click();
  await exact("Analytics").click();
  await runSql("SELECT count(*) AS n FROM dataset_sales.public.sales");
  await expect(
    analytics.getByRole("table", { name: "SQL results" }),
  ).toContainText("2");
  check(
    "producer_refresh_and_reviewed_schema_update_preserve_existing_reader_revision",
  );
  await dataView();
  await exact("Notebook dataset.sales.sales").click();
  await exact("Open prepared dataset notebook").click();
  await expect(page.getByLabel("Notebook input mode")).toHaveValue("catalog");
  await expect(exact("Start kernel")).toBeEnabled();
  await exact("Start kernel").click();
  await expect(exact("Run cell")).toBeEnabled({ timeout: 150000 });
  await page
    .locator(".jp-CodeCell .cm-content")
    .first()
    .fill(
      "print('CATALOG_ROWS', spark.table('dataset_sales.public.sales').count())",
    );
  await exact("Run cell").click();
  await expect(page.locator(".jp-OutputArea").first()).toContainText(
    "CATALOG_ROWS 3",
    { timeout: 60000 },
  );
  await exact("Stop kernel").click();
  await expect(exact("Start kernel")).toBeEnabled({ timeout: 30000 });
  check(
    "notebook_handoff_uses_current_fixed_binding_without_automatic_execution",
  );
  await dataView();
  await exact("Review removal dataset.sales").click();
  await expect(page.getByLabel("Dataset plan review")).toContainText(
    "unbind · dataset.sales",
  );
  await exact("Apply reviewed dataset plan").click();
  await expect(page.getByLabel("Pending catalog request")).toHaveCount(0, {
    timeout: 90000,
  });
  await expect(
    page.getByText("No shared datasets bound to this project.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: join(root, "catalog-consumer.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  check("reviewed_unbind_preserves_producer_data");
  const catalogState = await cli("catalog", "service", "status");
  const token = join(root, "unavailable-token");
  await writeFile(token, "fixture-token", { mode: 0o600 });
  await cli(
    "catalog",
    "service",
    "configure",
    "external",
    "--endpoint",
    "https://127.0.0.1:1",
    "--token-file",
    token,
    "--metastore-id",
    catalogState.metastore_id,
  );
  await exact("Refresh data").click();
  await expect(
    page.getByText(
      "Catalog publication and new catalog readers require a ready local provider. Live PostgreSQL remains independent.",
    ),
  ).toBeVisible({ timeout: 30000 });
  await expect(exact("Review publication")).toBeDisabled();
  expect(
    (
      await cli(
        "sql",
        "--sql",
        "SELECT count(*) FROM sales",
        "--project",
        producer.worktree,
      )
    ).rows,
  ).toEqual([["3"]]);
  await cli("catalog", "service", "configure", "local");
  await expect
    .poll(async () => (await cli("catalog", "service", "status")).ready, {
      timeout: 60000,
    })
    .toBe(true);
  check("absent_provider_blocks_publication_without_breaking_postgres");
  report.status = "PASS";
} catch (error) {
  report.error = String(error.message).replace(
    /#launch=[a-f0-9]+/g,
    "#launch=REDACTED",
  );
  if (page)
    await page
      .screenshot({ path: join(root, "failure.png"), fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  await cli("down").catch(() => {});
  await mkdir(resolve(opts["--report"], ".."), { recursive: true });
  await writeFile(opts["--report"], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
