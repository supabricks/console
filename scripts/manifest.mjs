import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const source = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) =>
  execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
await writeFile(
  join(root, "console-source.json"),
  JSON.stringify(
    {
      repository: "https://github.com/supabricks/console",
      commit: git("rev-parse", "HEAD"),
      dirty: Boolean(git("status", "--porcelain", "--untracked-files=normal")),
      package_lock_sha256: createHash("sha256")
        .update(await readFile(join(source, "package-lock.json")))
        .digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
const files = {};
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.isFile() && entry.name !== "console.json") {
      files[relative(root, path)] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
    } else if (!entry.isFile())
      throw new Error("Console assets must be regular files");
  }
}
await visit(root);
await writeFile(
  join(root, "console.json"),
  JSON.stringify({ api_version: 1, files }, null, 2) + "\n",
);
console.log(`Console API 1: ${Object.keys(files).length} inventoried assets`);
