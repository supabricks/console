// Hold real UI requests open to exercise automatic-load/refresh/page ordering.
import { chromium, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const pending = [];
  const cursors = [];
  await page.route("http://audit.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/context")
      return route.fulfill({ json: { authenticated: true, csrf: "fixture" } });
    if (path === "/auth/v1/control") {
      const request = route.request().postDataJSON();
      if (request.action === "projects")
        return route.fulfill({ json: { projects: [] } });
      if (request.command?.action === "context")
        return route.fulfill({ json: {
          realm_administrator: true, label: "Administrator",
          identity: { actor_id: "fixture", realm_id: "fixture", expires_ms: Date.now() + 60000 },
        } });
      if (request.command?.action === "audit") {
        cursors.push(request.command.after);
        pending.push(route);
        return;
      }
      throw new Error("Unexpected fixture request");
    }
    const file = path.startsWith("/assets/") ? path.slice(1) : "index.html";
    return route.fulfill({
      body: await readFile(resolve(process.env.CONSOLE_TEST_DIST || "dist", file)),
      contentType: file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html",
    });
  });
  await page.goto("http://audit.test/auth/v1/console");
  await page.getByRole("navigation").getByRole("button", { name: "Audit", exact: true }).click();
  const refresh = page.getByRole("button", { name: "Refresh audit", exact: true });
  const next = page.getByRole("button", { name: "Next audit page", exact: true });
  const result = page.locator("pre.governed-result");
  await expect.poll(() => pending.length).toBe(1);
  await expect(refresh).toBeDisabled();
  await expect(next).toBeDisabled();
  const first = { after: 0, through: 200, events: [{ sequence: 200, event: { action: "fixture" } }] };
  await pending.shift().fulfill({ json: first });
  await expect(result).toHaveText(JSON.stringify(first, null, 2));
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect.poll(() => pending.length).toBe(1);
  await expect(refresh).toBeDisabled();
  await expect(next).toBeDisabled();
  await pending.shift().fulfill({ json: first });
  await expect(next).toBeEnabled();
  await next.click();
  await expect.poll(() => pending.length).toBe(1);
  await expect(refresh).toBeDisabled();
  await expect(next).toBeDisabled();
  const end = { after: 200, through: 200, events: [] };
  await pending.shift().fulfill({ json: end });
  await expect(result).toHaveText(JSON.stringify(end, null, 2));
  await expect(refresh).toBeEnabled();
  await expect(next).toBeDisabled();
  expect(cursors).toEqual([0, 0, 200]);
  // An error must release the controls so the operator can retry.
  await refresh.click();
  await expect.poll(() => pending.length).toBe(1);
  await pending.shift().fulfill({ status: 503, json: { error: "Fixture unavailable" } });
  await expect(page.getByRole("alert")).toHaveText(/Fixture unavailable/);
  await expect(refresh).toBeEnabled();
  console.log("PASS audit loading, ordered cursors, end-of-stream and retry controls");
} finally {
  await browser.close();
}
