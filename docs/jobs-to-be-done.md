# Console jobs to be done

[Product documentation](README.md) · [Current state](current-state.md) · [User flows](user-flows.md)

These jobs describe user progress, not sidebar sections or implementation tickets.
They are initial hypotheses as of 2026-09-22, to be validated with representative
users. "Jobs" here means user needs; it does not imply a workflow scheduler.

## Users and situations

| User | Typical situation | What they need to trust |
| --- | --- | --- |
| Analyst | A question to answer with SQL or Python, using a file or existing dataset | Correct source, freshness, understandable results and saved analysis |
| Data engineer | Prepare, publish and reuse data; maintain repeatable notebooks | Schema, complete publication, dependency reproducibility and recoverable operations |
| Application developer | Inspect or change PostgreSQL while protecting another branch | Selected branch, write consequences, connection context and independent experiments |
| Data/project owner | Let another person or project use an approved result | Ownership, publication revision, grants and revocation consequences |
| Platform administrator | Operate a governed installation and help users recover | Identity, authorization, runtime health, audit and bounded execution |

One person may perform several roles. A persona never grants permission: the
server determines allowed actions. Local-owner and governed profiles change how
the job is authorized, not the underlying user outcome.

## Priority and traceability

**P0** is the core daily authoring loop. **P1** completes sharing, portability and
operational experiences. These are proposed sequencing priorities, not permission
to ship a governed redesign without its access/revocation controls. **Future**
means a separate product/backend capability decision.

| Job | Outcome | Priority | Flows |
| --- | --- | --- | --- |
| JTBD-01 | Enter the right working context and resume work | P0 | UF-01, UF-02 |
| JTBD-02 | Turn a file into usable data | P0 | UF-03 |
| JTBD-03 | Find and assess a trustworthy dataset | P0 | UF-04 |
| JTBD-04 | Answer a question and keep the query | P0 | UF-05 |
| JTBD-05 | Experiment without changing the original database branch | P0 | UF-06 |
| JTBD-06 | Analyze a known, reproducible data version | P0 | UF-07 |
| JTBD-07 | Develop and resume a reusable notebook | P0 | UF-08 |
| JTBD-08 | Change dependencies without confusing running work | P0 | UF-09 |
| JTBD-09 | Publish and consume a dataset across projects | P1 | UF-10 |
| JTBD-10 | Move work to another installation or deployment | P1 | UF-11 |
| JTBD-11 | Give and remove the right access | P1 | UF-12 |
| JTBD-12 | Understand progress and recover from failure | P0 / P1 operator extensions | UF-13 |
| JTBD-13 | Hand analysis to another authorized person | P1 | UF-14 |
| JTBD-14 | Run recurring work and deliver monitored results | Future | UF-15 |

## JTBD-01 — Enter and resume the right work

**When** I open the console or return after an interruption, **I want** to find my
project and unfinished work, **so I can** continue without reconstructing context.

Show the installation/profile, signed-in identity when applicable, accessible
projects and relevant next actions. Opening existing work should restore its
asset context without silently rerunning it. A new user needs an obvious route
to creating a project or opening data they can access.

**Success:** the user identifies the project, recognizes saved versus unsaved
work and resumes deliberately. **Avoid:** a dashboard of service IDs, hidden
project changes, expired launch links with no recovery path, or leaking a previous
user's recents after logout. Maps to [entry](user-flows.md#uf-01--enter-or-resume)
and [project setup](user-flows.md#uf-02--create-or-open-a-project).

## JTBD-02 — Turn a file into usable data

**When** I receive a supported file, **I want** to inspect its interpretation and
load it into a chosen project/branch, **so I can** query it with confidence.

Show sample rows, inferred types, mapping choices and the new destination before
submission. Keep the approved plan and operation visible through execution.
Completion should lead directly to the imported table and a useful first query.

**Success:** the user confirms schema and row outcome, runs a query and can find
the import again. **Avoid:** silent coercion, overwriting an existing table by
default, duplicate imports after reconnect, or discarding valid mappings after a
fixable error. Maps to [UF-03](user-flows.md#uf-03--import-a-file).

## JTBD-03 — Find data and decide whether to use it

**When** I have a question but do not know the right table, **I want** to browse
and inspect permitted datasets, **so I can** choose a relevant and trustworthy input.

Make schema, source project, live/snapshot status, publication time and access
meaningful before opening an editor. A preview is bounded and labelled as a sample.
Discovery and consumption are different actions; some data needs an explicit binding.

**Success:** the user can explain what the dataset represents and how current it
is, then open a permitted query or notebook. **Avoid:** inaccessible names/counts,
misleading "latest" labels or turning a browse action into a grant. Maps to
[UF-04](user-flows.md#uf-04--discover-and-inspect-data).

## JTBD-04 — Answer a question and keep the query

**When** I need to investigate data, **I want** to iteratively write SQL, inspect
results and save useful work, **so I can** answer the question and return to it.

The editor should keep engine, branch and analytical version clear; preserve
drafts; expose running/cancelled/failed states; and distinguish NULL, empty values,
truncated results and successful zero-row results. Saving source and running it
are separate actions. Writes require the appropriate mode and authority.

**Success:** an accurate result and a named, reopenable query with execution
context. **Avoid:** executing in an unexpected branch/engine or silently losing
SQL when switching views. Maps to [UF-05](user-flows.md#uf-05--author-and-run-sql).

## JTBD-05 — Experiment on an independent branch

**When** I need to change data or schema experimentally, **I want** to create and
select a database branch, **so I can** test without changing the source branch.

Make the source, branch identity, readiness and active editor target explicit.
Let users compare relevant results and clean up the experiment with visible
consequences. Branching data does not implicitly copy project files or merge results.

**Success:** the experiment changes only the chosen branch and the user can
return to the original context. **Avoid:** implying Git-style database merges or
silently retargeting an existing running session. Maps to
[UF-06](user-flows.md#uf-06--experiment-on-a-database-branch).

## JTBD-06 — Analyze a reproducible version

**When** live data has changed or I need to reproduce an earlier result, **I want**
to select a known analytical snapshot, **so I can** explain which data produced it.

Show whether no snapshot exists, refresh is underway, newer data is available,
or a session is pinned to an earlier publication. Switching data versions is an
explicit action with clear effects on running work.

**Success:** the result retains its exact input provenance and users understand
why it can differ from live PostgreSQL. **Avoid:** automatic repinning, implying
CDC, or claiming the timestamp proves no later live writes occurred. Maps to
[UF-07](user-flows.md#uf-07--refresh-and-select-an-analytical-snapshot).

## JTBD-07 — Build reusable notebook analysis

**When** exploration needs code, narrative and intermediate results, **I want**
to develop a notebook and resume it later, **so I can** build an understandable,
repeatable analysis rather than a one-session experiment.

Treat files, dirty edits, environment, data inputs, kernel state and outputs as
related but distinct. Let the user run cells, interrupt, restart and stop without
guessing what is preserved. Opening a notebook must not execute it.

**Success:** source is saved deliberately, results show provenance, and a fresh
kernel can reproduce the analysis with the declared inputs. **Avoid:** implying
old outputs prove the current source has run, or losing edits on auth expiry.
Maps to [UF-08](user-flows.md#uf-08--create-run-and-resume-a-notebook).

## JTBD-08 — Maintain the environment for my work

**When** a notebook needs a package change, **I want** to review and prepare a
reproducible environment, **so I can** use the dependency without breaking a
running analysis or an offline handoff.

Distinguish declared dependencies, prepared environment and active kernel
environment. Explain the impact of adoption/restart and preserve the currently
working environment when preparation fails.

**Success:** the dependency is available after explicit adoption and the notebook
records the resulting environment. **Avoid:** a successful install message that
implies an already-running kernel changed. Maps to
[UF-09](user-flows.md#uf-09--prepare-and-adopt-an-environment).

## JTBD-09 — Make a dataset reusable across projects

**When** I have prepared useful data, **I want** to publish a reviewed snapshot
and let an authorized project bind to it, **so I can** share a stable input with
clear ownership and update behavior.

The producer must understand what will become discoverable. The consumer must
review the specific publication and logical binding. Updated publications do
not automatically change running analysis or transfer ownership.

**Success:** the consuming project queries the intended revision, with appropriate
access and provenance. **Avoid:** treating publication as a universal grant or
withdrawal as immediate deletion of every retained reader. Maps to
[UF-10](user-flows.md#uf-10--publish-and-consume-across-projects).

## JTBD-10 — Move work without hidden machine dependencies

**When** I need to hand off or deploy a project elsewhere, **I want** a reviewed
package and explicit destination setup, **so I can** reproduce the work without
copying secrets or relying on my machine's runtime IDs.

Explain source-only, offline dependencies and logical data as separate choices.
At the destination, inspect requirements, resolve bindings and review changes
before apply. Show what remains unresolved rather than reporting a false success.

**Success:** the destination can open the installed source and run a deliberate
smoke check. **Avoid:** calling a source archive a complete database backup or
carrying grants and credentials with it. Maps to
[UF-11](user-flows.md#uf-11--package-import-and-apply-a-project).

## JTBD-11 — Control and explain access

**When** someone needs access or should lose it, **I want** to review the exact
principal, resource and permission change, **so I can** enable the intended work
without accidentally widening authority.

Separate project membership, execution/service use, PostgreSQL data permissions
and catalog grants. Explain overlapping direct/group grants and the implications
for active executions. A privileged action needs a readable review, not raw JSON.

**Success:** effective access matches the reviewed change, revocation is visible,
and an authorized administrator can inspect the audit outcome. **Avoid:** silent
owner execution, UI-only authorization or treating a hidden button as enforcement.
Maps to [UF-12](user-flows.md#uf-12--grant-review-and-revoke-access).

## JTBD-12 — Know what happened and recover

**When** an operation is slow, fails or outlives my browser, **I want** to see its
current state and safe next action, **so I can** continue without corrupting data
or starting duplicate work.

Show authoritative operation state, affected resource and stage-specific recovery.
Authors need actionable messages; operators need scoped diagnostics and links to
runbooks. Cancellation requested and cancellation complete must remain distinct.

**Success:** users recover valid work or reach a clear terminal outcome, with no
duplicate mutation. **Avoid:** indefinite spinners, false percentages, retrying
unknown writes automatically or exposing credentials in diagnostics. Maps to
[UF-13](user-flows.md#uf-13--monitor-cancel-and-recover-work).

## JTBD-13 — Hand a result to another person

**When** an analysis is ready for review, **I want** to hand over its saved source,
input context and appropriately labelled results, **so another authorized person
can** understand or reproduce it.

Local handoff uses supported source/package export. A proposed governed asset
link must resolve through authorization and must not carry execution authority.
Sharing source, granting data access and allowing execution are distinct decisions.

**Success:** the recipient opens the intended saved revision and knows whether
outputs are historical or freshly executed. **Avoid:** treating coauthoring,
comments or public share links as already implemented. Maps to
[UF-14](user-flows.md#uf-14--hand-off-an-analysis).

## JTBD-14 — Automate recurring results (future)

**When** useful analysis becomes recurring operational work, **I want** to run a
versioned workflow on a schedule or trigger and see its outcome, **so I can**
depend on the result without manually opening the console each time.

This requires job definitions, execution identity, schedules/triggers, dependency
handling, concurrency, retries, retained run history and notification contracts.
Dashboards and alerts add further product scope. These are not supplied by the
current interactive session or durable-operation APIs. Maps to
[UF-15](user-flows.md#uf-15--schedule-repeatable-work-future).

## How we will evaluate the experience

Establish baselines before setting numeric targets. Test representative users in
both supported profiles, including first-time and returning sessions.

| Measure | Definition |
| --- | --- |
| First useful result | Elapsed time and unassisted completion from entry to a verified query result; separate installation/startup time |
| Task success | Completion of the flow's stated outcome without facilitator intervention |
| Context comprehension | User correctly identifies project, branch, live/snapshot input and execution identity when applicable |
| Resume success | User returns after navigation/reload and recovers saved work or receives an accurate unsaved-work warning |
| Recovery success | User resolves an injected failure without duplicate writes, lost source or unauthorized disclosure |
| Discoverability | User finds the next relevant action without being told which sidebar section to use |

Begin with import → SQL → snapshot → notebook, existing dataset → analysis,
return to saved work, and governed share → consume → revoke. Follow with package
handoff and operator recovery. Test keyboard-only navigation and large-but-bounded
result sets throughout. No telemetry collection is introduced by this document.
