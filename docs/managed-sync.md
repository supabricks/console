# Managed analytical sync — SY06 source slice

`src/sync.tsx` is one task component used by the local Analytics page and the
signed-in Data page. The transport is injected; the component does not assign
permissions, infer runtime support or start a policy on mount.

Local entry: **Database workspace → Analytics → Managed analytical sync**.
Governed entry: **Data → selected branch → Managed analytical sync**.

- Inspect reads prerequisites only. The UI calls source qualification
  `not_probed` until runtime workers validate the source.
- Creation is explicit. Continuous requires acknowledgment of compute and
  bounded resource use; snapshot/triggered expose UTC interval settings.
- Settings preserve existing export budgets. Revisions and stable keys fence
  writes; a lost response offers the identical retry for reconciliation.
- Policy details distinguish observed lag from publication age, show unknown
  values, and retain the current reader's epoch. Recent runs appear in a table.
- Pause, resume, cancellation, deletion and resync have separate effects. Resync
  first reviews the full-copy consequence, then pauses and retires capture; the
  user resumes after cleanup to start a new bootstrap.
- Signed-in snapshot policies request a service principal with branch Read and
  Execute sync. The manager separately needs Read, Manage sync and Read sync.
  Sharing review uses existing Share/UC controls and does not grant access as a
  side effect of creation.
- Capability version `sync_controls=1` enables the surface. Missing capability
  fields display an explicit older-runtime message. Governed incremental modes
  and event triggers remain disabled until their backend profiles are qualified.

This adds controls to the working console; it does not implement the complete
proposed page migration or the reusable design-system primitives. The platform's
[SY06 contract](https://github.com/supabricks/platform/blob/main/docs/architecture/sy06-sync-surfaces.md)
owns security, runtime boundaries, qualification and remaining delivery gates.

`scripts/sync.mjs` runs against a real disposable native cell through the existing
Playwright harness. It checks no implicit enrollment, the continuous disclosure,
a lost accepted creation response, progress, reviewed resync/new generation,
cleanup and old-runtime fallback. Run from this repository:

```bash
node scripts/qualify.mjs --binary PLATFORM_BINARY --bundle ENGINE --helpers HELPERS \
  --python ANALYTICAL_PYTHON --worker EXPORT_WORKER --slice sync --sync true \
  --report /tmp/sy06-console.json
```
