import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
const config = JSON.parse(
  fs.readFileSync(process.argv[process.argv.indexOf("--config") + 1]),
);
const checks = [];
const push = checks.push.bind(checks);
checks.push = (...items) => {
  for (const item of items) console.log("PASS " + item);
  return push(...items);
};
const browser = await chromium.launch({ headless: true });
const aliceContext = await browser.newContext({ ignoreHTTPSErrors: true });
const bobContext = await browser.newContext({ ignoreHTTPSErrors: true });
const alice = await aliceContext.newPage(),
  bob = await bobContext.newPage();
const errors = [];
for (const p of [alice, bob]) p.on("pageerror", (e) => errors.push(String(e)));
async function command(page, button, action) {
  const promise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/auth/v1/control") &&
      JSON.parse(r.request().postData()).action === "workspace" &&
      JSON.parse(r.request().postData()).command.action === action,
  );
  await page.getByRole("button", { name: button, exact: true }).click();
  const r = await promise;
  const value = await r.json();
  if (!r.ok()) throw new Error(button + ": " + JSON.stringify(value));
  return value;
}
async function controlButton(page, button, action) {
  const promise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/auth/v1/control") &&
      JSON.parse(r.request().postData()).action === action &&
      (action !== "runtime" ||
        JSON.parse(r.request().postData()).command.action === "start"),
  );
  await page.getByRole("button", { name: button, exact: true }).click();
  const r = await promise;
  const value = await r.json();
  if (!r.ok()) throw new Error(button + ": " + JSON.stringify(value));
  return value;
}
async function tab(page, name) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name, exact: true, level: 1 }),
  ).toBeVisible();
}
async function login(page, username) {
  await page.goto(config.origin + "/auth/v1/console");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await Promise.race([
    page.locator("#username").waitFor({ state: "visible", timeout: 20000 }),
    page
      .getByRole("button", { name: "Sign out", exact: true })
      .waitFor({ state: "visible", timeout: 20000 }),
  ]);
  if (await page.locator("#username").isVisible()) {
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(config.password);
    await page.locator("#kc-login").click();
  }
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible({ timeout: 20000 });
}
async function waitReady(page) {
  await expect(
    page.getByRole("button", { name: "Refresh permissions", exact: true }),
  ).toBeEnabled();
}
async function grant(page, principal, branch, cap) {
  await page.getByLabel("Subject ID", { exact: true }).fill(principal);
  await page.getByLabel("Branch ID", { exact: true }).fill(branch);
  await page.getByLabel("Capability", { exact: true }).selectOption(cap);
  await command(page, "Grant data capability", "policy");
  await waitReady(page);
}
try {
  await login(alice, "alice");
  await login(bob, "bob");
  await expect(
    bob.getByText("No projects available", { exact: true }),
  ).toBeVisible();
  for (const context of [aliceContext, bobContext]) {
    const cookies = await context.cookies(config.origin + "/auth/v1/context");
    expect(
      cookies
        .filter((c) => c.name.startsWith("sb_"))
        .every(
          (c) =>
            c.httpOnly &&
            c.sameSite === "Lax" &&
            (!config.origin.startsWith("https:") || c.secure),
        ),
    ).toBe(true);
  }
  expect(
    await bob.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  expect(
    (await bobContext.request.get(config.origin + "/api/session")).status(),
  ).toBe(403);
  checks.push("independent_oidc_browser_sessions");
  await tab(alice, "Administration");
  await expect(alice.getByLabel("Principal", { exact: true })).toBeEnabled();
  await expect(
    alice
      .getByLabel("Principal", { exact: true })
      .locator("option", { hasText: "alice" }),
  ).toHaveCount(1);
  await expect(
    alice
      .getByLabel("Principal", { exact: true })
      .locator("option", { hasText: "bob" }),
  ).toHaveCount(1);
  const options = await alice
    .getByLabel("Principal", { exact: true })
    .locator("option")
    .evaluateAll((items) =>
      items.map((o) => ({ id: o.value, label: o.textContent })),
    );
  const aliceId = options.find((o) => o.label.startsWith("alice")).id,
    bobId = options.find((o) => o.label.startsWith("bob")).id;
  for (const id of [aliceId, bobId]) {
    await alice.getByLabel("Principal", { exact: true }).selectOption(id);
    await command(alice, "Enroll catalog identity", "catalog");
  }
  await command(alice, "Review current catalog grants", "catalog");
  await command(alice, "Apply reviewed sharing", "catalog");
  await alice.getByLabel("New project name").fill("browser-project");
  const created = await command(alice, "Create project", "create_project");
  const deployment = created.project.deployment_id,
    branch = created.branch;
  await expect(
    bob.getByText("No projects available", { exact: true }),
  ).toBeVisible();
  checks.push("browser_project_creation_and_denied_discovery");
  await tab(alice, "Access");
  await waitReady(alice);
  for (const cap of [
    "read",
    "write",
    "receive",
    "ddl",
    "copy_source",
    "share",
    "manage_sync",
    "read_sync",
  ])
    await grant(alice, aliceId, branch, cap);
  // Fixture is a portable integer-only package; all admission and import occurs through the browser.
  const copy = "42\n";
  const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
  const id = crypto.randomUUID();
  const content = {
    format_version: 1,
    profile: "postgres_tables",
    postgres_major: 17,
    locale: {
      provider: "c",
      collate: "C",
      ctype: "C",
      locale: null,
      version: null,
    },
    source: {
      definition_id: id,
      source_sha256: "0".repeat(64),
      runtime_project_id: id,
      branch_id: id,
      branch_revision: 1,
      snapshot: "1:2:",
    },
    tables: [
      {
        table: { schema: "public", name: "example" },
        columns: [
          { name: "id", data_type: { kind: "integer" }, nullable: false },
        ],
        constraints: [
          { name: "example_pkey", kind: "primary_key", columns: ["id"] },
        ],
        rows: 1,
        data_sha256: hash(copy),
        copy_text: copy,
      },
    ],
  };
  const archive = JSON.stringify({
    content,
    content_sha256: hash(JSON.stringify(content)),
  });
  await tab(alice, "Data");
  await waitReady(alice);
  // Native creation is asynchronous; wait for branch observation via the normal Refresh UI.
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await alice
      .getByRole("button", { name: "Refresh permissions", exact: true })
      .click();
    await waitReady(alice);
    if (
      await alice
        .getByLabel("Branch", { exact: true })
        .locator("option")
        .count()
    )
      break;
    await alice.waitForTimeout(1000);
  }
  await expect(
    alice.getByLabel("Branch", { exact: true }).locator("option").first(),
  ).toContainText("running", { timeout: 90000 });
  const imported = alice.waitForResponse(
    (r) =>
      r.url().endsWith("/auth/v1/control") &&
      r.request().postData()?.includes("archive_hex"),
  );
  await alice.getByLabel("Import data package").setInputFiles({
    name: "example.sbdata",
    mimeType: "application/json",
    buffer: Buffer.from(archive),
  });
  const ir = await imported;
  expect(ir.status()).toBe(200);
  await waitReady(alice);
  checks.push("browser_governed_package_ingestion");

  await tab(alice, "Administration");
  await alice.getByLabel("New group or service label").fill("sync-service");
  const service = await command(alice, "Create service principal", "service");
  await tab(alice, "Access");
  await waitReady(alice);
  await alice
    .getByLabel("Subject ID", { exact: true })
    .fill(service.principal_id);
  await alice.getByLabel("Project role").selectOption("viewer");
  await controlButton(alice, "Grant project role", "set_role");
  for (const cap of ["read", "execute_sync"])
    await grant(alice, service.principal_id, branch, cap);
  await tab(alice, "Data");
  await waitReady(alice);
  const area = alice.getByRole("region", { name: "Managed analytical sync" });
  await area.getByLabel("Sync mode").selectOption("continuous");
  await area.getByLabel("Sync service principal").fill(service.principal_id);
  await expect(
    area.getByRole("button", { name: "Create sync policy", exact: true }),
  ).toBeDisabled();
  await area.getByRole("checkbox").check();
  const syncCommand = async (button, kind) => {
    const response = alice.waitForResponse((r) => {
      if (!r.url().endsWith("/auth/v1/control")) return false;
      const body = r.request().postDataJSON();
      return (
        body?.command?.action === "sync" &&
        body.command.request.command.kind === kind
      );
    });
    await area.getByRole("button", { name: button, exact: true }).click();
    const r = await response;
    const v = await r.json();
    expect(r.ok(), JSON.stringify(v)).toBe(true);
    return v;
  };
  const policy = await syncCommand("Create sync policy", "create");
  await expect(area.getByText("healthy", { exact: true })).toBeVisible({
    timeout: 180000,
  });
  checks.push(
    "governed_continuous_browser_admission_under_explicit_service_grants",
  );
  const epoch = await area
    .locator("dt")
    .filter({ hasText: "Published epoch" })
    .locator("+ dd")
    .innerText();
  await tab(alice, "SQL");
  await waitReady(alice);
  await alice
    .getByLabel("SQL source")
    .fill("INSERT INTO public.example VALUES (43)");
  await alice.getByLabel("Data capability").selectOption("write");
  await controlButton(alice, "Run PostgreSQL", "data");
  await waitReady(alice);
  await alice.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(alice, "alice");
  await alice
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption(deployment);
  await tab(alice, "Data");
  await waitReady(alice);
  await expect(
    area.locator("dt").filter({ hasText: "Published epoch" }).locator("+ dd"),
  ).not.toHaveText(epoch, { timeout: 120000 });
  await expect(area.getByText("healthy", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  await expect(
    bob.getByText("No projects available", { exact: true }),
  ).toBeVisible();
  checks.push(
    "manager_logout_keeps_service_progress_and_denied_browser_sees_no_project",
  );
  await area
    .getByRole("button", {
      name: "Select epoch for sharing review",
      exact: true,
    })
    .first()
    .click();
  const preview = await command(alice, "Review publication", "publication");
  expect(preview.retention.copies).toBe(true);
  expect(JSON.stringify(preview)).not.toContain("file://");
  const shared = await command(
    alice,
    "Publish reviewed snapshot",
    "publication",
  );
  expect(shared.publication.epoch_id).toBeTruthy();
  checks.push(
    "incremental_result_handoff_reviews_an_immutable_catalog_view_without_exposing_paths",
  );
  await syncCommand("Pause sync", "pause");
  await expect(
    area.getByRole("button", { name: "Resume sync", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  const review = await syncCommand("Review full resync", "review_resync");
  expect(review.requires_full_bootstrap).toBe(true);
  await syncCommand("Approve resync and pause", "resync");
  // Polling status is read-only; explicit Resume remains the only enrollment action.
  await expect
    .poll(
      async () => {
        const response = await aliceContext.request.get(
          config.origin + "/auth/v1/context",
        );
        const ctx = await response.json();
        const r = await aliceContext.request.post(
          config.origin + "/auth/v1/control",
          {
            headers: { "X-CSRF-Token": ctx.csrf, Origin: config.origin },
            data: {
              action: "workspace",
              command: {
                action: "sync",
                deployment,
                request: {
                  command: { kind: "get", id: policy.id },
                  expected_policy: null,
                  service_principal: null,
                },
              },
            },
          },
        );
        const status = await r.json();
        expect(r.ok(), JSON.stringify(status)).toBe(true);
        return status.capture_status?.cleanup_complete;
      },
      { timeout: 60000 },
    )
    .toBe(true);
  await syncCommand("Resume sync", "resume");
  await expect(area.getByText("healthy", { exact: true })).toBeVisible({
    timeout: 180000,
  });
  checks.push(
    "governed_reviewed_resync_waits_for_cleanup_then_bootstraps_a_new_generation",
  );
  await syncCommand("Pause sync", "pause");
  await expect(
    area.getByRole("button", { name: "Resume sync", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await area.getByLabel("Sync mode").selectOption("triggered");
  await syncCommand("Save sync settings", "update");
  await syncCommand("Resume sync", "resume");
  const triggered = await syncCommand("Run sync now", "run_now");
  await expect(
    area.getByRole("row").filter({ hasText: triggered.id }),
  ).toContainText("succeeded", { timeout: 120000 });
  checks.push("governed_triggered_manual_catchup_after_reviewed_mode_change");
  await tab(alice, "Administration");
  await alice
    .getByLabel("Principal", { exact: true })
    .selectOption(service.principal_id);
  await command(alice, "Revoke sessions", "revoke");
  await tab(alice, "Data");
  await waitReady(alice);
  await expect(area.getByText("blocked", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    area.getByRole("button", { name: "Resume sync", exact: true }),
  ).toBeDisabled();
  await expect(
    area.getByRole("button", { name: "Review full resync", exact: true }),
  ).toBeDisabled();
  checks.push("service_revocation_blocks_the_governed_sync_surface");
  expect(errors).toEqual([]);
  fs.writeFileSync(
    config.report,
    JSON.stringify({ status: "PASS", checks }, null, 2) + "\n",
  );
} catch (e) {
  await alice.screenshot({
    path: config.root + "/sync-failure.png",
    fullPage: true,
  });
  fs.writeFileSync(
    config.report,
    JSON.stringify(
      { status: "FAIL", checks, error: String(e), browser_errors: errors },
      null,
      2,
    ) + "\n",
  );
  throw e;
} finally {
  await browser.close();
}
