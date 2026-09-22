import { expect } from "@playwright/test";

export async function qualifySync({ page, cli, checks }) {
  await cli("database", "create", "sync-demo", "--wait");
  await cli(
    "sql",
    "--branch",
    "sync-demo",
    "--write",
    "--sql",
    "CREATE TABLE events(id integer PRIMARY KEY, value integer)",
  );
  await cli("sql", "--branch", "sync-demo", "--write", "--sql", "INSERT INTO events VALUES(1,10)");
  await page.reload();
  await page.getByRole("button", { name: "Database workspace", exact: true }).click();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page
    .getByLabel("Analytics branch", { exact: true })
    .selectOption({ label: "sync-demo" });
  const area = page.getByRole("region", { name: "Managed analytical sync" });
  await expect(
    area.getByRole("button", { name: "Create sync policy", exact: true }),
  ).toBeEnabled();
  expect(await cli("sync", "list")).toEqual([]);
  await area
    .getByRole("button", { name: "Inspect sync prerequisites" })
    .click();
  await expect(area).toContainText("not_probed");
  expect(await cli("sync", "list")).toEqual([]);
  await area
    .getByLabel("Sync mode", { exact: true })
    .selectOption("continuous");
  const create = area.getByRole("button", {
    name: "Create sync policy",
    exact: true,
  });
  await expect(create).toBeDisabled();
  await area.getByRole("checkbox").check();
  // The server commits, but the first browser response is lost.
  let lost = false;
  const route = async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const data = request.postDataJSON();
      if (
        !lost &&
        data?.command?.action === "managed_snapshots" &&
        data.command.command.kind === "create"
      ) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
    }
    await route.fallback();
  };
  await page.route("**/api/workspace", route);
  await create.click();
  await expect(
    area.getByRole("button", { name: "Retry exact sync request" }),
  ).toBeVisible();
  await area.getByRole("button", { name: "Retry exact sync request" }).click();
  await expect(
    area.getByRole("button", { name: "Retry exact sync request" }),
  ).toHaveCount(0);
  await page.unroute("**/api/workspace", route);
  let policy;
  await expect
    .poll(
      async () => {
        policy = (await cli("sync", "list"))[0];
        return policy?.continuous_status?.state;
      },
      { timeout: 120000 },
    )
    .toBe("healthy");
  expect((await cli("sync", "list")).length).toBe(1);
  await expect(area.locator(".sync-status")).toContainText("healthy");
  checks.push(
    "Sync discovery never enrolls capture; continuous disclosure is required; a lost create response retries the same policy key",
  );
  const first = policy.last_epoch_id;
  await cli(
    "sql",
    "--branch",
    "sync-demo",
    "--write",
    "--sql",
    "UPDATE events SET value=20 WHERE id=1",
  );
  await expect
    .poll(async () => (await cli("sync", "show", policy.id)).last_epoch_id, {
      timeout: 60000,
    })
    .not.toBe(first);
  await area.getByRole("button", { name: "Pause sync", exact: true }).click();
  await expect
    .poll(async () => (await cli("sync", "show", policy.id)).state)
    .toBe("paused");
  await area.getByRole("button", { name: "Review full resync" }).click();
  await expect(area).toContainText(
    "Published epochs and existing readers remain pinned",
  );
  await area.getByRole("button", { name: "Approve resync and pause" }).click();
  await expect
    .poll(
      async () => (await cli("sync", "show", policy.id)).capture_status?.state,
      { timeout: 60000 },
    )
    .toBe("deleted");
  await area.getByRole("button", { name: "Resume sync", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await cli("sync", "show", policy.id)).continuous_status?.state,
      { timeout: 120000 },
    )
    .toBe("healthy");
  expect((await cli("sync", "show", policy.id)).capture_id).not.toBe(
    policy.capture_id,
  );
  checks.push(
    "Browser resync reviews the full-copy consequence, waits for capture cleanup and explicitly resumes a new generation",
  );
  await area
    .getByRole("button", { name: "Delete sync policy…", exact: true })
    .click();
  await area
    .getByRole("button", { name: "Confirm delete sync policy", exact: true })
    .click();
  await expect(
    area.getByRole("button", { name: "Create sync policy", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () => (await cli("sync", "show", policy.id)).capture_status?.state,
      { timeout: 60000 },
    )
    .toBe("deleted");
  // Old runtimes omit capability fields. The browser must not infer support.
  const legacy = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    delete body.capabilities.sync_controls;
    delete body.capabilities.continuous_sync;
    delete body.capabilities.incremental_triggered;
    await route.fulfill({ response, json: body });
  };
  await page.route("**/api/overview", legacy);
  await page.reload();
  await page.getByRole("button", { name: "Database workspace", exact: true }).click();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(area).toContainText("does not expose managed sync controls");
  await expect(
    area.getByRole("button", { name: "Create sync policy", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/overview", legacy);
  await page.reload();
  checks.push(
    "Deleted sync releases capture resources; an older runtime renders an explicit unavailable state",
  );
}
