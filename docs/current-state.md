# Current state and product direction

[Product documentation](README.md) · [Jobs](jobs-to-be-done.md) · [Flows](user-flows.md)

Baseline inspected 2026-09-22: console `4544ee6`, platform `62c810d`.
The platform has delivered the native and governed foundations. The next console
phase should make that capability coherent, discoverable and suitable for daily
work. This is a product design brief, not an audit claiming missing backend work.

## What exists today

| Area | Source-grounded baseline | Product work to define |
| --- | --- | --- |
| Local shell and projects | [main.tsx](../src/main.tsx) selects overview, Data, database workspace, notebooks and packages; [new-project.tsx](../src/new-project.tsx) creates/reopens projects | Consistent navigation, resuming work and predictable project context |
| PostgreSQL | [workspace.tsx](../src/workspace.tsx) has query tabs, results, saved queries, branch operations and table exploration | An integrated SQL authoring loop with clear execution, save and result states |
| Ingestion | [importer.tsx](../src/importer.tsx) supports preview, approval and durable import operations | Guided first use, recoverable validation and useful completion handoffs |
| Snapshot analytics | [analytics.tsx](../src/analytics.tsx) exposes publication, pinned sessions and read-only Spark SQL | Explain freshness and session changes in user terms; preserve context across editors |
| Data discovery and sharing | [data.tsx](../src/data.tsx) shows live tables, publications, reviewed bindings and notebook handoff | A navigable data browser with clear ownership, availability and permitted actions |
| Notebooks | [notebook.tsx](../src/notebook.tsx) and [editor.ts](../src/notebooks/editor.ts) provide Jupyter editing, explicit saves and kernel controls | A durable authoring experience with understandable source, output and execution state |
| Environments | [environment.tsx](../src/notebooks/environment.tsx) exposes managed dependency preparation and package controls | Guide dependency changes and explain when a running kernel must adopt them |
| Portability | [projects.tsx](../src/projects.tsx) supports package inspection, import/export, deployment binding and reviewed apply | A destination-first transfer flow with legible changes, dependencies and outcomes |
| Governed console | [governed.tsx](../src/governed.tsx) has Data, SQL, Notebooks, Packages, Access, Administration and Audit; it uses [governed-api.ts](../src/governed-api.ts) | Bring task organization and authoring quality into alignment with the local console while retaining separate auth and authorization contracts |
| Product tests | [scripts](../scripts/) exercise database, import, analytics, notebooks, environments, projects, catalog and governed workflows | Add journey acceptance for the redesigned experience; retain existing correctness coverage |

The local shell uses in-memory view selection. The governed console is a separate
component and uses simpler editors/forms, including textarea notebook cells and
JSON fallback results. Existing SQL tabs and saved notebook files are real
capabilities; a unified, durable multi-asset workspace is a proposed next step.

## Product vocabulary

| Term | Meaning in the console |
| --- | --- |
| Installation / server | The Supabricks instance the user has opened, with its deployment profile and available capabilities |
| Project | Ownership and working context for source, queries, notebooks and data workflows |
| Deployment | A project's runtime binding on a particular installation; show it when deploying or resolving ambiguity, not in every ordinary task |
| Branch | A PostgreSQL data branch; it is not a Git branch |
| Live table | Current PostgreSQL data on the selected branch |
| Snapshot | An immutable analytical version created by explicit refresh; show a readable time/version and retain exact provenance in details |
| Publication | A reviewed catalog publication of a complete snapshot set |
| Dataset binding | A consuming project's explicit reference to a publication revision; discovery alone creates no binding or permission |
| Query / notebook | Saved project source; execution and outputs have their own state and provenance |
| Session / kernel | A running analytical or notebook context with selected data and environment inputs |
| Activity / execution | An operation already requested, such as import, refresh, query or notebook execution; it is not a scheduled job definition |

The console is the user-facing workspace. We are not introducing a new backend
"workspace" ownership object in this design. A common shell must not erase the
distinction between local-owner launch sessions and governed OIDC identities.

## Proposed information architecture

This is a hypothesis to test through the flows, not a frozen sidebar design.
The [page structure](page-structure.md) develops it into a screen inventory and
the [wireframes](wireframes/README.md) make it navigable for review.

| Place | User purpose | Scope |
| --- | --- | --- |
| Home / projects | Start, choose a project or resume work | Installation; only accessible projects |
| Project workspace | Browse saved queries, notebooks and project files; open editor tabs | Selected project |
| Data | Find live tables, snapshots and catalog datasets; inspect and use them | Explicit project/catalog scope, filtered by authority |
| SQL editor / notebook editor | Author and run against visible inputs | Project asset plus explicit branch/engine/data context |
| Activity | Follow current and recent operations, inspect failures and cancel supported work | Authorized project activity; aggregation/history needs API review |
| Project settings and access | Manage project configuration and supported permissions | Project and permitted actors |
| Administration | Identity, catalog grants, audit and service health | Governed operator/admin capabilities only |

Global search, deep links, recents and editor restoration are desired connecting
behaviors. Their persistence and authorization contracts need design; there is
no claim that an existing catalog filter is a global search service. Do not add
empty Jobs, Dashboards or Models navigation before those products exist.

## Databricks as a reference

The comparison below uses official documentation reviewed on 2026-09-22.
It informs our design hypotheses, not a usability study or a parity claim.

| Reference | Useful product expectation | Supabricks implication |
| --- | --- | --- |
| [Workspace browser](https://docs.databricks.com/aws/en/workspace/workspace-browser) organizes assets and provides contextual browsing from editors | Users can find and move between related work | Unify project asset discovery and editor context; validate the model without copying Databricks' object hierarchy |
| [Saved queries](https://docs.databricks.com/aws/en/sql/user/queries/) are manageable assets with ownership and permissions | A query should be easy to reopen and share appropriately | Make saved source and the viewer's execution authority explicit; a link must never grant access |
| [Catalog Explorer](https://docs.databricks.com/aws/en/catalog-explorer/) combines data discovery, details and management | Users inspect data before choosing how to use it | Connect schema, freshness, provenance and permitted SQL/notebook actions |
| [Lakeflow Jobs](https://docs.databricks.com/aws/en/jobs/) is a distinct workflow automation product | Repeatable execution deserves its own lifecycle | Treat scheduling and orchestration as future platform/product work, separate from the current activity view |

Supabricks' strongest existing distinctions are local operation, branchable
PostgreSQL, explicit analytical snapshots and portable projects. The target is
an excellent continuous journey across these capabilities, with the same care
for saved work, discoverability and recovery as a mature data platform.

## Capability boundaries and future opportunities

The [stack overview](https://github.com/supabricks/platform/blob/main/docs/stack.md)
and [governed guide](https://github.com/supabricks/platform/blob/main/docs/handbook/governed-server.md)
remain authoritative. In particular:

- Local-owner code runs with the OS owner's permissions. Project organization
  does not create tenant isolation.
- Governed execution, grants, identity and revocation are implemented, but only
  within the qualified Linux profile. Local UI parity cannot bypass that boundary.
- Analytical data changes through explicit snapshots. Do not imply continuous
  synchronization, writable lake tables, row filters or column masks.
- A branch is not automatically merged or promoted into another database.
- Scheduled jobs, dashboards/alerts, real-time coauthoring/comments, general
  lineage, ML experiment/model serving, browser Git integration and AI assistance
  are future opportunities requiring their own discovery and contracts.

## Decisions to validate next

1. Is the dominant first session importing a file, exploring existing governed
   data, or reopening a known project? Test each entry rather than forcing one tour.
2. Can users distinguish live PostgreSQL from a pinned analytical version without
   learning implementation identifiers?
3. Does one project asset browser plus editor tabs work for both SQL and notebooks?
4. Which activity and recovery tasks belong to an author versus an operator?
5. Should broader automation or dashboard work follow the core experience first?
   It is not included implicitly in the initial console redesign.
