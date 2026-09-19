import { expect } from "@playwright/test";
import { mkdir, readFile, writeFile, realpath } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export async function qualifyProjects({
  page,
  context,
  cliAt,
  cli,
  root,
  binary,
  worker,
  checks,
}) {
  await cli("database", "create", "packaging-drafts", "--wait");
  await page.getByRole("button", { name: "↻ Refresh", exact: true }).click();
  await page
    .getByRole("button", { name: "Database workspace", exact: true })
    .click();
  const workspace = page.getByRole("region", {
    name: "Database workspace",
    exact: true,
  });
  const hostOverview = await (
    await context.request.get(new URL(page.url()).origin + "/api/overview", {
      headers: { "X-Supabricks-Console": "1" },
    })
  ).json();
  await workspace
    .getByLabel("Navigation branch")
    .selectOption(
      hostOverview.branches.find((b) => b.name === "packaging-drafts").id,
    );
  await workspace
    .getByRole("button", { name: "New SQL tab", exact: true })
    .click();
  const unsaved = "SELECT 'unsaved packaging draft'";
  await workspace.getByLabel("SQL statement", { exact: true }).fill(unsaved);
  const source = join(root, "package-source");
  await mkdir(join(source, "queries"), { recursive: true });
  const query = join(source, "queries/answer.sql");
  await writeFile(query, "SELECT 42 AS answer\n");
  const definition = randomUUID();
  const manifest = `format_version=2\nid='${definition}'\nname='portable-demo'\n[package]\nversion='1.0.0'\ninclude=['queries/*.sql']\nnotebook_outputs='strip'\n[resources.database.main]\nkind='postgres_database'\nlifecycle='retain'\n[resources.query.answer]\nkind='sql'\nengine='postgres'\nfile='queries/answer.sql'\ndatabase='database.main'\n`;
  await writeFile(join(source, "supabricks.toml"), manifest);
  const archive = join(root, "example.sbproj");
  await cliAt(source, "project", "pack", "--output", archive);
  const processesBefore = (await cli("status")).runtime.processes
    .filter((p) => p.role.startsWith("notebook"))
    .map((p) => p.role);
  await page
    .getByRole("button", { name: "Project packages", exact: true })
    .click();
  const packages = page.getByRole("region", {
    name: "Project packages",
    exact: true,
  });
  await packages.getByLabel("Select project package").setInputFiles({
    name: "invalid.sbproj",
    mimeType: "application/gzip",
    buffer: Buffer.from("invalid package"),
  });
  await expect(packages.getByRole("alert").first()).toBeVisible();
  await expect(
    packages.getByRole("button", { name: "Unpack as new project" }),
  ).toHaveCount(0);
  checks.push(
    "PK06 invalid archive is rejected without publishing a source directory",
  );
  let releaseChunk;
  const stalled = new Promise((resolve) => {
    releaseChunk = resolve;
  });
  const stall = async (route) => {
    if (route.request().postDataJSON()?.command?.action === "chunk")
      await stalled;
    await route.continue();
  };
  await page.route("**/api/workspace", stall);
  const chunkStarted = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/workspace") &&
      r.postDataJSON()?.command?.action === "chunk",
  );
  await packages.getByLabel("Select project package").setInputFiles({
    name: "cancel.sbproj",
    mimeType: "application/gzip",
    buffer: Buffer.alloc(1024 * 1024),
  });
  await chunkStarted;
  await packages
    .getByRole("button", { name: "Cancel upload", exact: true })
    .click();
  releaseChunk();
  await expect(packages.getByRole("alert").first()).toContainText("cancelled");
  await page.unroute("**/api/workspace", stall);
  await page
    .getByRole("button", { name: "Database workspace", exact: true })
    .click();
  await expect(
    workspace.getByLabel("SQL statement", { exact: true }),
  ).toHaveValue(unsaved);
  await page
    .getByRole("button", { name: "Project packages", exact: true })
    .click();
  checks.push(
    "PK06 invalid input and cancelled upload preserve an unsaved SQL draft",
  );
  await packages.getByLabel("Select project package").setInputFiles(archive);
  await expect(
    packages.getByRole("heading", { name: "Verified package: portable-demo" }),
  ).toBeVisible();
  await packages.getByRole("button", { name: "Unpack as new project" }).click();
  await expect(
    packages.getByRole("button", { name: "Create local deployment" }),
  ).toBeVisible();
  const identity = packages.getByRole("article", { name: "Project identity" });
  const imported = await identity.locator("dd").first().innerText();
  expect(imported).not.toBe(source);
  const bindings = await cliAt(imported, "project", "deployments");
  expect(bindings.deployments).toHaveLength(0);
  expect(
    (await cli("status")).runtime.processes
      .filter((p) => p.role.startsWith("notebook"))
      .map((p) => p.role),
  ).toEqual(processesBefore);
  checks.push(
    "PK06 browser import publishes a new unbound project and never starts a kernel",
  );
  await packages.getByRole("button", { name: "Discard preview" }).click();
  await packages
    .getByRole("button", { name: "Create local deployment" })
    .click();
  await expect(
    packages.getByRole("button", { name: "Plan deployment" }),
  ).toBeVisible();
  const binding = await cliAt(imported, "project", "binding");
  await expect(identity).toContainText(binding.deployment_id);
  expect(binding.definition_id).toBe(definition);
  expect(binding.runtime_project_id).not.toBe(definition);
  // Keep the real server response for equivalence, never synthesize a plan in the UI.
  const planResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/workspace") &&
      r.request().postDataJSON()?.command?.command?.action === "plan",
  );
  await packages.getByRole("button", { name: "Plan deployment" }).click();
  const plan = (await (await planResponse).json()).value;
  expect(plan).toEqual(await cliAt(imported, "project", "plan"));
  await writeFile(
    join(imported, "queries/answer.sql"),
    "SELECT 43 AS answer\n",
  );
  await packages.getByRole("button", { name: "Apply reviewed plan" }).click();
  await expect(packages.getByRole("alert").first()).toContainText("stale");
  expect(
    (await cliAt(imported, "project", "installed")).active_revision,
  ).toBeNull();
  await packages.getByRole("button", { name: "Recover apply by key" }).click();
  await expect(
    packages.getByRole("button", { name: "Plan deployment" }),
  ).toBeEnabled();
  checks.push(
    "PK06 browser and CLI plans are identical; stale source fails before admission",
  );
  await packages.getByRole("button", { name: "Plan deployment" }).click();
  await expect(
    packages.getByRole("button", { name: "Apply reviewed plan" }),
  ).toBeEnabled();
  const applyKey = await packages.getByLabel("Apply request key").inputValue();
  let admitted;
  const lost = async (route) => {
    const body = route.request().postDataJSON();
    if (
      body?.action === "project" &&
      body.command?.command?.action === "apply"
    ) {
      const response = await route.fetch();
      admitted = (await response.json()).value;
      await route.abort("failed");
    } else await route.continue();
  };
  await page.route("**/api/workspace", lost);
  await packages.getByRole("button", { name: "Apply reviewed plan" }).click();
  await expect(packages.getByRole("alert").first()).toBeVisible();
  await page.unroute("**/api/workspace", lost);
  await packages.getByRole("button", { name: "Recover apply by key" }).click();
  await expect(
    packages.getByRole("heading", { name: "Apply succeeded" }),
  ).toBeVisible({ timeout: 120000 });
  expect(
    (await cliAt(imported, "project", "find", "--key", applyKey)).operation.id,
  ).toBe(admitted.id);
  const installed = await cliAt(imported, "project", "installed");
  expect(installed.active_revision).toBe(admitted.id);
  await expect(identity).toContainText("Matches installed source");
  checks.push(
    "PK06 lost apply reply recovers the original durable operation and activates once",
  );
  await packages.getByRole("button", { name: "View query.answer" }).click();
  await expect(packages.locator(".package-asset")).toContainText("SELECT 43");
  await packages.getByLabel("New draft path").fill("queries/answer.sql");
  await packages
    .getByRole("button", { name: "Copy to new source draft" })
    .click();
  await expect(packages.getByRole("alert").first()).toBeVisible();
  await expect(packages.getByLabel("New draft path")).toHaveValue(
    "queries/answer.sql",
  );
  await packages.getByLabel("New draft path").fill("queries/draft.sql");
  await packages
    .getByRole("button", { name: "Copy to new source draft" })
    .click();
  await expect(
    packages
      .getByRole("status")
      .filter({ hasText: "Created queries/draft.sql" }),
  ).toBeVisible();
  expect(await readFile(join(imported, "queries/draft.sql"), "utf8")).toContain(
    "SELECT 43",
  );
  await packages.getByRole("button", { name: "Refresh project" }).click();
  await expect(identity).toContainText(
    "Local source differs from installed revision",
  );
  checks.push(
    "PK06 installed assets are read-only; draft copying never overwrites files and source drift is visible",
  );
  await packages.getByRole("button", { name: "Preview export" }).click();
  await expect(
    packages.getByRole("button", { name: "Download package" }),
  ).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await packages.getByRole("button", { name: "Download package" }).click();
  const download = await downloadEvent;
  const downloaded = join(root, "download.sbproj");
  await download.saveAs(downloaded);
  const canonical = join(root, "canonical.sbproj");
  await cliAt(imported, "project", "pack", "--output", canonical);
  expect(await readFile(downloaded)).toEqual(await readFile(canonical));
  await packages.getByRole("button", { name: "Discard preview" }).click();
  checks.push("PK06 browser export is byte-identical to CLI packaging");
  // Conflicting destination is rejected by the same durable binding rules.
  const other = await cliAt(source, "project", "create", "--key", "other");
  const origin = new URL(page.url()).origin;
  const session = await (
    await context.request.get(origin + "/api/session", {
      headers: { "X-Supabricks-Console": "1" },
    })
  ).json();
  const selected = await packages.getByLabel("Project source").inputValue();
  const conflict = await context.request.post(origin + "/api/workspace", {
    headers: {
      Origin: origin,
      "X-Supabricks-Console": "1",
      "X-Supabricks-CSRF": session.csrf,
    },
    data: {
      action: "project",
      source: { kind: "imported", id: selected },
      command: { action: "attach", deployment: other.deployment_id },
    },
  });
  expect(conflict.status()).toBe(409);
  expect((await cliAt(imported, "project", "binding")).deployment_id).toBe(
    binding.deployment_id,
  );
  checks.push(
    "PK06 a conflicting deployment cannot take over an imported worktree",
  );
  // A valid inventory with an invalid dependency declaration fails runtime preparation.
  const release = worker
    ? dirname(dirname(dirname(worker)))
    : dirname(dirname(await realpath(binary)));
  const contractBytes = await readFile(
    join(release, "python/notebooks/kernel-contract.json"),
  );
  const contract = JSON.parse(contractBytes);
  const envDir = join(imported, "notebooks/environment");
  await mkdir(envDir, { recursive: true });
  await writeFile(
    join(envDir, "pyproject.toml"),
    "[project]\nname='broken-environment'\nversion='0.1.0'\ndependencies=42\n",
  );
  await writeFile(join(envDir, "uv.lock"), "version=1\npackage=[]\n");
  await mkdir(join(imported, "dependencies"));
  const py = join(release, "python/analytics/python");
  await exec(py, [
    "-c",
    `import sys,json,hashlib,zipfile,pathlib
p=pathlib.Path(sys.argv[1]); files={n:(p/'notebooks/environment'/n).read_bytes() for n in ('pyproject.toml','uv.lock')}
with zipfile.ZipFile(p/'dependencies/incomplete.zip','w') as z:
 for n,b in files.items(): z.writestr(n,b)
 z.writestr('bundle.json',json.dumps(dict(version=1,target=sys.argv[2],contract=sys.argv[3],files={n:hashlib.sha256(b).hexdigest() for n,b in files.items()})))`,
    imported,
    contract.target,
    createHash("sha256").update(contractBytes).digest("hex"),
  ]);
  const expanded =
    manifest.replace(
      "include=['queries/*.sql']",
      "include=['queries/*.sql','notebooks/environment/*','dependencies/*.zip']",
    ) +
    `\n[environments.base]\npyproject='notebooks/environment/pyproject.toml'\nlock='notebooks/environment/uv.lock'\n[environments.base.bundles]\n${contract.target}='dependencies/incomplete.zip'\n`;
  await writeFile(join(imported, "supabricks.toml"), expanded);
  await packages.getByRole("button", { name: "Refresh project" }).click();
  await packages.getByRole("button", { name: "Plan deployment" }).click();
  await expect(
    packages.getByRole("button", { name: "Apply reviewed plan" }),
  ).toBeEnabled();
  await packages.getByRole("button", { name: "Apply reviewed plan" }).click();
  await expect(
    packages.getByRole("heading", { name: "Apply failed" }),
  ).toBeVisible({ timeout: 120000 });
  expect((await cliAt(imported, "project", "installed")).active_revision).toBe(
    installed.active_revision,
  );
  await writeFile(join(imported, "supabricks.toml"), manifest);
  await packages.getByRole("button", { name: "Refresh project" }).click();
  await packages.getByRole("button", { name: "Plan deployment" }).click();
  await expect(
    packages.getByRole("button", { name: "Apply reviewed plan" }),
  ).toBeEnabled();
  await packages.getByRole("button", { name: "Apply reviewed plan" }).click();
  await expect(
    packages.getByRole("heading", { name: "Apply succeeded" }),
  ).toBeVisible({ timeout: 120000 });
  checks.push(
    "PK06 failed environment preparation preserves the active revision and a corrected apply recovers",
  );
  // A CLI-created deployment opens with the exact identity through a fresh console launch.
  const launched = await cliAt(source, "console", "--no-open");
  const peer = await context.newPage();
  await peer.goto(launched.url);
  await peer
    .getByRole("button", { name: "Project packages", exact: true })
    .click();
  await expect(
    peer.getByRole("article", { name: "Project identity" }),
  ).toContainText(other.deployment_id);
  await peer.close();
  const popupEvent = page.waitForEvent("popup");
  await packages
    .getByRole("button", { name: "Open console in new tab" })
    .click();
  const popup = await popupEvent;
  await popup
    .getByRole("button", { name: "Project packages", exact: true })
    .click();
  await expect(
    popup.getByRole("article", { name: "Project identity" }),
  ).toContainText(binding.deployment_id);
  await expect(
    popup.getByRole("heading", { name: "Apply succeeded", exact: true }),
  ).toBeVisible();
  await popup.close();
  await expect(packages.getByLabel("New draft path")).toHaveValue(
    "queries/draft.sql",
  );
  checks.push(
    "PK06 CLI-created and browser-created deployments reopen with identical identity and preserve the original tab drafts",
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
}
