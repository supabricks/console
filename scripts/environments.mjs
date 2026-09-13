// Real product package controls and kernels. No injected execution client.
import { expect } from "@playwright/test";
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  readdir,
  lstat,
} from "node:fs/promises";
import path from "node:path";
export async function qualifyEnvironments(
  page,
  { project, root, data, screenshot, cli, cliAt, browser, checks },
) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  await button("Notebooks").click();
  const panel = page.locator(".environment-panel");
  await panel.locator("summary").first().click();
  await expect(panel).toContainText("Start kernel prepares the bundled base");
  expect((await cli("env", "status")).operations).toHaveLength(0);
  checks.push("opening_notebook_only_inspects_without_preparation");
  await page.getByLabel("Notebook branch").selectOption({ label: "main" });
  await button("Start kernel").click();
  const run = button("Run cell");
  await expect(run).toBeEnabled({ timeout: 120000 });
  const code = page.locator(".jp-CodeCell .cm-content").first();
  const output = page.locator(".jp-OutputArea").first();
  async function execute(source, expected) {
    await code.fill(source);
    await run.click();
    await expect(output).toContainText(expected, { timeout: 60000 });
    await expect(run).toBeEnabled();
  }
  function epoch() {
    return page
      .getByRole("status")
      .filter({ hasText: "Kernel:" })
      .innerText()
      .then((s) => s.match(/Epoch: ([^. ]+)/)[1]);
  }
  const originalEpoch = await epoch();
  await execute(
    "sentinel = 42\nimport importlib.util\nprint('ABSENT', importlib.util.find_spec('humanize') is None)",
    "ABSENT True",
  );
  let previous = (await cli("env", "status")).active_generation;
  async function completed(old = previous) {
    await expect
      .poll(async () => (await cli("env", "status")).active_generation, {
        timeout: 180000,
      })
      .not.toBe(old);
    await expect(panel).toContainText("Last environment operation: ready", {
      timeout: 15000,
    });
    previous = (await cli("env", "status")).active_generation;
  }
  await page.getByLabel("Offline packages only").uncheck();
  await page.getByLabel("Package requirement").fill("humanize==4.13.0");
  await button("Add package").click();
  await completed();
  await expect(panel).toContainText(
    "selected kernel keeps its existing packages",
  );
  await execute(
    "print('OLD', sentinel, importlib.util.find_spec('humanize') is None)",
    "OLD 42 True",
  );
  await expect(button("Use prepared environment")).toBeEnabled({
    timeout: 15000,
  });
  page.once("dialog", (d) => d.dismiss());
  await button("Use prepared environment").click();
  await execute("print('RETAINED', sentinel)", "RETAINED 42");
  async function adopt() {
    await expect(button("Use prepared environment")).toBeEnabled({
      timeout: 15000,
    });
    page.once("dialog", (d) => {
      expect(d.message()).toContain("snapshot stays the same");
      return d.accept();
    });
    await button("Use prepared environment").click();
    await expect(run).toBeEnabled({ timeout: 120000 });
    expect(await epoch()).toBe(originalEpoch);
  }
  await adopt();
  await execute(
    "import humanize\nprint('NEW', humanize.__version__, 'sentinel' in globals())\nprint('TOTAL', spark.sql('SELECT sum(amount) AS total FROM public.orders').first().total)",
    "NEW 4.13.0 False",
  );
  await expect(output).toContainText("TOTAL 19.75");
  checks.push(
    "package_add_import_explicit_adoption_discards_variables_preserves_epoch",
  );
  await page.getByLabel("Package requirement").fill("humanize==4.12.3");
  await button("Add package").click();
  await completed();
  await execute("print('STILL', humanize.__version__)", "STILL 4.13.0");
  await adopt();
  await execute(
    "import humanize\nprint('VERSION', humanize.__version__)",
    "VERSION 4.12.3",
  );
  checks.push("old_and_new_kernel_package_versions_are_isolated");
  await page.getByLabel("Package requirement").fill("humanize==9999.0.0");
  await button("Add package").click();
  await expect(panel).toContainText("Last environment operation: failed", {
    timeout: 120000,
  });
  expect((await cli("env", "status")).active_generation).toBe(previous);
  await expect(page.getByLabel("Package requirement")).toHaveValue(
    "humanize==9999.0.0",
  );
  await execute(
    "print('AFTER_FAILURE', humanize.__version__)",
    "AFTER_FAILURE 4.12.3",
  );
  checks.push(
    "failed_dependency_resolution_keeps_declarations_kernel_and_draft",
  );
  await page.getByLabel("Offline packages only").check();
  await button("Prepare environment").click();
  await completed();
  expect((await cli("env", "status")).operations[0].result.network).toBe(
    "offline",
  );
  expect(await epoch()).toBe(originalEpoch);
  checks.push("explicit_offline_preparation_keeps_running_epoch");
  const countBeforeTimeout = (await cli("env", "status")).operations.length;
  let interrupted = false;
  const loseReply = async (route) => {
    const body = route.request().postDataJSON();
    if (
      !interrupted &&
      body.action === "environment" &&
      body.command.action === "manage"
    ) {
      interrupted = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  };
  await page.route("**/api/workspace", loseReply);
  await button("Prepare environment").click();
  await completed();
  await page.unroute("**/api/workspace", loseReply);
  expect((await cli("env", "status")).operations.length).toBe(
    countBeforeTimeout + 1,
  );
  checks.push("lost_mutation_reply_recovers_by_key_without_resubmission");

  // Cancellation must not clear either the package draft or the notebook buffer.
  await code.fill("print('UNSAVED_BUFFER')");
  await button("Prepare environment").click();
  await expect(button("Cancel package operation")).toBeEnabled({
    timeout: 10000,
  });
  await button("Cancel package operation").click();
  await expect(panel).toContainText("Last environment operation: cancelled", {
    timeout: 30000,
  });
  expect((await cli("env", "status")).active_generation).toBe(previous);
  await expect(code).toContainText("UNSAVED_BUFFER");
  await expect(page.getByLabel("Package requirement")).toHaveValue(
    "humanize==9999.0.0",
  );
  checks.push("cancel_preserves_notebook_and_package_edits");
  const lock = path.join(project, "notebooks/environment/uv.lock");
  await rename(lock, lock + ".saved");
  await button("Refresh environment status").click();
  await expect(panel).toContainText("uv.lock is missing");
  await expect(button("Prepare environment")).toBeDisabled();
  await expect(button("Use prepared environment")).toBeDisabled();
  await rename(lock + ".saved", lock);
  await button("Refresh environment status").click();
  await expect(button("Prepare environment")).toBeEnabled();
  // External declaration edits between inspection and submission are fenced.
  const manifest = path.join(project, "notebooks/environment/pyproject.toml");
  let injected = false;
  await page.route("**/api/workspace", async (route) => {
    const body = route.request().postDataJSON();
    if (
      !injected &&
      body.action === "environment" &&
      body.command.action === "manage"
    ) {
      injected = true;
      await writeFile(manifest, (await readFile(manifest, "utf8")) + "\n");
    }
    await route.continue().catch(() => {});
  });
  await button("Prepare environment").click();
  await expect(
    panel.getByRole("alert").filter({ hasText: /changed|differ/ }),
  ).toBeVisible({ timeout: 15000 });
  await page.unroute("**/api/workspace");
  expect((await cli("env", "status")).active_generation).toBe(previous);
  await expect(code).toContainText("UNSAVED_BUFFER");
  await button("Refresh environment status").click();
  await button("Prepare environment").click();
  await completed();
  checks.push("missing_lock_and_stale_revision_require_explicit_recovery");
  async function bytes(directory) {
    let size = 0;
    for (const name of await readdir(directory)) {
      const file = path.join(directory, name),
        info = await lstat(file);
      size += info.isDirectory() ? await bytes(file) : info.size;
    }
    return size;
  }
  expect(
    await bytes(path.join(data, "notebook-environment-cache")),
  ).toBeLessThan(1024 ** 3);
  for (const operation of await readdir(
    path.join(data, "notebook-environment-work"),
  )) {
    const scratch = path.join(
      data,
      "notebook-environment-work",
      operation,
      "documents",
      "install-tmp",
    );
    await expect(lstat(scratch)).rejects.toThrow();
  }
  checks.push(
    "repeated_preparation_bounds_install_cache_and_cleans_cancelled_scratch",
  );
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
  await execute("%pip install example", "supabricks env");
  checks.push("unsupported_package_magic_shows_managed_package_guidance");
  await execute(
    "import humanize\nprint('SAVED_VERSION', humanize.__version__)",
    "SAVED_VERSION 4.12.3",
  );
  await page.getByLabel("Include outputs when saving or downloading").check();
  page.once("dialog", (d) => d.accept("environment.ipynb"));
  await button("Save a copy").click();
  await expect(
    page.getByRole("heading", { name: "environment.ipynb", exact: true }),
  ).toBeVisible();
  const saved = JSON.parse(
    await readFile(path.join(project, "notebooks/environment.ipynb"), "utf8"),
  );
  expect(saved.metadata.supabricks.binding.epoch_id).toBe(originalEpoch);
  expect(saved.cells[0].metadata.supabricks_outputs.environment.id).toBe(
    saved.metadata.supabricks.binding.environment.id,
  );
  await button("Stop kernel").click();
  await expect(run).toBeDisabled();
  await page.reload();
  await button("Notebooks").click();
  await page
    .getByRole("button", { name: "environment.ipynb", exact: true })
    .click();
  await expect(output).toContainText("SAVED_VERSION 4.12.3");
  await expect(run).toBeDisabled();
  await expect(page.getByText(/Most recent execution snapshot:/)).toContainText(
    saved.metadata.supabricks.binding.environment.id,
  );
  checks.push("saved_output_environment_provenance_reopens_without_execution");
  await cli("env", "gc");
  const second = path.join(root, "second");
  await mkdir(second);
  await cliAt(second, "init", "second-environment-project");
  const launch = await cliAt(second, "console", "--no-open");
  const otherContext = await browser.newContext();
  await otherContext.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  const other = await otherContext.newPage();
  await other.goto(launch.url);
  await other.getByRole("button", { name: "Notebooks", exact: true }).click();
  await other.locator(".environment-panel summary").first().click();
  await expect(other.locator(".environment-panel")).toContainText(
    "Start kernel prepares the bundled base",
  );
  expect((await cliAt(second, "env", "status")).operations).toHaveLength(0);
  await other
    .getByRole("button", { name: "Initialize environment", exact: true })
    .click();
  await expect(other.locator(".environment-panel")).toContainText(
    "Last environment operation: ready",
    { timeout: 15000 },
  );
  await other
    .getByRole("button", { name: "Prepare environment", exact: true })
    .click();
  await expect(other.locator(".environment-panel")).toContainText(
    "Ready for next start",
    { timeout: 120000 },
  );
  const secondStatus = await cliAt(second, "env", "status");
  expect(secondStatus.environments[0].packages.humanize).toBeUndefined();
  expect(secondStatus.active_generation).not.toBe(previous);
  checks.push("two_project_environment_and_operation_isolation");
  const archive = path.join(root, "environment.zip");
  await cli("env", "export-bundle", archive, "--offline", "--wait");
  const firstAfterExport = (await cli("env", "status")).active_generation;
  await other
    .getByText("Import environment and diagnostics", { exact: true })
    .click();
  await other.getByLabel("Offline bundle path").fill(archive);
  await other
    .getByRole("button", { name: "Import offline bundle", exact: true })
    .click();
  await expect
    .poll(
      async () => (await cliAt(second, "env", "status")).active_generation,
      { timeout: 180000 },
    )
    .not.toBe(secondStatus.active_generation);
  await expect(other.locator(".environment-panel")).toContainText(
    "humanize==4.12.3",
  );
  expect((await cli("env", "status")).active_generation).toBe(firstAfterExport);
  checks.push("offline_bundle_import_prepares_only_the_bound_project");
  await expect(
    other.getByRole("button", { name: "Remove humanize", exact: true }),
  ).toBeEnabled();
  await other
    .getByRole("button", { name: "Remove humanize", exact: true })
    .click();
  await expect(other.locator(".environment-panel")).toContainText(
    "humanize: 4.12.3 → removed",
    { timeout: 180000 },
  );
  expect((await cli("env", "status")).active_generation).toBe(firstAfterExport);
  checks.push("package_removal_only_changes_the_prepared_project_environment");

  await otherContext.close();
  // Older runtime responses must retain baseline notebooks without new commands.
  const environmentRequests = [];
  const observe = (req) => {
    if (
      req.url().endsWith("/api/workspace") &&
      req.postDataJSON()?.action === "environment"
    )
      environmentRequests.push(req.url());
  };
  await page.route("**/api/overview", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    delete json.capabilities.notebook_environment_controls;
    await route.fulfill({ response, json });
  });
  await page.reload();
  page.on("request", observe);
  await button("Notebooks").click();
  await expect(page.locator(".environment-panel")).toHaveCount(0);
  await expect(button("Start kernel")).toBeVisible();
  await page
    .getByRole("button", { name: "environment.ipynb", exact: true })
    .click();
  await expect(output).toContainText("SAVED_VERSION 4.12.3");
  await button("＋ New notebook").click();
  await page.getByLabel("Notebook branch").selectOption({ label: "main" });
  await button("Start kernel").click();
  await expect(run).toBeEnabled({ timeout: 120000 });
  await execute(
    "print('BASELINE', spark.sql('SELECT count(*) AS n FROM public.orders').first().n)",
    "BASELINE 2",
  );
  expect(environmentRequests).toEqual([]);
  page.off("request", observe);
  checks.push(
    "older_runtime_capability_preserves_baseline_without_package_requests",
  );
}
