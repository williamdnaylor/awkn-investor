/**
 * Shared plumbing for the auth evidence battery.
 *
 * Nothing in here knows about a specific assertion — it boots the app, keeps a
 * cookie jar, and reads the delivery stubs. See ./battery.ts for the actual
 * evidence.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

export const BASE = "http://127.0.0.1:3121";
const OUTBOX = path.join(process.cwd(), "var", "outbox");
const SMS_OUTBOX = path.join(process.cwd(), "var", "sms-outbox");

/* ------------------------------------------------------------------ report */

let passed = 0;
const failures: string[] = [];
let step = 0;

export function check(label: string, ok: boolean, detail?: unknown) {
  step += 1;
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${String(step).padStart(2, "0")}  ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${String(step).padStart(2, "0")}  ${label}`);
    if (detail !== undefined) {
      console.log(`        ${JSON.stringify(detail).slice(0, 400)}`);
    }
  }
}

export function section(title: string) {
  console.log(`\n${title}`);
}

export function report(): number {
  console.log(
    `\n${passed}/${passed + failures.length} checks passed` +
      (failures.length ? `\n\nFailed:\n${failures.map((f) => `  - ${f}`).join("\n")}` : "")
  );
  return failures.length === 0 ? 0 : 1;
}

/* ------------------------------------------------------------- cookie jar */

export class Jar {
  private cookies = new Map<string, string>();

  absorb(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair!.indexOf("=");
      if (eq < 0) continue;
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      // An empty value with Max-Age=0 is a deletion.
      if (!value || /max-age=0|expires=thu, 01 jan 1970/i.test(raw)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  /** Names only — values are session tokens and never belong in a transcript. */
  names(): string[] {
    return [...this.cookies.keys()];
  }

  clone(): Jar {
    const next = new Jar();
    next.cookies = new Map(this.cookies);
    return next;
  }

  clear() {
    this.cookies.clear();
  }
}

export interface Reply {
  status: number;
  body: any;
  headers: Headers;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once(
  method: "GET" | "POST",
  route: string,
  opts: { jar?: Jar; body?: unknown; redirect?: RequestRedirect }
): Promise<Reply> {
  const headers: Record<string, string> = {
    // Better Auth's CSRF check compares Origin against trustedOrigins.
    origin: BASE,
  };
  /**
   * Body-less POSTs get a header *and* an empty object, both required.
   * `revoke-other-sessions` takes no arguments, and Better Auth rejects it two
   * different ways depending on what you omit: no content-type is 415
   * UNSUPPORTED_MEDIA_TYPE, and content-type with an empty body is 400 "Invalid
   * JSON in request body". Either way the call silently does nothing, which is
   * how a session revocation looked like it had succeeded.
   */
  const payload = method === "POST" ? (opts.body ?? {}) : opts.body;
  if (method === "POST") headers["content-type"] = "application/json";
  if (opts.jar) headers.cookie = opts.jar.header();

  let res: Response;
  try {
    res = await fetch(`${BASE}${route}`, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      redirect: opts.redirect ?? "manual",
      /**
       * Without this a stalled handler sits on undici's 300-second headers
       * timeout and the failure surfaces with no idea which route caused it.
       * Nothing here should take twenty seconds.
       */
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new Error(
      `${method} ${route} failed: ${(err as Error).message}\n` +
        `--- server log tail ---\n${serverLog().slice(-3000)}`
    );
  }
  opts.jar?.absorb(res);

  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* html or empty */
  }
  return { status: res.status, body, headers: res.headers };
}

/**
 * Every call in the battery goes through here.
 *
 * Better Auth ships default rate limits that are much tighter than the global
 * one: `/sign-in*`, `/sign-up*` and `/change-password*` allow 3 requests per 10
 * seconds *per IP*, and password-reset requests 3 per minute. A battery that
 * signs in twenty times from 127.0.0.1 would spend most of its run reading 429s
 * and reporting them as auth failures. So a 429 is waited out and retried by
 * default — honouring the server's own `X-Retry-After` — and the one assertion
 * that is *about* rate limiting opts out with `noRetry`.
 */
export async function call(
  method: "GET" | "POST",
  route: string,
  opts: {
    jar?: Jar;
    body?: unknown;
    redirect?: RequestRedirect;
    noRetry?: boolean;
  } = {}
): Promise<Reply> {
  for (let attempt = 0; ; attempt++) {
    const reply = await once(method, route, opts);
    if (reply.status !== 429 || opts.noRetry || attempt >= 4) return reply;
    const after = Number(reply.headers.get("x-retry-after") ?? "10");
    await sleep((Number.isFinite(after) ? Math.max(after, 1) : 10) * 1000 + 250);
  }
}

export const api = (route: string) => `/api/auth${route}`;

/* ----------------------------------------------------------------- stubs */

/** Poll the outbox for a message to `to`. Delivery is fire-and-forget. */
export async function waitForEmail(
  to: string,
  timeoutMs = 8000
): Promise<{ to: string; subject: string; text: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let entries: string[] = [];
    try {
      entries = (await readdir(OUTBOX)).filter((f) => f.endsWith(".json"));
    } catch {
      /* not created yet */
    }
    // Newest first.
    for (const f of entries.sort().reverse()) {
      const msg = JSON.parse(await readFile(path.join(OUTBOX, f), "utf8"));
      if (msg.to?.toLowerCase() === to.toLowerCase()) return msg;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No stub email for ${to} within ${timeoutMs}ms`);
}

export function firstUrl(text: string): string {
  const m = text.match(/https?:\/\/\S+/);
  if (!m) throw new Error("No URL in message body");
  return m[0];
}

export async function clearOutboxes() {
  await rm(OUTBOX, { recursive: true, force: true });
  await rm(SMS_OUTBOX, { recursive: true, force: true });
}

/* ---------------------------------------------------------------- server */

/** Everything the server has written, so a stalled request can explain itself. */
let captured: string[] = [];
export const serverLog = () => captured.join("");

export async function bootServer(dbUrl: string, secret: string): Promise<ChildProcess> {
  /**
   * The env is built by ALLOWLIST, not by copying process.env and deleting.
   * This box maps real org credentials onto RESEND_API_KEY / TWILIO_* (see
   * ~/.hermes/env-map.sh), and a battery that inherited them would send real
   * mail to a made-up address. Anything not named here does not reach the app.
   */
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    /**
     * `next start` forces NODE_ENV=production, which would make the delivery
     * modules hard-throw rather than write stubs. VERCEL_ENV=preview is what
     * isProductionRuntime() actually keys on, and it is the honest label: this
     * is a production build that is not the production deployment.
     */
    VERCEL_ENV: "preview",
    PORT: "3121",
    DATABASE_URL: dbUrl,
    AUTH_DATABASE_URL: dbUrl,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: BASE,
    ALLOWLIST_MODE: "gated",
    // Explicitly empty, belt and braces, so the stub path is unmistakable.
    RESEND_API_KEY: "",
    TWILIO_ACCOUNT_SID: "",
    TWILIO_AUTH_TOKEN: "",
    TWILIO_VERIFY_SERVICE_SID: "",
    TWILIO_MESSAGING_SERVICE_SID: "",
    TWILIO_FROM_NUMBER: "",
  };

  /**
   * `detached` so the whole process group can be signalled at once. `npx`
   * forks `next start`, which forks `next-server`; a SIGTERM to the npx pid
   * alone leaves the actual listener holding port 3121, and the next run dies
   * with EADDRINUSE. See stopServer().
   */
  const child = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", "3121"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  const log: string[] = [];
  child.stdout?.on("data", (d) => log.push(String(d)));
  child.stderr?.on("data", (d) => log.push(String(d)));
  captured = log;

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early (${child.exitCode}):\n${log.join("")}`);
    }
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status < 500) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  stopServer(child);
  throw new Error(`Server never became ready:\n${log.join("")}`);
}

/** Signal the whole group, so no listener survives to block the next run. */
export function stopServer(child: ChildProcess) {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}
