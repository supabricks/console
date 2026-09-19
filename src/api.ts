export interface Branch {
  id: string;
  name: string;
  parent_id: string | null;
  desired_state: string;
  revision: number;
  observed_revision: number;
  is_default: boolean;
  expired: boolean;
}
export interface Overview {
  api_version: 1;
  project: { id: string; name: string };
  worktree: string;
  data_dir: string;
  branches: Branch[];
  runtime: {
    ready: boolean;
    engine_enabled: boolean;
    generation: number;
    postgres_major: number;
    needs_attention: boolean;
  };
  capabilities: {
    analytical_workspace?: number;
    project_packaging?: number;
    overview: boolean;
    sql: boolean;
    ingestion: boolean;
    notebooks: boolean;
    notebook_environment_controls?: number;
  };
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let csrf = "";
async function request(
  path: string,
  method = "GET",
  body?: object,
  timeout = 10000,
) {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      // The server bounds JSON requests at eight seconds. Allow its response
      // to arrive after a six-second daemon admission/verification check.
      signal: AbortSignal.timeout(timeout),
      headers: {
        "X-Supabricks-Console": "1",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(csrf ? { "X-Supabricks-CSRF": csrf } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "The local runtime is unavailable. Run supabricks doctor, then reopen the console.",
      503,
    );
  }
  let value;
  try {
    value = await response.json();
  } catch {
    throw new ApiError(
      "Unexpected console response. Reopen with supabricks console.",
      503,
    );
  }
  if (!response.ok)
    throw new ApiError(
      value.error?.message ?? "The request failed.",
      response.status,
    );
  if (value.api_version !== 1)
    throw new ApiError(
      "This console and runtime are different versions. Reopen with supabricks console.",
      409,
    );
  return value;
}
export async function authenticate(token: string | null) {
  const value = await request(
    "session",
    token ? "POST" : "GET",
    token ? { token } : undefined,
  );
  csrf = value.csrf;
}
export async function overview(): Promise<Overview> {
  const value = await request("overview");
  if (
    !value.capabilities?.overview ||
    !Array.isArray(value.branches) ||
    !value.project?.id
  ) {
    throw new ApiError(
      "The runtime does not support this overview. Reopen with supabricks console.",
      409,
    );
  }
  return value;
}
export async function logout() {
  await request("logout", "POST");
  csrf = "";
}

export type NotebookDocument = import("@jupyterlab/nbformat").INotebookContent;
export type NotebookFile = {
  path: string;
  document: NotebookDocument;
  revision: string;
};
export type EnvironmentIdentity = {
  id: string;
  inputs: { manifest: string; lock: string };
  contract: string;
  inventory: string;
};
export type NotebookBinding = {
  branch_id: string;
  epoch_id: string | null;
  environment?: EnvironmentIdentity | null;
};
export type NotebookCommand =
  | {
      action: "create";
      key: string;
      target: Target;
      epoch?: string | null;
      environment?: string | null;
    }
  | { action: "status"; id: string; generation: number }
  | {
      action: "adopt_environment";
      id: string;
      generation: number;
      key: string;
      environment: string;
    }
  | {
      action: "start" | "restart" | "interrupt" | "shutdown";
      id: string;
      generation: number;
      key: string;
    };
export type NotebookContext = {
  id: string;
  environment: EnvironmentIdentity | null;
  environment_operation: string | null;
  environment_preparation_needed: boolean;
  prepared_environment_id: string | null;
  generation: number;
  branch_id: string;
  epoch_id: string | null;
  state:
    | "stopped"
    | "starting"
    | "ready"
    | "busy"
    | "interrupting"
    | "stopping"
    | "failed"
    | "lost"
    | "expired";
  error: string | null;
  expires_at_ms: number;
  epoch: Record<string, unknown> | null;
};
export async function notebookList(): Promise<string[]> {
  return (await request("notebooks/contents", "POST", { action: "list" })).value
    .files;
}
export async function notebookGet(path: string): Promise<NotebookFile> {
  return (await request("notebooks/contents", "POST", { action: "get", path }))
    .value;
}
export async function notebookSave(
  path: string,
  document: NotebookDocument,
  expected_revision: string | null,
): Promise<{ path: string; revision: string }> {
  return (
    await request("notebooks/contents", "POST", {
      action: "save",
      path,
      document,
      expected_revision,
    })
  ).value;
}
export async function notebookLifecycle(
  command: NotebookCommand,
): Promise<NotebookContext> {
  return (await request("workspace", "POST", { action: "notebook", command }))
    .value;
}
export async function notebookContexts(): Promise<NotebookContext[]> {
  return (
    await request("workspace", "POST", {
      action: "notebook",
      command: { action: "list" },
    })
  ).value;
}
export type NotebookRefresh = {
  id: string;
  state: string;
  error: string | null;
};
export async function notebookRefresh(
  command:
    | { action: "notebook_refresh"; target: Target; key: string }
    | {
        action: "notebook_refresh_status" | "notebook_cancel_refresh";
        id: string;
      },
): Promise<NotebookRefresh> {
  return (await request("workspace", "POST", command)).value;
}
export async function notebookRename(
  path: string,
  destination: string,
  expected_revision: string,
): Promise<{ path: string; revision: string }> {
  return (
    await request("notebooks/contents", "POST", {
      action: "rename",
      path,
      destination,
      expected_revision,
    })
  ).value;
}
export async function notebookTicket(
  id: string,
  generation: number,
): Promise<{ protocol: string; authorization_protocol: string }> {
  return await request("notebooks/ticket", "POST", { id, generation });
}

export type Target = { branch: string; revision: number };
export type SqlResult = {
  branch_id: string;
  columns: { name: string; type: string; oid: number }[];
  rows: (string | null)[][];
  affected_rows: number;
  read_only: boolean;
};
export type QueryHandle = {
  id: string;
  generation: number;
  target: Target;
  state: "running" | "cancelling" | "succeeded" | "failed" | "cancelled";
  read_only: boolean;
  elapsed_ms: number;
  result?: SqlResult;
  error?: { message: string };
};
export type Operation = {
  id: string;
  branch_id: string;
  status: "pending" | "succeeded" | "superseded" | "failed";
  next_step: number;
  steps: string[];
  error: unknown;
};
export type Saved = {
  id: string;
  revision: number;
  target: Target;
  title: string;
  sql?: string;
};
export type WorkspaceCommand =
  | { action: "create_database"; name: string; key: string }
  | { action: "create_branch"; name: string; target: Target; key: string }
  | {
      action: "set_state";
      target: Target;
      desired: "running" | "suspended";
      key: string;
    }
  | { action: "delete_branch"; target: Target; key: string }
  | { action: "operation"; id: string }
  | { action: "connect"; target: Target }
  | {
      action: "query";
      id: string;
      target: Target;
      sql: string;
      read_only: boolean;
      max_rows: number;
      timeout_ms: number;
    }
  | { action: "catalog"; id: string; target: Target }
  | {
      action: "preview";
      id: string;
      target: Target;
      schema: string;
      table: string;
    }
  | { action: "query_status" | "cancel_query"; id: string }
  | { action: "saved_list" }
  | { action: "saved_get"; id: string }
  | {
      action: "saved_put";
      id: string;
      expected_revision: number;
      target: Target;
      title: string;
      sql: string;
    }
  | { action: "saved_delete"; id: string; expected_revision: number };
export async function workspace<T>(command: WorkspaceCommand): Promise<T> {
  return (await request("workspace", "POST", command)).value;
}

export type Mapping = {
  version: 1;
  format: "csv" | "json_lines" | "json_array" | "json_document" | "parquet";
  delimiter: string;
  header: boolean;
  null_strings: string[];
  columns: {
    input: string;
    name: string;
    data_type: { kind: string; precision?: number; scale?: number };
    nullable: boolean;
  }[];
};
export type ImportSource = {
  id: string;
  display_name: string;
  state: string;
  sha256: string | null;
  bytes: number;
  expires_at_ms: number;
};
export type SourceStatus = {
  status: {
    source: ImportSource;
    inspection: {
      mapping: Mapping;
      rows: (string | null)[][];
      source_schema?:
        | {
            input: string;
            name: string;
            arrow_type: string;
            nullable: boolean;
          }[]
        | null;
    } | null;
    error: string | null;
  };
  received: number;
  expected: number;
  preview: number;
};
export type ImportLoad = {
  version: 1;
  project_id: string;
  branch_id: string;
  branch_revision: number;
  source_id: string;
  source_sha256: string;
  mapping: Mapping;
  schema: string;
  table: string;
};
export type ImportJob = {
  id: string;
  load: ImportLoad;
  state: string;
  attempt: number;
  parsed_rows: number;
  copied_rows: number;
  committed_rows: number | null;
  retryable: boolean;
  source_released: boolean;
  error?: string;
  source?: ImportSource;
};
export async function ingest<T>(command: object): Promise<T> {
  return (await request("workspace", "POST", { action: "ingest", command }))
    .value;
}
export function upload(
  source: string,
  file: File,
  progress: (bytes: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload/${source}`);
    xhr.setRequestHeader("X-Supabricks-Console", "1");
    xhr.setRequestHeader("X-Supabricks-CSRF", csrf);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.timeout = 600000;
    xhr.upload.onprogress = (e) => progress(e.loaded);
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => {
      signal.removeEventListener("abort", abort);
      if (xhr.status === 200) resolve();
      else
        reject(
          new Error(
            "Upload interrupted, rejected or out of disk space. Select the file again.",
          ),
        );
    };
    if (signal.aborted) {
      reject(new Error("Upload cancelled"));
      return;
    }
    // The browser streams the File directly; no arrayBuffer/text/base64 copy.
    xhr.send(file);
  });
}

export type EnvironmentInputs = { manifest: string; lock: string };
export type EnvironmentOperation = {
  id: string;
  key: string;
  state: string;
  error: string | null;
  cancel_requested: boolean;
  generation: string | null;
  workflow: { change: EnvironmentChange; offline: boolean } | null;
  result: {
    changes:
      | { package: string; before: string | null; after: string | null }[]
      | null;
    network: string;
  } | null;
};
export type EnvironmentChange =
  | { kind: "add"; requirement: string }
  | { kind: "remove"; package: string }
  | { kind: "sync" | "lock" }
  | { kind: "adopt"; path: string; expected: EnvironmentInputs }
  | { kind: "import_bundle"; path: string };
export type EnvironmentStatus = {
  version: 1;
  inputs: EnvironmentInputs | null;
  active_generation: string | null;
  preparation_needed: boolean;
  python_version: string;
  target: string;
  declaration: {
    state: "absent" | "present" | "missing_lock" | "invalid";
    requirements: string[];
    error: string | null;
  };
  protected_packages: Record<string, string>;
  environments: {
    id: string;
    inputs: EnvironmentInputs;
    python_version: string | null;
    packages: Record<string, string> | null;
    compatible: boolean;
  }[];
  operations: EnvironmentOperation[];
};
export type EnvironmentCommand =
  | { action: "inspect" }
  | { action: "initialize"; template: "base"; key: string }
  | {
      action: "manage";
      key: string;
      expected: EnvironmentInputs;
      change: EnvironmentChange;
      offline: boolean;
    }
  | { action: "find"; key: string }
  | { action: "declaration"; path: string }
  | { action: "status" | "cancel"; id: string };
export async function environment<T>(command: EnvironmentCommand): Promise<T> {
  return (
    await request("workspace", "POST", { action: "environment", command })
  ).value;
}

export type AnalyticalQuery = {
  id: string;
  epoch_id: string;
  state: string;
  sql?: string;
  columns?: { name: string; type: string }[];
  rows?: (string | null)[][];
  truncated?: boolean;
  error?: string;
};
export type AnalyticalSession = {
  id: string;
  branch_id: string;
  epoch_id: string;
  state: string;
  expires_at_ms: number;
  error: string | null;
  metadata: {
    observed_at_ms: number;
    published_at_ms: number;
    ordinal: number;
  } | null;
  query: AnalyticalQuery | null;
};
export type AnalyticalSnapshot = {
  epoch_id: string;
  ordinal: number;
  branch_id: string;
  source_revision: number;
  observed_at_ms: number;
  published_at_ms: number;
  database: string;
  source: { lsn?: string };
  tables: {
    schema: string;
    name: string;
    columns: { name: string; type: string }[];
  }[];
};
export type AnalyticalRefresh = {
  id: string;
  state: string;
  branch_id: string;
  error: string | null;
  epoch_id: string | null;
};
export type AnalyticsCommand =
  | { action: "snapshot"; target: Target }
  | { action: "open" | "refresh"; target: Target; key: string }
  | {
      action:
        | "refresh_status"
        | "cancel_refresh"
        | "status"
        | "close"
        | "cancel";
      id: string;
    }
  | { action: "list" }
  | {
      action: "sql";
      id: string;
      sql: string;
      max_rows: number;
      timeout_ms: number;
    };
export async function analytics<T>(command: AnalyticsCommand): Promise<T> {
  return (await request("workspace", "POST", { action: "analytics", command }))
    .value;
}

// PK06 uses the platform's source graph, deployment identity and reviewed plan verbatim.
export type ProjectSource =
  | { kind: "current" }
  | { kind: "imported"; id: string };
export interface DeploymentContext {
  api_version: number;
  definition_id: string;
  deployment_id: string;
  runtime_project_id: string;
  workspace_id: string;
  realm_id: string;
  target: string;
  legacy: boolean;
  revision: number;
  actor_id: string;
  effective_principal_id: string;
  identity_provider: string;
}
export interface ProjectInspection {
  definition: { id: string; name: string; format_version: number };
  source_sha256: string;
  target: string;
  targets: Record<string, unknown>;
  capabilities: string[];
  order: string[];
  resources: Record<
    string,
    {
      declaration: {
        kind: string;
        file?: string;
        database?: string;
        environment?: string;
      };
      dependencies: string[];
    }
  >;
  environments: Record<
    string,
    { bundles?: Record<string, { status: string; sha256: string }> }
  >;
  files: Record<string, { sha256: string; bytes: number }>;
  unresolved_bindings: { resource: string; kind: string }[];
  limitations: string[];
}
export interface PackageReport {
  archive_sha256: string;
  content_sha256: string;
  inspection: ProjectInspection;
  exclusions: string[];
}
export interface ProjectResource {
  kind: string;
  origin: string;
  branch: string | null;
  file: string | null;
  database: string | null;
  environment: string | null;
  generation: string | null;
  receipt?: unknown;
}
export interface ProjectStep {
  logical: string;
  kind: string;
  action: string;
  branch: string | null;
  expected_revision: number | null;
  file: string | null;
  database: string | null;
  environment: string | null;
  initialization?: unknown;
}
export interface ProjectPlan {
  api_version: number;
  digest: string;
  context: DeploymentContext;
  worktree: string;
  source_sha256: string;
  archive_sha256: string;
  content_sha256: string;
  installation: string | null;
  options: { adopt: Record<string, string> };
  previous: string | null;
  steps: ProjectStep[];
  retained: string[];
  dependency_closure?: Record<string, unknown>;
}
export interface ProjectOperation {
  id: string;
  key: string;
  plan: ProjectPlan;
  state: string;
  next_step: number;
  cancel_requested: boolean;
  resources: Record<string, ProjectResource>;
  error: string | null;
}
export interface ProjectView {
  operation: ProjectOperation | null;
  worktree: string;
  inspection: ProjectInspection | null;
  source_error: { message: string } | null;
  binding_error: { message: string } | null;
  context: DeploymentContext | null;
  deployments: DeploymentContext[];
  installed_source_sha256: string | null;
  installed: {
    active_revision: string | null;
    resources: Record<string, ProjectResource>;
    preparation_needed: boolean;
    environment_worktrees: Record<string, string>;
  } | null;
}
export type ProjectApplyCommand =
  | { action: "plan"; options: { adopt: Record<string, string> } }
  | { action: "apply"; plan: ProjectPlan; key: string }
  | { action: "find"; key: string }
  | { action: "status" | "cancel"; id: string }
  | { action: "installed" }
  | { action: "asset"; logical: string }
  | { action: "draft"; logical: string; path: string };
export type ProjectCommand =
  | { action: "list" }
  | { action: "view" | "export"; target: string | null }
  | { action: "begin"; bytes: number }
  | { action: "chunk"; id: string; offset: number; hex: string }
  | { action: "verify"; id: string; target: string | null }
  | { action: "dispose"; id: string }
  | { action: "unpack"; id: string; destination: string; target: string | null }
  | { action: "download"; id: string; offset: number }
  | { action: "bind"; key: string; target: string | null }
  | { action: "attach"; deployment: string }
  | { action: "apply"; command: ProjectApplyCommand }
  | { action: "reopen"; environment: string | null };
export async function project<T>(
  source: ProjectSource,
  command: ProjectCommand,
): Promise<T> {
  return (
    await request(
      "workspace",
      "POST",
      { action: "project", source, command },
      130000,
    )
  ).value;
}
