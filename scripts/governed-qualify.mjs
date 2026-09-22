import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
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
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(config.password);
  await page.locator("#kc-login").click();
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
  for (const cap of ["read", "receive", "ddl", "copy_source", "share"])
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
        constraints: [],
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
  await alice
    .getByRole("button", { name: "Prepare snapshot", exact: true })
    .click();
  await expect(
    alice.getByRole("button", {
      name: "Publish reviewed snapshot",
      exact: true,
    }),
  ).toBeVisible({ timeout: 150000 });
  const published = await command(
    alice,
    "Publish reviewed snapshot",
    "publication",
  );
  const pub = published.publication;
  expect(pub.id).toBeTruthy();
  // Poll through publication resolution using the browser's refresh UI below.
  checks.push("browser_reviewed_snapshot_publication");
  await tab(alice, "Administration");
  await expect(alice.getByLabel("Principal", { exact: true })).toBeEnabled();
  await alice.getByLabel("Principal", { exact: true }).selectOption(bobId);
  await alice.getByLabel("Publication ID", { exact: true }).fill(pub.id);
  await alice.getByLabel("Publication revision", { exact: true }).fill("1");
  await alice
    .getByLabel("Table IDs (comma separated)")
    .fill(pub.tables.map((t) => t.id).join(","));
  // The durable publication worker finishes before grant planning can succeed.
  let plan;
  for (let i = 0; i < 30; i++) {
    try {
      plan = await command(alice, "Review sharing plan", "catalog");
      break;
    } catch (e) {
      if (i === 29) throw e;
      await alice.waitForTimeout(1000);
    }
  }
  expect(plan.id).toBeTruthy();
  await command(alice, "Apply reviewed sharing", "catalog");
  await tab(alice, "Access");
  await waitReady(alice);
  await alice.getByLabel("Subject ID", { exact: true }).fill(bobId);
  await alice.getByLabel("Project role").selectOption("editor");
  await controlButton(alice, "Grant project role", "set_role");
  await waitReady(alice);
  await alice.getByLabel("Execution grant").selectOption("execute");
  await command(alice, "Grant execution permission", "policy");
  await expect(
    bob
      .getByLabel("Project", { exact: true })
      .locator("option", { hasText: "browser-project" }),
  ).toHaveCount(1, { timeout: 15000 });
  await bob.getByLabel("Project", { exact: true }).selectOption(deployment);
  await waitReady(bob);
  const discovered = await controlButton(bob, "Discover datasets", "catalog");
  expect(discovered.items.length).toBe(1);
  checks.push("reviewed_uc_sharing_and_filtered_discovery");
  await tab(bob, "SQL");
  await waitReady(bob);
  await bob
    .getByLabel("SQL source")
    .fill(
      "SELECT sum(id) AS total FROM delta.`/admission/data/" +
        pub.tables[0].id +
        "`",
    );
  const saved = await controlButton(bob, "Save source revision", "save_source");
  await controlButton(bob, "Choose readable datasets", "catalog");
  await bob.locator(".governed-datasets input[type=checkbox]").check();
  const launched = await controlButton(bob, "Run bound source", "runtime");
  expect(launched).toBeTruthy();
  await expect
    .poll(
      async () => {
        try {
          return JSON.parse(await bob.locator(".governed-result").textContent())
            .state;
        } catch {
          return "waiting";
        }
      },
      { timeout: 90000 },
    )
    .toBe("finished");
  const finished = JSON.parse(
    await bob.locator(".governed-result").textContent(),
  );
  expect(finished.result.exit_code).toBe(0);
  const output = finished.result.output
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((v) => v.type === "stream")
    .map((v) => v.content.text)
    .join("");
  expect(JSON.parse(output)).toEqual([{ total: 42 }]);
  checks.push("browser_bound_spark_query");
  // The browser uploads code only; server normalizes notebook outputs and binds its revision.
  await tab(bob, "Notebooks");
  await waitReady(bob);
  const isolation = config.installedQualification
    ? `
import os, socket, errno
from pathlib import Path
assert os.geteuid() == 1000
assert "CapEff:\t0000000000000000" in Path("/proc/self/status").read_text()
for forbidden in [${JSON.stringify(config.root)}, "/var/run/docker.sock", "/control.sock", "/root/.aws/credentials"]:
    assert not Path(forbidden).exists()
try:
    Path("/product/qualification-write").write_text("denied")
except OSError:
    pass
else:
    raise AssertionError("product mount was writable")
for address in [("1.1.1.1",443),("127.0.0.1",${new URL(config.origin).port || 443})]:
    try:
        socket.create_connection(address, timeout=1).close()
    except OSError:
        pass
    else:
        raise AssertionError("sandbox reached external/control network")
v=os.statvfs("/scratch")
assert v.f_blocks * v.f_frsize == 512 * 1024 * 1024
try:
    with open("/scratch/quota-test", "wb", buffering=0) as f:
        for _ in range(65): f.write(b"x" * (8*1024*1024))
except OSError as e:
    assert e.errno == errno.ENOSPC
else:
    raise AssertionError("scratch quota not enforced")
finally:
    Path("/scratch/quota-test").unlink(missing_ok=True)
`
    : "";
  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [
      {
        id: crypto.randomUUID(),
        cell_type: "code",
        metadata: {},
        source: [
          isolation +
            'import time\nassert spark.sql("SELECT sum(id) AS total FROM delta.`/admission/data/' +
            pub.tables[0].id +
            '`").collect()[0][0] == 42\nopen("/scratch/uc097-started", "w").write("ready")\ntime.sleep(120)',
        ],
        outputs: [
          {
            output_type: "stream",
            name: "stdout",
            text: "untrusted cached output",
          },
        ],
        execution_count: 7,
      },
    ],
  };
  await bob.getByLabel("Import notebook").setInputFiles({
    name: "slow.ipynb",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(notebook)),
  });
  await waitReady(bob);
  const slowSource = await controlButton(
    bob,
    "Save source revision",
    "save_source",
  );
  await tab(alice, "Administration");
  await alice
    .getByLabel("New group or service label")
    .fill("reporting-service");
  const service = await command(alice, "Create service principal", "service");
  const serviceId = service.principal_id;
  await alice.getByLabel("Principal", { exact: true }).selectOption(serviceId);
  await command(alice, "Enroll catalog identity", "catalog");
  await alice.getByLabel("Publication ID", { exact: true }).fill(pub.id);
  await alice.getByLabel("Publication revision", { exact: true }).fill("1");
  await alice
    .getByLabel("Table IDs (comma separated)")
    .fill(pub.tables.map((t) => t.id).join(","));
  await command(alice, "Review sharing plan", "catalog");
  await command(alice, "Apply reviewed sharing", "catalog");
  if (config.installedQualification) {
    await alice.getByLabel("Principal", { exact: true }).selectOption(aliceId);
    await command(alice, "Review sharing plan", "catalog");
    await command(alice, "Apply reviewed sharing", "catalog");
  }
  await tab(alice, "Access");
  await waitReady(alice);
  if (config.installedQualification) {
    await alice.getByLabel("Subject ID", { exact: true }).fill(aliceId);
    await alice.getByLabel("Execution grant").selectOption("execute");
    await command(alice, "Grant execution permission", "policy");
    await waitReady(alice);
  }
  await alice.getByLabel("Subject ID", { exact: true }).fill(serviceId);
  await alice.getByLabel("Project role").selectOption("viewer");
  await controlButton(alice, "Grant project role", "set_role");
  await waitReady(alice);
  await alice.getByLabel("Execution grant").selectOption("execute");
  await command(alice, "Grant execution permission", "policy");
  await waitReady(alice);
  await alice.getByLabel("Subject ID", { exact: true }).fill(bobId);
  await alice.getByLabel("Execution grant").selectOption("act_as");
  await alice.getByLabel("Effective service principal").fill(serviceId);
  await alice.getByLabel("Exact source revision").fill(slowSource.revision);
  await command(alice, "Grant execution permission", "policy");
  await controlButton(bob, "Refresh permissions", "policy");
  await waitReady(bob);
  await controlButton(bob, "Choose readable datasets", "catalog");
  await bob
    .getByLabel("Run as service principal (optional ID)")
    .fill(serviceId);
  await bob.locator(".governed-datasets input[type=checkbox]").check();
  let peer, peerPage;
  if (config.installedQualification) {
    // Project policy revisions deliberately fence every execution in that
    // project. The independent peer uses its own project and browser page.
    peerPage = await aliceContext.newPage();
    peerPage.on("pageerror", (e) => errors.push(String(e)));
    await peerPage.goto(config.origin + "/auth/v1/console");
    await peerPage.getByLabel("New project name").fill("independent-peer");
    await command(peerPage, "Create project", "create_project");
    await tab(peerPage, "Access");
    await waitReady(peerPage);
    await peerPage.getByLabel("Subject ID", { exact: true }).fill(aliceId);
    await peerPage.getByLabel("Execution grant").selectOption("execute");
    await command(peerPage, "Grant execution permission", "policy");
    await tab(peerPage, "Notebooks");
    await waitReady(alice);
    await peerPage.getByLabel("Import notebook").setInputFiles({
      name: "peer.ipynb",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(notebook)),
    });
    await controlButton(peerPage, "Save source revision", "save_source");
    await controlButton(peerPage, "Choose readable datasets", "catalog");
    await peerPage.locator(".governed-datasets input[type=checkbox]").check();
    peer = await controlButton(peerPage, "Run bound source", "runtime");
  }
  const slow = await controlButton(bob, "Run bound source", "runtime");
  const container = "sb-exec-" + slow.id;
  // Read-only qualification probe: prove the cell read its admitted data and
  // entered its long-running body before clicking revoke in Alice's browser.
  await expect
    .poll(
      async () => {
        try {
          const { stdout } = await exec(
            "docker",
            [
              "--host=unix:///var/run/docker.sock",
              "exec",
              container,
              "/tools/runsc",
              "--root=/work/runsc",
              "--network=none",
              "--platform=systrap",
              "--ignore-cgroups",
              "--sidecar-usage-policy=STRICT",
              "exec",
              "lease",
              "/bin/cat",
              "/scratch/uc097-started",
            ],
            { timeout: 5000 },
          );
          return stdout === "ready";
        } catch {
          return false;
        }
      },
      { timeout: 90000 },
    )
    .toBe(true);
  let envelope;
  const executionMemory = [];
  if (config.installedQualification) {
    for (const id of [peer.id, slow.id]) {
      const { stdout } = await exec("docker", ["inspect", "sb-exec-" + id], {
        timeout: 5000,
      });
      const info = JSON.parse(stdout)[0],
        limits = info.HostConfig;
      expect(limits.Memory).toBe(2147483648);
      expect(limits.MemorySwap).toBe(2147483648);
      expect(limits.NanoCpus).toBe(2000000000);
      expect(limits.PidsLimit).toBe(512);
      expect(limits.NetworkMode).toBe("none");
      expect(info.State.Running).toBe(true);
      const { stdout: memory } = await exec(
        "docker",
        [
          "exec",
          "sb-exec-" + id,
          "cat",
          "/sys/fs/cgroup/memory.current",
          "/sys/fs/cgroup/memory.peak",
        ],
        { timeout: 5000 },
      );
      const [current, peak] = memory.trim().split(/\s+/).map(Number);
      expect(current).toBeGreaterThan(0);
      expect(peak).toBeGreaterThanOrEqual(current);
      expect(peak).toBeLessThanOrEqual(limits.Memory);
      executionMemory.push({ current_bytes: current, peak_bytes: peak });
      envelope = {
        concurrent_executions: 2,
        memory_bytes: limits.Memory,
        cpu_count: 2,
        pids: limits.PidsLimit,
        scratch_bytes: 536870912,
      };
      await expect
        .poll(
          async () => {
            try {
              return (
                (
                  await exec(
                    "docker",
                    [
                      "exec",
                      "sb-exec-" + id,
                      "/tools/runsc",
                      "--root=/work/runsc",
                      "--network=none",
                      "--platform=systrap",
                      "--ignore-cgroups",
                      "--sidecar-usage-policy=STRICT",
                      "exec",
                      "lease",
                      "/bin/cat",
                      "/scratch/uc097-started",
                    ],
                    { timeout: 5000 },
                  )
                ).stdout === "ready"
              );
            } catch {
              return false;
            }
          },
          { timeout: 60000 },
        )
        .toBe(true);
    }
    const response = peerPage.waitForResponse(
      (r) =>
        r.url().endsWith("/auth/v1/control") &&
        JSON.parse(r.request().postData()).action === "runtime" &&
        JSON.parse(r.request().postData()).command.action === "start",
    );
    await peerPage
      .getByRole("button", { name: "Run bound source", exact: true })
      .click();
    expect((await response).status()).toBe(403);
    checks.push("concurrent_execution_limit_and_measured_cgroups");
    checks.push("sandbox_bypass_and_scratch_quota_denied");
    await tab(alice, "Access");
    await waitReady(alice);
    await alice.getByLabel("Subject ID", { exact: true }).fill(bobId);
    await alice.getByLabel("Execution grant").selectOption("act_as");
    await alice.getByLabel("Effective service principal").fill(serviceId);
    await alice.getByLabel("Exact source revision").fill(slowSource.revision);
  }
  await command(alice, "Revoke execution permission", "policy");
  const revokedAt = Date.now();
  checks.push("source_pinned_service_use_from_browser");
  await expect(bob.getByRole("alert")).toContainText("Action denied", {
    timeout: 60000,
  });
  expect(await bob.locator(".governed-result").count()).toBe(0);
  await expect
    .poll(
      async () => {
        try {
          const { stdout } = await exec(
            "docker",
            [
              "--host=unix:///var/run/docker.sock",
              "inspect",
              "--format",
              "{{.State.Running}}",
              container,
            ],
            { timeout: 5000 },
          );
          return stdout.trim() !== "true";
        } catch {
          return true;
        }
      },
      { timeout: 60000 },
    )
    .toBe(true);
  const closedMs = Date.now() - revokedAt;
  checks.push("revocation_during_bound_notebook_execution");
  if (config.installedQualification) {
    const { stdout } = await exec("docker", [
      "inspect",
      "--format",
      "{{.State.Running}}",
      "sb-exec-" + peer.id,
    ]);
    expect(stdout.trim()).toBe("true");
    await controlButton(peerPage, "Show executions", "executions");
    await controlButton(
      peerPage,
      "Terminate " + peer.id.slice(0, 8),
      "stop_execution",
    );
    checks.push("revocation_preserves_independent_peer_execution");
  }
  // Crafted requests never inherit the operator socket's authority.
  const forged = await bob.evaluate(async () => {
    const s = await (await fetch("/auth/v1/context")).json();
    return (
      await fetch("/auth/v1/control", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": s.csrf },
        body: JSON.stringify({
          action: "workspace",
          command: { action: "service", label: "unauthorized" },
        }),
      })
    ).status;
  });
  expect(forged).toBe(403);
  checks.push("crafted_administration_denied");
  await tab(alice, "Audit");
  async function auditCommand(button) {
    // Mount loads the first page automatically. Wait for it to render before
    // observing a manual request, and consume each rendered cursor in order.
    await expect(alice.getByRole("button", { name: button, exact: true })).toBeEnabled();
    const value = await command(alice, button, "audit");
    await expect(alice.locator("pre.governed-result")).toHaveText(JSON.stringify(value, null, 2));
    return value;
  }
  let auditPage = await auditCommand("Refresh audit");
  const events = [...auditPage.events];
  for (let i = 0; i < 10 && auditPage.events.length; i++) {
    auditPage = await auditCommand("Next audit page");
    events.push(...auditPage.events);
  }
  const audit = events.map((v) => v.event);
  const closed = audit.find(
    (v) =>
      v.action === "runtime.finish" &&
      v.target === slow.id &&
      v.outcome === "failed",
  );
  expect(closed.actor_id).toBe(bobId);
  expect(closed.effective_principal_id).toBe(serviceId);
  expect(closed.source_revision).toBe(slowSource.revision);
  expect(closed.datasets[0].publication).toBe(pub.id);
  expect(JSON.stringify(events)).not.toContain(config.password);
  expect(JSON.stringify(events)).not.toContain("time.sleep");
  checks.push("correlated_secret_free_audit");
  await tab(alice, "Administration");
  await expect(alice.getByLabel("Principal", { exact: true })).toBeEnabled();
  await alice.getByLabel("Principal", { exact: true }).selectOption(bobId);
  await command(alice, "Revoke sessions", "revoke");
  await expect(
    bob.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  checks.push("revoked_session_clears_browser_data");
  await alice.screenshot({
    path: config.root + "/administration.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  fs.writeFileSync(
    config.report,
    JSON.stringify(
      {
        status: "PASS",
        checks,
        revocation_observed_ms: closedMs,
        resource_envelope: envelope,
        execution_memory: executionMemory,
        tls: config.origin.startsWith("https:"),
      },
      null,
      2,
    ) + "\n",
  );
} catch (e) {
  await alice.screenshot({
    path: config.root + "/alice-failure.png",
    fullPage: true,
  });
  await bob.screenshot({
    path: config.root + "/bob-failure.png",
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
