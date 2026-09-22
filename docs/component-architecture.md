# Reusable React/TypeScript components

[Design system](design-system.md) · [Visual reference](design-system/README.md) ·
[Page structure](page-structure.md)

This is the implementation contract for a future shared UI library. This pass
adds actual tokens and font assets under [src/ui](../src/ui/README.md); the
interfaces below are proposals, not exports that already exist. The design lab
uses plain HTML to keep review independent of the production application.

## Layers and ownership

```text
src/ui/
  tokens.css          semantic colors, type, spacing, density, motion (present)
  fonts/              self-hosted inputs, OFL and provenance (present)
  primitives/         Button, IconButton, Field, TextInput, Checkbox, Badge
  composites/         Dialog, Tabs, Menu, DataTable, EmptyState, StatusBanner
  layout/             AppShell, PageHeader, Toolbar, SplitPane, Inspector
  adapters/           Jupyter/CodeMirror integration and third-party boundaries
  index.ts            intentional public exports; no feature implementation

src/features/         proposed domain owners, migrated incrementally
  data/               DatasetTable, PublicationReview, DatasetBindingForm
  sql/                QueryToolbar, QueryResults, query operation state
  notebooks/          NotebookContextBar, EnvironmentReview
  access/             PermissionReview, authorization-aware actions
```

Features depend on UI; UI never imports `api.ts`, `governed-api.ts` or a feature.
UI accepts values, render slots and callbacks. Domain permissions, operation IDs,
idempotency keys, request cancellation, provenance and server errors belong to
features/controllers. A design-system component cannot grant permission or retry
a mutation. The existing source tree is not renamed by this proposal.

## Extensibility rules

1. Use semantic props (`variant`, `size`, `tone`, `density`) rather than scattered
   color/spacing props or feature names such as `isCatalogButton`.
2. Preserve native attributes, accessible names, events and refs. Default action
   buttons to `type="button"`; opt into submit deliberately.
3. Prefer small compositions and explicit slots (`toolbar`, `footer`, `emptyState`,
   column `cell`) over dozens of boolean options. Avoid arbitrary polymorphic
   elements when they obscure action versus link semantics.
4. Expose controlled state for open/selection/sort/pagination where external state
   matters. Never maintain a second hidden authoritative copy of server state.
5. Namespace classes and tokens. Feature overrides may use documented slots and
   class names, not selectors that depend on undocumented DOM nesting.
6. Theme through semantic CSS custom properties. A theme provider only distributes
   attributes/context and portal scope; components do not branch on raw hex colors.
7. Ship local assets and maintain notices/provenance. No runtime CDN dependencies.
8. Prefer native HTML for simple controls. Evaluate a maintained accessible
   headless implementation for menus, comboboxes and complex dialogs before
   inventing another keyboard/focus model. No library is selected in this pass.

## Proposed primitive API

```tsx
type ButtonProps = React.ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  busy?: boolean;
  busyLabel?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
};

type IconButtonProps = Omit<ButtonProps, "children" | "aria-label"> & {
  "aria-label": string;
  children: React.ReactNode;
};

type StatusBadgeProps = {
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  children: React.ReactNode; // Visible status text is mandatory.
};

// Composition, not an input that invents its own server validation.
<Field label="Project name" hint="Visible to project members." error={nameError}>
  <TextInput value={name} onChange={onNameChange} required />
</Field>
<Button variant="primary" busy={creating} busyLabel="Creating…" onClick={create}>
  Create project
</Button>
```

`Field` must connect IDs, hint and error descriptions reliably, including when a
consumer supplies an ID. `IconButton` requires an accessible name at compile time.
`Button` combines `disabled || busy` without losing accessible progress feedback;
it does not await callbacks or catch domain errors internally. Use a separate
`LinkButton` with anchor props for navigation. React 19 is the current repository
baseline; settle the ref implementation when the primitive is built.

## Table contract

```tsx
type Sort = { columnId: string; direction: "asc" | "desc" } | null;
type ColumnDef<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "start" | "end";
  sortable?: boolean;
  minWidth?: number;
};
type TableState =
  | { kind: "ready" }
  | { kind: "loading"; message?: string }
  | { kind: "error"; message: string; onRetry?: () => void };
type DataTableProps<T> = {
  caption: string;
  rows: readonly T[];
  columns: readonly ColumnDef<T>[];
  getRowId: (row: T) => string;
  state: TableState;
  density?: "comfortable" | "compact";
  sort?: Sort;
  onSortChange?: (sort: Sort) => void;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  emptyState: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
};
```

The table renders semantic headers/cells and controlled sort/selection affordances.
Sorting and pagination live in a domain adapter or explicitly selected local-data
controller, never a hidden assumption that all rows are loaded. IDs remain stable
across sorting. Sortable header cells set `aria-sort`; numeric columns align labels and
values together. A filtered-empty state differs from initial empty data.

Start with bounded ordinary tables. Adopt virtualization only after measuring
the real result workload and validating accessible navigation, scroll restoration,
row heights and selected IDs. An asset table must not silently become the SQL
result serializer. `QueryResults` owns exact strings, types, NULL/empty values,
truncation, input version and result lifetime.

## Component inventory and implementation order

| Phase | Components | Required evidence |
| --- | --- | --- |
| Foundation (this pass) | Semantic tokens, self-hosted fonts, visual reference | Contrast pairs, font provenance, light/dark/density review |
| Primitives | Button/LinkButton/IconButton, Text, Badge, Field, Input, Textarea, Checkbox/Radio, Spinner, Separator | Native attributes/refs, keyboard focus, busy/disabled, name/description/error wiring |
| Shared behavior | Dialog, Tabs, Menu/Combobox, Tooltip, Toast region, EmptyState, StatusBanner | Focus trap/return, Escape, arrow keys, announcements, portals and theme inheritance |
| Data and layout | Table foundation, Pagination, AppShell, PageHeader, Toolbar, SplitPane, Inspector | Controlled state, stable row IDs, nested overflow, responsive/zoom behavior |
| Domain composition | SQL results, notebook context, import review, policy review, publication plan | Existing backend/capability boundaries, operation recovery and product browser gates |

Treat variant/state examples as the acceptance surface. A later Storybook or
equivalent component catalog can replace the static reference with the actual
React components; do not maintain two independently styled implementations after
adoption. This reference is deliberately pre-library design evidence.

## Migration and compatibility

Introduce tokens without global reset rules. Migrate one vertical slice, such as
project creation and its table, before spreading primitives through all screens.
Keep old and new CSS scoped during transition. Maintain contracts with API version,
capability flags and local/governed authorization; the common visual shell must
not merge their security paths.

Jupyter and CodeMirror get adapters that translate semantic tokens to supported
editor variables. Do not rewrite their internal DOM. Keep notebooks' lifecycle,
save conflict, output provenance and restoration behavior owned by their feature.

Before shipping fonts, include their OFL notice in the release's license inventory
and verify each file is bundled locally. Verify no global token selector changes
legacy screens accidentally. Native release inventory and exact-archive gates
continue to apply after the console pin is updated.

## Definition of ready for production adoption

Each component has typed exports, documented variants/slots, named accessible
states, keyboard behavior, both themes and realistic stress examples. Tests cover
behavior rather than class-name snapshots. Typecheck/build and the relevant
product browser gates pass. Use screen-reader/keyboard review alongside automated
checks; a contrast report and a screenshot are not an accessibility certification.
