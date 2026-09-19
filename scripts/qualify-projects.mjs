import { chromium } from "@playwright/test";
import { mkdtemp, mkdir, realpath, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { qualifyProjects } from "./projects.mjs";
const exec = promisify(execFile);
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, i, s) => {
    if (i % 2 === 0) a.push([x, s[i + 1]]);
    return a;
  }, []),
);
if (!args["--binary"] || !args["--report"])
  throw new Error("Supply --binary and --report");
const binary = resolve(args["--binary"]),
  root = await realpath(await mkdtemp("/tmp/sb-pk06-")),
  project = root + "/host";
await mkdir(project);
const report = { status: "running", checks: [], errors: [], workspace: root };
const push = report.checks.push.bind(report.checks);
report.checks.push = (...items) => {
  for (const item of items) console.log(item);
  return push(...items);
};
let browser, page;
async function cliAt(at, ...command) {
  try {
    return JSON.parse(
      (
        await exec(
          binary,
          [...command, "--project", at, "--data-dir", root + "/data"],
          { timeout: 180000, maxBuffer: 2 * 1024 * 1024 },
        )
      ).stdout,
    );
  } catch (e) {
    throw new Error(
      `Fixture ${command[0]} failed: ${String(e.stderr ?? e.message).slice(-1000)}`,
    );
  }
}
const cli = (...args) => cliAt(project, ...args);
try {
  await cli("init", "packaging-host");
  if (args["--bundle"])
    await cli(
      "up",
      "--bundle",
      resolve(args["--bundle"]),
      "--helpers",
      resolve(args["--helpers"]),
    );
  if (args["--python"])
    await cli(
      "analytics",
      "configure",
      "--python",
      resolve(args["--python"]),
      "--worker",
      resolve(args["--worker"]),
    );
  const launch = await cli("console", "--no-open");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(launch.url);
  await qualifyProjects({
    page,
    context,
    cliAt,
    cli,
    root,
    binary,
    worker: args["--worker"],
    checks: report.checks,
  });
  if (report.errors.length) throw new Error("Browser errors");
  if (args["--screenshot"]) {
    await page
      .getByRole("button", { name: "Project packages", exact: true })
      .click();
    await page.screenshot({
      path: resolve(args["--screenshot"]),
      fullPage: true,
    });
  }
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = String(e.message)
    .replace(/#launch=[a-f0-9]+/g, "#launch=REDACTED")
    .slice(-3500);
  process.exitCode = 1;
  if (page) {
    report.notices = await page
      .locator(".notice:visible")
      .allTextContents()
      .catch(() => []);
    await page
      .screenshot({ path: resolve(args["--report"]) + ".png", fullPage: true })
      .catch(() => {});
  }
} finally {
  await browser?.close();
  try {
    await cli("down");
  } catch {
    report.cleanup = "failed";
    process.exitCode = 1;
  }
  await writeFile(
    resolve(args["--report"]),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
  if (report.status === "passed" && !report.cleanup)
    await rm(root, { recursive: true });
}
