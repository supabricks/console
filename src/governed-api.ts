export type Json = Record<string, any>;
let csrf = "";
export class GovernedError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function session(): Promise<Json> {
  const response = await fetch("/auth/v1/context", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new GovernedError(
      "Cannot reach sign-in. Retry when the runtime is available.",
      response.status,
    );
  const value = await response.json();
  csrf = value.csrf;
  return value;
}
export async function control(command: Json): Promise<Json> {
  const response = await fetch("/auth/v1/control", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(45000),
  });
  const value = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("governed-session-lost"));
    throw new GovernedError(
      value.error || "Action unavailable. Refresh before retrying.",
      response.status,
    );
  }
  return value;
}
export const workspace = (command: Json) =>
  control({ action: "workspace", command });
export const requestKey = () => crypto.randomUUID();
