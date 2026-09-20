import { randomUUID } from "node:crypto";
import { expect, chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  copyFile,
  access,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const exec = promisify(execFile);

// Runs against the real authenticated browser bridge, never a mocked API.
export async function qualifyProjectCreation({
  context,
  launchHome,
  cliAt,
  checks,
  screenshot,
}) {
  const page = await context.newPage();
  const errors = [];
  async function post(command) {
    const origin = new URL(page.url()).origin;
    const session = await context.request.get(origin + "/api/session", {
      headers: { "X-Supabricks-Console": "1" },
    });
    return context.request.post(origin + "/api/workspace", {
      headers: {
        Origin: origin,
        "X-Supabricks-Console": "1",
        "X-Supabricks-CSRF": (await session.json()).csrf,
      },
      data: command,
    });
  }
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const home = await launchHome();
    await page.goto(home.url);
    await expect(
      page.getByRole("heading", { name: "Open or create a project." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Database workspace", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Notebooks", exact: true }),
    ).toHaveCount(0);
    for (const command of [
      { action: "create_database", name: "unscoped", key: "unscoped" },
      { action: "saved_list" },
      { action: "notebook_files", command: { action: "list" } },
      { action: "analytics", command: { action: "list" } },
    ])
      expect((await post(command)).status()).toBe(409);
    checks.push(
      "console home refuses database, notebook, saved-query and analytics operations until a project is opened",
    );
    await page
      .getByRole("button", { name: "+ New project", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Create a project" });
    await dialog.getByLabel("Project name", { exact: true }).fill("../invalid");
    await dialog.getByRole("button", { name: "Create and open" }).click();
    expect(
      await dialog
        .getByLabel("Project name", { exact: true })
        .evaluate((input) => input.checkValidity()),
    ).toBe(false);
    await dialog
      .getByLabel("Project name", { exact: true })
      .fill("Browser-App");
    if (screenshot) await page.screenshot({ path: screenshot });
    let request,
      dropped = false;
    const loseReply = async (route) => {
      const payload = route.request().postDataJSON();
      if (payload?.command?.action === "create" && !dropped) {
        request = payload.command;
        await route.fetch(); // Admission succeeds; the browser never sees the reply.
        dropped = true;
        await route.abort();
      } else await route.continue();
    };
    await page.route("**/api/workspace", loseReply);
    await dialog.getByRole("button", { name: "Create and open" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(dropped).toBe(true);
    await page.unroute("**/api/workspace", loseReply);
    await page.reload();
    await page
      .getByRole("button", { name: "+ New project", exact: true })
      .first()
      .click();
    await expect(
      dialog.getByLabel("Project name", { exact: true }),
    ).toHaveValue("browser-app");
    await dialog.getByRole("button", { name: "Continue setup" }).click();
    await expect
      .poll(() => new URL(page.url()).origin, { timeout: 120000 })
      .not.toBe(new URL(home.url).origin);
    await expect(page.locator(".project-card strong")).toHaveText(
      "browser-app",
    );
    const overview = await page.evaluate(async () =>
      (
        await fetch("/api/overview", {
          headers: { "X-Supabricks-Console": "1" },
        })
      ).json(),
    );
    expect(overview.branches.map((b) => b.name)).toEqual(["main"]);
    expect(
      (await cliAt(overview.worktree, "sql", "--sql", "SELECT 42 AS answer"))
        .rows,
    ).toEqual([["42"]]);
    expect(
      (await cliAt(overview.worktree, "project", "installed")).active_revision,
    ).toBeTruthy();
    const selection = (await cliAt(overview.worktree, "branch", "list"))
      .branches;
    expect(selection).toHaveLength(1);
    checks.push(
      "browser project creation survives a lost admission response and page reload, provisions one main database and selects it automatically",
    );
    await page
      .getByRole("button", { name: "+ New project", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Your projects" })
        .getByText("browser-app", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close project dialog" }).click();
    // Reopen through the launcher; the project remains discoverable after leaving it.
    await page.goto((await launchHome()).url);
    await page
      .getByRole("button", { name: "+ New project", exact: true })
      .first()
      .click();
    await dialog.getByRole("button", { name: "Open browser-app" }).click();
    await expect(page.locator(".project-card strong")).toHaveText(
      "browser-app",
    );
    expect(
      (await cliAt(overview.worktree, "database", "list")).branches,
    ).toHaveLength(1);
    checks.push(
      "console home and created project both list the saved project and reopen its existing database",
    );
    // Server checks still apply when bypassing browser input validation and CSRF.
    const session = await page.evaluate(async () =>
      (
        await fetch("/api/session", {
          headers: { "X-Supabricks-Console": "1" },
        })
      ).json(),
    );
    const origin = new URL(page.url()).origin;
    const noCsrf = await context.request.post(origin + "/api/workspace", {
      headers: { Origin: origin, "X-Supabricks-Console": "1" },
      data: {
        action: "project",
        source: { kind: "current" },
        command: request,
      },
    });
    expect(noCsrf.status()).toBe(403);
    const invalid = await context.request.post(origin + "/api/workspace", {
      headers: {
        Origin: origin,
        "X-Supabricks-Console": "1",
        "X-Supabricks-CSRF": session.csrf,
      },
      data: {
        action: "project",
        source: { kind: "current" },
        command: { ...request, name: "../escape" },
      },
    });
    expect(invalid.ok()).toBe(false);
    const target = {
      branch: overview.branches[0].id,
      revision: overview.branches[0].revision,
    };
    const savedId = randomUUID();
    expect(
      (
        await post({
          action: "saved_put",
          id: savedId,
          expected_revision: 0,
          target,
          title: "Private query",
          sql: "SELECT 1",
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await post({
          action: "notebook_files",
          command: {
            action: "save",
            path: "private.ipynb",
            expected_revision: null,
            document: {
              nbformat: 4,
              nbformat_minor: 5,
              metadata: {},
              cells: [],
            },
          },
        })
      ).ok(),
    ).toBe(true);
    await page
      .getByRole("button", { name: "+ New project", exact: true })
      .click();
    await dialog
      .getByLabel("Project name", { exact: true })
      .fill("second-project");
    await dialog.getByRole("button", { name: "Create and open" }).click();
    await expect(page.locator(".project-card strong")).toHaveText(
      "second-project",
      { timeout: 120000 },
    );
    const second = await page.evaluate(async () =>
      (
        await fetch("/api/overview", {
          headers: { "X-Supabricks-Console": "1" },
        })
      ).json(),
    );
    expect(second.project.id).not.toBe(overview.project.id);
    expect(second.branches).toHaveLength(1);
    expect(second.branches[0].id).not.toBe(target.branch);
    expect(
      (
        await (
          await post({ action: "notebook_files", command: { action: "list" } })
        ).json()
      ).value.files,
    ).toEqual([]);
    for (const command of [
      { action: "connect", target },
      { action: "saved_get", id: savedId },
      {
        action: "saved_put",
        id: randomUUID(),
        expected_revision: 0,
        target,
        title: "Wrong project",
        sql: "SELECT 1",
      },
      {
        action: "notebook_files",
        command: { action: "get", path: "private.ipynb" },
      },
      {
        action: "analytics",
        command: { action: "open", target, key: "wrong-project" },
      },
    ])
      expect((await post(command)).ok()).toBe(false);
    checks.push(
      "two browser-created projects isolate databases, saved queries, notebook files and Spark session targets",
    );
    expect(errors).toEqual([]);
    checks.push(
      "project creation enforces server name validation and authenticated CSRF protection without browser errors",
    );
  } finally {
    await page.close();
  }
}

async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .reduce((all, v, i, a) => (i % 2 ? all : [...all, [v, a[i + 1]]]), []),
  );
  if (
    !args["--binary"] ||
    !args["--bundle"] ||
    !args["--helpers"] ||
    !args["--report"]
  )
    throw new Error("Supply --binary, --bundle, --helpers and --report");
  const root = await mkdtemp("/tmp/sb-create-");
  const data = join(root, "data"),
    cwd = join(root, "empty");
  await mkdir(cwd);
  // Copy the binary so other builds cannot overwrite a running daemon.
  const binary = join(root, "supabricks");
  await copyFile(resolve(args["--binary"]), binary);
  const env = { ...process.env, SUPABRICKS_DATA_DIR: data };
  for (const key of Object.keys(env))
    if (/^(PG|AWS_|PC_|OTEL_)/.test(key) || /_PROXY$/i.test(key))
      delete env[key];
  const cli = async (...command) =>
    JSON.parse(
      (
        await exec(binary, command, {
          env,
          cwd,
          timeout: 180000,
          maxBuffer: 2 * 1024 * 1024,
        })
      ).stdout,
    );
  const report = { status: "failed", checks: [] };
  let browser;
  try {
    await cli(
      "up",
      "--bundle",
      resolve(args["--bundle"]),
      "--helpers",
      resolve(args["--helpers"]),
    );
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    await qualifyProjectCreation({
      context,
      launchHome: () => cli("console", "--no-open"),
      cliAt: (at, ...command) => cli(...command, "--project", at),
      checks: report.checks,
      screenshot: args["--screenshot"],
    });
    await expect(access(join(cwd, "supabricks.toml"))).rejects.toThrow();
    report.status = "passed";
  } catch (error) {
    report.error = String(error.message).replace(
      /#launch=[a-f0-9]+/g,
      "#launch=REDACTED",
    );
    process.exitCode = 1;
  } finally {
    await browser?.close();
    try {
      await cli("down");
    } catch {
      report.status = "failed";
      report.cleanup_failed = true;
      process.exitCode = 1;
    }
    await writeFile(
      resolve(args["--report"]),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
    if (report.status === "passed") await rm(root, { recursive: true });
    else console.log("Private fixture retained:", root);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
