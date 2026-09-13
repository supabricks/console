import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

export async function qualifyFormats({ page, api, raw, cli, checks, branch }) {
  for (const [file, format, table, count] of [
    ["formats.jsonl", "json_lines", "browser_jsonl", 2],
    ["formats.json", "json_array", "browser_json", 2],
    ["formats.parquet", "parquet", "browser_parquet", 2],
    ["document.json", "json_document", "browser_document", 1],
  ]) {
    const path = new URL(`../fixtures/${file}`, import.meta.url);
    const original = await readFile(path);
    await page.getByLabel("File format", { exact: true }).selectOption(format);
    await page.getByLabel("Choose data file").setInputFiles({ name: file, mimeType: "application/octet-stream", buffer: original });
    await expect(page.getByLabel("Column 1 name")).toHaveValue(format === "json_document" ? "document" : "id", { timeout: 30000 });
    await expect(page.getByLabel("Column 1 type")).toHaveValue(format === "json_document" ? "jsonb" : "bigint");
    await page.getByLabel("Import branch", { exact: true }).selectOption(branch.id);
    await page.getByLabel("Import schema", { exact: true }).fill("public");
    await page.getByLabel("New table name", { exact: true }).fill(table);
    if (format === "json_document") await expect(page.getByText(/current analytical exporter cannot include tables with jsonb/)).toBeVisible();
    if (format === "parquet") {
      await page.getByText("Parquet source types", { exact: true }).click();
      await expect(page.getByText(/decimal128\(20, 4\)/)).toBeVisible();
    }
    const slots = await api({ action: "sources" });
    const slot = slots.find(s => s.source.display_name === file);
    const preview = await api({ action: "source", source: slot.source.id });
    expect(preview.status.inspection.mapping.format).toBe(format);
    // The same bytes and preview number cannot authorize a different parser.
    const forged = await raw({ action: "load", key: crypto.randomUUID(), preview: preview.preview, load: {
      version: 1, project_id: preview.status.source.project_id, branch_id: branch.id, branch_revision: branch.revision,
      source_id: slot.source.id, source_sha256: preview.status.source.sha256,
      mapping: { ...preview.status.inspection.mapping, format: format === "json_lines" ? "json_array" : "json_lines" },
      schema: "public", table: "unapproved_format",
    }});
    expect(forged.status()).toBe(409);
    await page.getByLabel("I approve these columns and this destination.").check();
    await page.getByRole("button", { name: "Create table and import", exact: true }).click();
    await expect(page.locator(".import-job").filter({ has: page.locator("strong").filter({ hasText: new RegExp(`public\\.${table}$`) }) })).toContainText(`${count} committed rows`, { timeout: 30000 });
    const rows = (await cli("sql", "--branch", "main", "--sql", format === "json_document"
      ? `SELECT document->'rows'->0->>'id' FROM ${table}`
      : `SELECT id,zip,amount FROM ${table} ORDER BY id`)).rows;
    expect(rows).toEqual(format === "json_document" ? [["9007199254740993"]] : [["2", "002", "1.0000"], ["9007199254740993", "001", "1234567890123456.1234"]]);
    expect(await readFile(path)).toEqual(original);
    checks.push(`${format}: real browser upload, format-bound approval and typed COPY preserve exact values and original source`);
    await page.reload();
    await page.getByRole("button", { name: "Database workspace", exact: true }).click();
    await expect(page.locator(".import-job").filter({ has: page.locator("strong").filter({ hasText: new RegExp(`public\\.${table}$`) }) })).toContainText(`${count} committed rows`);
    await page.getByRole("button", { name: "Import file", exact: true }).click();
  }
  await page.getByLabel("File format", { exact: true }).selectOption("auto");
}
