import { expect } from "@playwright/test";
export async function qualifyAnalytics({
  page,
  context,
  browser,
  origin,
  cli,
  checks,
  launch,
}) {
  const record = (text) => {
    checks.push(text);
    console.log(JSON.stringify({ check: text }));
  };
  await cli("database", "create", "analytics-demo", "--wait");
  await page.reload();
  await page
    .getByRole("button", { name: "Database workspace", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Navigation branch" })
    .selectOption({ label: "analytics-demo · running" });
  await page.getByRole("button", { name: "Import file", exact: true }).click();
  await page.getByLabel("Choose data file").setInputFiles({
    name: "sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,amount\n1,10\n2,20\n"),
  });
  await expect(page.getByRole("table", { name: "Column mapping" })).toBeVisible(
    { timeout: 30000 },
  );
  await page.getByLabel("Column 1 type").selectOption("bigint");
  await page.getByLabel("Column 2 type").selectOption("bigint");
  await page.getByLabel("New table name", { exact: true }).fill("sales");
  await page
    .getByLabel("I approve these columns and this destination.")
    .check();
  await page
    .getByRole("button", { name: "Create table and import", exact: true })
    .click();
  await expect(
    page.locator(".import-job").filter({ hasText: "public.sales" }),
  ).toContainText("succeeded", { timeout: 60000 });
  const pg = async (sql) =>
    cli("sql", "--branch", "analytics-demo", "--write", "--sql", sql);
  const pgResult = await pg("SELECT sum(amount) FROM sales");
  expect(pgResult.rows).toEqual([["30"]]);
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  const area = page.getByRole("region", { name: "Analytical workspace" });
  const session = await (
    await context.request.get(origin + "/api/session", {
      headers: { "X-Supabricks-Console": "1" },
    })
  ).json();
  const headers = {
    Origin: origin,
    "X-Supabricks-Console": "1",
    "X-Supabricks-CSRF": session.csrf,
  };
  const raw = (command, client = context.request, h = headers) =>
    client.post(origin + "/api/workspace", {
      headers: h,
      data: { action: "analytics", command },
    });
  async function api(command) {
    const response = await raw(command);
    const value = await response.json();
    expect(response.ok(), JSON.stringify(value)).toBe(true);
    return value.value;
  }
  const target = {
    branch: (
      await (
        await context.request.get(origin + "/api/overview", { headers })
      ).json()
    ).branches.find((b) => b.name === "analytics-demo").id,
    revision: 1,
  };
  const snapshot = () => api({ action: "snapshot", target });
  async function publish(expected = "published") {
    const identity = area.locator(".analytics-refresh code").first();
    const old = (await identity.count()) ? await identity.textContent() : null;
    await area.getByRole("button", { name: "Publish fresh snapshot" }).click();
    if (old) await expect(identity).not.toHaveText(old);
    await expect(area.locator(".analytics-refresh strong")).toHaveText(
      expected,
      { timeout: 120000 },
    );
  }
  async function open() {
    const old = new Set((await api({ action: "list" })).map((s) => s.id));
    await area.getByRole("button", { name: "Open latest session" }).click();
    let id;
    await expect
      .poll(
        async () => {
          id = (await api({ action: "list" })).find((s) => !old.has(s.id))?.id;
          return Boolean(id);
        },
        { timeout: 15000 },
      )
      .toBe(true);
    await expect
      .poll(async () => (await api({ action: "status", id })).state, {
        timeout: 120000,
      })
      .toBe("ready");
    await expect(area.locator(".analytics-binding strong")).toHaveText(
      "ready",
      { timeout: 10000 },
    );
    return id;
  }
  async function query(
    sql = "SELECT sum(amount) AS total FROM public.sales",
    value = "30",
  ) {
    const result = area.locator(".sql-panel > .analytics-result");
    const old = (await result.count())
      ? await result.getAttribute("data-query-id")
      : null;
    await area
      .getByRole("textbox", { name: "Analytics SQL", exact: true })
      .fill(sql);
    await area
      .getByRole("button", { name: "Run Analytics SQL", exact: true })
      .click();
    if (old) await expect(result).not.toHaveAttribute("data-query-id", old);
    await expect(result.locator("p > strong")).toHaveText("complete", {
      timeout: 40000,
    });
    if (value !== null)
      await expect(
        result.getByRole("button", {
          name: `total, row 1: ${value}`,
          exact: true,
        }),
      ).toBeVisible();
    return result;
  }
  await expect(
    area.getByRole("button", { name: "Open latest session" }),
  ).toBeDisabled();
  await publish();
  const first = await snapshot();
  await expect(area.locator(".analytics-snapshot")).toContainText(
    first.epoch_id,
  );
  await area.getByText("Published tables", { exact: true }).click();
  await expect(area.locator(".analytics-snapshot")).toContainText(
    "public.sales",
  );
  const a = await open();
  await query();
  expect(JSON.stringify(await api({ action: "status", id: a }))).not.toMatch(
    /sc:\/\/|session-work|127\.0\.0\.1/,
  );
  record(
    "C03 imports CSV in browser, verifies PostgreSQL sum and real Sail result against visible published source/epoch without worker endpoints",
  );
  await area
    .getByRole("button", { name: "Keep result for comparison" })
    .click();
  await pg("INSERT INTO sales VALUES (3,40)");
  await query();
  await publish();
  const second = await snapshot();
  expect(second.epoch_id).not.toBe(first.epoch_id);
  await expect(area).toContainText("A newer epoch is published");
  await query();
  const b = await open();
  await query(undefined, "70");
  await expect(area.locator(".sql-panel details")).toContainText(
    first.epoch_id,
  );
  record(
    "C03 refresh keeps old session at 30 while explicit new session sees 70; bounded retained comparison preserves old epoch",
  );
  await area.getByRole("button", { name: "Open latest session" }).click();
  await expect(area.locator(":scope > .notice")).toContainText(
    "both analytical session slots are occupied",
  );
  const other = await browser.newContext();
  try {
    const ticket = await launch();
    const auth = await other.request.post(origin + "/api/session", {
      headers: { Origin: origin, "X-Supabricks-Console": "1" },
      data: { token: new URL(ticket.url).hash.slice(8) },
    });
    const csrf = (await auth.json()).csrf;
    for (const action of ["status", "close", "cancel"])
      expect(
        (
          await raw({ action, id: a }, other.request, {
            ...headers,
            "X-Supabricks-CSRF": csrf,
          })
        ).status(),
      ).toBe(404);
  } finally {
    await other.close();
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Database workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await area
    .getByRole("combobox", { name: "Analytics branch", exact: true })
    .selectOption(target.branch);
  await area
    .getByRole("combobox", { name: "Analytical session", exact: true })
    .selectOption(b);
  await query(undefined, "70");
  record(
    "C03 shared two-slot admission rejects exhaustion, browser ownership rejects foreign handles, reload reconnects without creating or replaying work",
  );
  let lostResponses = 0;
  const dropAccepted = async (route) => {
    const body = route.request().postDataJSON();
    if (body?.action === "analytics" && body.command?.action === "sql") {
      ++lostResponses;
      const accepted = await route.fetch();
      expect(accepted.ok()).toBe(true);
      await route.abort("connectionfailed");
    } else await route.continue();
  };
  await page.route("**/api/workspace", dropAccepted);
  try {
    await query(undefined, "70");
  } finally {
    await page.unroute("**/api/workspace", dropAccepted);
  }
  expect(lostResponses).toBe(1);
  await expect(area.locator(":scope > .notice")).toContainText(
    "Admission may have completed",
  );
  record(
    "C03 lost accepted SQL response recovers its original result through polling without replay",
  );
  await area.getByRole("spinbutton", { name: "Analytics row limit" }).fill("1");
  const result = await query("SELECT id AS total FROM sales ORDER BY id", "1");
  await expect(result).toContainText("Result truncated");
  await area
    .getByRole("spinbutton", { name: "Analytics row limit" })
    .fill("200");
  await api({
    action: "sql",
    id: b,
    sql: "DELETE FROM sales",
    max_rows: 200,
    timeout_ms: 10000,
  });
  await expect
    .poll(async () => (await api({ action: "status", id: b })).query?.state, {
      timeout: 30000,
    })
    .toBe("failed");
  expect((await pg("SELECT sum(amount) FROM sales")).rows).toEqual([["70"]]);
  await api({
    action: "sql",
    id: b,
    sql: "SELECT sum(id) FROM range(1000000000)",
    max_rows: 200,
    timeout_ms: 30000,
  });
  await area.getByRole("button", { name: "Cancel analytical session" }).click();
  await expect
    .poll(async () => (await api({ action: "status", id: b })).state, {
      timeout: 30000,
    })
    .toMatch(/^(cancelled|failed|closed)$/);
  await area
    .getByRole("combobox", { name: "Analytical session", exact: true })
    .selectOption(a);
  await query();
  record(
    "C03 result limits visibly truncate and targeted cancellation releases one session while its peer remains pinned and usable",
  );
  await pg("CREATE TABLE unsupported (payload jsonb)");
  await publish("failed");
  expect((await snapshot()).epoch_id).toBe(second.epoch_id);
  await query();
  await pg("DROP TABLE unsupported");
  const refresh = await api({
    action: "refresh",
    target,
    key: crypto.randomUUID(),
  });
  await api({ action: "cancel_refresh", id: refresh.id });
  await expect
    .poll(
      async () =>
        (await api({ action: "refresh_status", id: refresh.id })).state,
      { timeout: 90000 },
    )
    .toBe("cancelled");
  expect((await snapshot()).epoch_id).toBe(second.epoch_id);
  record(
    "C03 unsupported JSONB refresh and cancelled refresh preserve prior publication and the existing reader",
  );
  const expiring = await cli(
    "analytics",
    "open",
    "--branch",
    "analytics-demo",
    "--ttl-ms",
    "10000",
  );
  await expect
    .poll(async () => (await cli("analytics", "session", expiring.id)).state, {
      timeout: 45000,
      intervals: [1000],
    })
    .toBe("closed");
  expect((await cli("analytics", "session", expiring.id)).error).toBe(
    "expired",
  );
  record(
    "C03 read-only admission preserves PostgreSQL and shared TTL expiry releases the session slot",
  );
  // Stop the page heartbeat by closing its only owned page; the server must clean up
  // without an unload request. Another browser session must not keep it alive.
  const disconnected = await browser.newContext();
  let abandoned;
  try {
    const ticket = await launch();
    const p = await disconnected.newPage();
    await p.goto(ticket.url);
    await expect(
      p.getByRole("button", { name: "main", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    const auth = await (
      await disconnected.request.get(origin + "/api/session", {
        headers: { "X-Supabricks-Console": "1" },
      })
    ).json();
    const response = await raw(
      { action: "open", target, key: crypto.randomUUID() },
      disconnected.request,
      { ...headers, "X-Supabricks-CSRF": auth.csrf },
    );
    expect(response.ok(), response.ok() ? "" : await response.text()).toBe(
      true,
    );
    abandoned = (await response.json()).value.id;
    await p.close();
    await expect
      .poll(async () => (await cli("analytics", "session", abandoned)).state, {
        timeout: 160000,
        intervals: [2000],
      })
      .toMatch(/^(closed|cancelled|failed)$/);
  } finally {
    await disconnected.close();
  }
  record(
    "C03 lost browser heartbeat closes its owned worker without unload delivery or interference from another browser",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 960 });
  record(
    "C03 analytical source, session controls and results remain within a narrow viewport",
  );
  // Leave one owned reader for the parent harness's real daemon shutdown/restart check.
  await page.getByRole("link", { name: /Overview/ }).click();
  return { id: a, epoch: first.epoch_id };
}
export async function verifyAnalyticsAfterRestart(cli, reader, checks) {
  const s = await cli("analytics", "session", reader.id);
  expect(["closed", "failed", "cancelled"]).toContain(s.state);
  expect(s.endpoint).toBeNull();
  expect(s.epoch_id).toBe(reader.epoch);
  checks.push(
    "C03 daemon restart fences the prior reader without silently rebinding its historical epoch",
  );
}
