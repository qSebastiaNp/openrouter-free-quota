// service/main.ts
import http from "node:http";
// node_modules/@openchamber/sdk/dist/scrollbar-style.js
var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
function installGuestScrollbarActivity(doc) {
  const root = doc.documentElement;
  if (root.hasAttribute("data-oc-scrollbar-activity"))
    return;
  root.setAttribute("data-oc-scrollbar-activity", "");
  const timers = new WeakMap;
  doc.addEventListener("scroll", (event) => {
    const target = event.target === doc ? root : event.target;
    if (!(target instanceof Element))
      return;
    if (!target.hasAttribute("data-oc-scrolling"))
      target.setAttribute("data-oc-scrolling", "");
    const pending = timers.get(target);
    if (pending !== undefined)
      clearTimeout(pending);
    timers.set(target, setTimeout(() => {
      timers.delete(target);
      target.removeAttribute("data-oc-scrolling");
    }, 1000));
  }, { capture: true, passive: true });
}
var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;
// node_modules/@openchamber/sdk/dist/manifest.js
var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);
// node_modules/@openchamber/sdk/dist/session-events.js
var GUEST_SESSION_EVENT_TYPES = [
  "turn-finished",
  "turn-failed",
  "permission-asked",
  "question-asked",
  "turn-started",
  "session-created",
  "session-archived",
  "session-deleted"
];
var SESSION_EVENTS_IDLE_MS = 10 * 60000;
var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);
// node_modules/@openchamber/sdk/dist/service-host.js
var SERVICE_SCHEDULE_IDLE_MS = 10 * 60000;
var MENTIONS_IDLE_MS = 10 * 60000;
// node_modules/@openchamber/sdk/dist/file-editor.js
var patternExpressions = new Map;
// node_modules/@openchamber/sdk/dist/contract.js
var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
var GUEST_GENERATE_LATE_KEEP_MS = 60 * 60000;
var HOST_REQUEST_ERROR_CODES = [
  "HOST_UNAVAILABLE",
  "HOST_TIMEOUT",
  "HOST_REJECTED",
  "DISCONNECTED",
  "DISABLED",
  "BAD_PATH",
  "NO_INTEGRATION",
  "NO_SERVICE",
  "SERVICE_FAILED",
  "REQUEST_FAILED",
  "RESPONSE_TOO_LARGE",
  "NO_SESSION",
  "SESSION_BUSY",
  "NOT_GRANTED",
  "NO_DIRECTORY",
  "NOT_FOUND",
  "FILE_TOO_LARGE",
  "DENIED",
  "NO_MODEL",
  "MODEL_FAILED",
  "UNSUPPORTED"
];
var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
var HOST_PUSH_TYPES = new Set([
  "workspace",
  "shells",
  "ready",
  "directory",
  "session",
  "connection",
  "settings",
  "session-lifecycle",
  "item",
  "resolve",
  "action",
  "service-event",
  "status-control-event",
  "popover-closed",
  "file-open",
  "file-snapshot",
  "file-saved",
  "generate-late",
  "microphone-audio",
  "microphone-ended"
]);
// node_modules/@openchamber/sdk/dist/service-providers.js
var BROWSER_CONTROL_ACTIONS = [
  "browser.open",
  "browser.snapshot",
  "browser.click",
  "browser.type",
  "browser.select",
  "browser.scroll",
  "browser.back",
  "browser.forward",
  "browser.inspect",
  "browser.capture",
  "browser.resize",
  "browser.close"
];
var BROWSER_PROVIDER_IDLE_MS = 10 * 60000;
var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 60000;
var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 60000;
var TRACKER_PROVIDER_IDLE_MS = 10 * 60000;
var QUOTA_PROVIDER_WIRE_VERSION = 1;
var QUOTA_PROVIDER_METHODS = ["usage.read"];
var QUOTA_PROVIDER_IDLE_MS = 10 * 60000;
var isQuotaProviderMethod = (value) => QUOTA_PROVIDER_METHODS.some((method) => method === value);
var readQuotaProviderRequest = (body) => {
  let wire;
  try {
    const parsed = JSON.parse(body);
    if (Object(parsed) !== parsed || parsed === null)
      return null;
    wire = parsed;
  } catch {
    return null;
  }
  const { v, requestId, method, provider, input } = wire;
  if (v !== QUOTA_PROVIDER_WIRE_VERSION)
    return null;
  if (String(requestId) !== requestId || requestId.length === 0)
    return null;
  if (String(provider) !== provider || provider.length === 0)
    return null;
  if (String(method) !== method || !isQuotaProviderMethod(method))
    return null;
  if (Object(input) !== input || input === null || input === undefined || Array.isArray(input))
    return null;
  const { credentials } = input;
  if (Object(credentials) !== credentials || credentials === null || Array.isArray(credentials))
    return null;
  if (Object.values(Object(credentials)).some((credential) => Object(credential) !== credential || credential === null || Array.isArray(credential)))
    return null;
  return { v: QUOTA_PROVIDER_WIRE_VERSION, requestId, method, provider, input: { credentials } };
};
// node_modules/@openchamber/sdk/dist/service-surface.js
var SURFACE_CONTROLLERS = ["none", "agent", "user"];
var CONTROLLERS = new Set(SURFACE_CONTROLLERS);
// service/main.ts
var OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
function isCount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
async function readFreeQuota(apiKey, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(OPENROUTER_KEY_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  } catch {
    return { ok: false, error: "Could not reach OpenRouter. Check your connection and try again." };
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "OpenRouter rejected the saved API key. Check your OpenRouter credentials in OpenCode." };
    }
    return { ok: false, error: `OpenRouter could not provide quota usage (HTTP ${response.status}). Try again later.` };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "OpenRouter returned an unreadable quota response. Try again later." };
  }
  const entry = payload?.data?.free_model_daily_requests;
  if (!entry || !isCount(entry.used) || !isCount(entry.limit) || !isCount(entry.remaining)) {
    return { ok: false, error: "OpenRouter did not include complete free-model daily quota values. No usage values are available." };
  }
  const now = new Date;
  const resetAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return { ok: true, used: entry.used, limit: entry.limit, remaining: entry.remaining, resetAt };
}
function createServiceServer(env = process.env, fetchImpl = fetch) {
  const serviceToken = env.OPENCHAMBER_SERVICE_TOKEN;
  return http.createServer(async (req, res) => {
    if (!serviceToken || req.headers.authorization !== `Bearer ${serviceToken}`) {
      res.writeHead(401).end();
      return;
    }
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (req.method === "GET" && path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
      return;
    }
    if (req.method !== "POST" || path !== "/quota") {
      res.writeHead(404, { "Content-Type": "application/json" }).end("{}");
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      const request = readQuotaProviderRequest(body);
      if (!request) {
        res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({
          ok: false,
          error: { message: "Invalid quota request." }
        }));
        return;
      }
      const credential = request.input.credentials.openrouter;
      if (!credential || credential.type !== "api" || !credential.key) {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
          ok: true,
          data: {
            ok: false,
            configured: true,
            error: "No usable OpenRouter API key was provided by OpenCode. Check your OpenRouter credentials.",
            usage: null
          }
        }));
        return;
      }
      const result = await readFreeQuota(credential.key, fetchImpl);
      const data = result.ok ? {
        ok: true,
        configured: true,
        planLabel: "Free model daily limit",
        usage: {
          windows: {
            daily: {
              usedPercent: result.limit > 0 ? Math.min(100, result.used / result.limit * 100) : null,
              windowSeconds: 86400,
              resetAt: result.resetAt
            }
          }
        }
      } : { ok: false, configured: true, error: result.error, usage: null };
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, data }));
    });
  });
}
if (process.env.OPENCHAMBER_SERVICE_PORT) {
  createServiceServer().listen(Number(process.env.OPENCHAMBER_SERVICE_PORT), "127.0.0.1");
}
export {
  readFreeQuota,
  createServiceServer
};
