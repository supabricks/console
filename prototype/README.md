# Supabricks console prototype

A clickthrough prototype of the Supabricks console. It runs entirely on dummy
data defined in `src/lib/data.ts`; nothing calls a running installation, and
every change resets on reload. It is not the real console.

```sh
npm install
npm run dev      # http://127.0.0.1:4180
```

Built with React, shadcn/ui (Radix + Tailwind) and Recharts.

- `SCREENS.md` is the full screen inventory for every section.
- `src/lib/backing.ts` records, per feature, whether the platform backend
  supports it today. It drives the "Needs backend" and "API only" tags on
  screens and the Backend status page. Update it in the same change as the
  screen. Accepted gaps become issues on `supabricks/platform`; record the
  issue number in the `issue` field.

Built so far: the PostgreSQL section (databases, database detail, branches,
table editor, SQL editor, object explorer) Sync (pipeline list, create flow,
pipeline detail) and Analytics (Spark SQL as an engine in the SQL editor,
versions, sessions) Notebooks (browser, a Jupyter-style editor, Python
environment) and Catalog (tables with lineage, publications, shared
datasets).
