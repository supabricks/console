# Supabricks Console product documentation

The console should be a daily working environment for discovering data, answering
questions, developing repeatable analysis and governing access. A user should be
able to complete a task, understand its result and resume it later without needing
to understand the platform's internal services.

This directory defines the product experience, page structure and proposed
visual system before production implementation. The ambition is to rival Databricks in the quality and
completeness of the workflows we support. It is not a claim of feature parity.

## Read in this order

1. [Current state and product direction](current-state.md): implemented surfaces,
   gaps, domain vocabulary and the competitive reference.
2. [Jobs to be done](jobs-to-be-done.md): users, situations, desired outcomes,
   priorities and evidence of success.
3. [User flows](user-flows.md): entry points, decisions, recovery paths and
   completion criteria, traced back to those jobs.
4. [Page structure](page-structure.md): navigation hierarchy, page inventory,
   proposed routes, layout responsibilities and state contracts.
5. [Interactive wireframes](wireframes/README.md): 17 linked page compositions,
   profile/state controls and guided journeys. Open locally without a build step.
6. [Design system](design-system.md): cool color roles, typography, sizing, buttons,
   forms, tables, feedback and accessibility targets.
7. [Visual design reference](design-system/README.md): interactive light/dark and
   density examples, using the shared tokens and bundled fonts.
8. [React/TypeScript component architecture](component-architecture.md): proposed
   reusable APIs, extension points, ownership and migration order.

The [platform documentation home](https://github.com/supabricks/platform/blob/main/docs/README.md)
owns stack architecture, implementation plans, operating instructions and release
qualification. These documents own console product intent. Backend capability
claims must remain consistent with the
[platform delivery ledger](https://github.com/supabricks/platform/blob/main/docs/plans/status.md).

## Status and working assumptions

First draft: 2026-09-22. Source baseline: console `4544ee6` and platform
`62c810d`, after UC09.8. These are design hypotheses grounded in the source and
delivered stack, not findings from user interviews. Priorities are proposed;
there is no committed delivery schedule in this document set.

The initial audience is an analyst or data engineer doing SQL/Python work, with
application developers, data owners and platform administrators as important
supporting users. Local-owner and governed-server users share the same task
vocabulary while retaining different permissions and execution boundaries.

## Experience principles

- **Preserve context.** Keep project, branch, engine, data version and execution
  identity visible where they affect the next action.
- **Lead to a result.** Empty states offer a relevant next step; completed actions
  lead to the created table, query, notebook or publication.
- **Make saved work trustworthy.** Distinguish drafts, saved source, running
  execution and persisted output. Never imply that closing a tab stops a run.
- **Explain freshness.** Live PostgreSQL and published analytical snapshots must
  be distinguishable without requiring users to learn epoch identifiers.
- **Keep consequences clear.** Explain what a write, environment change, grant,
  withdrawal or delete will affect before committing it.
- **Recover in place.** A failed request should retain valid input and offer a
  next step. Retrying must not accidentally duplicate work.
- **Make the ordinary path accessible.** Keyboard use, visible focus, labelled
  controls, readable results and useful errors belong in every flow.

## How to use these documents

Design reviews should name the job and flow being improved. Implementation plans
should map screens and API changes to those IDs, identify backend dependencies,
and retain the flow's failure and permission cases. Existing API support does not
mean a proposed interaction already exists. A new capability needs a platform
contract before the UI can present it as available.

The page structure, wireframes and design reference now establish the first
navigation, authoring and visual proposals. Next: review the design direction,
validate priority journeys with users, and implement the shared React primitives
and a first product slice.
Update these records when research or runtime constraints change a decision.
