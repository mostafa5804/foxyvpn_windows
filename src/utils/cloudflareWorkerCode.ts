/**
 * Complete ready-to-deploy Cloudflare Worker source code for Mozilla Guardian Relay.
 * Embedded directly in the client so users can 1-click copy without opening files or connecting GitHub.
 * Fully compatible with both FoxyVPN and Arman VPN relay protocols (?url= and direct path).
 */
export const CLOUDFLARE_WORKER_CODE = `/**
 * Cloudflare Worker Relay for Mozilla Guardian (HTTP 451 Bypass)
 * Compatible with both FoxyVPN and Arman VPN relay formats.
 * 
 * Proxies Mozilla VPN Guardian control-plane requests (status, activate, token)
 * from regions blocked by Mozilla (such as Iran returning HTTP 451: unavailable_in_region).
 */

// Set a secret of your choice below, or via Cloudflare Environment Variable 'SECRET' or 'RELAY_SECRET'.
// If left empty (""), the worker accepts requests without requiring a secret (ideal for personal workers).
const SECRET = "";

const UPSTREAM_ORIGIN = "https://vpn.mozilla.org";
const ALLOWED_HOSTS = ["mozilla.org", "mozilla.com", "firefox.com"];
const DROP_HEADERS = [
  "host", "connection", "content-length", "keep-alive", 
  "proxy-authenticate", "proxy-authorization", "te", "trailer", 
  "transfer-encoding", "upgrade", "forwarded", "x-forwarded-for", 
  "x-forwarded-proto", "x-forwarded-host", "x-real-ip", "cf-connecting-ip"
];

function statusPage(title, text, badge, color) {
  const html = \`<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FoxyVPN & Arman Relay Status</title>
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --muted: #94a3b8; --accent: #f97316; --c: \${color}; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: var(--text); font-family: system-ui, -apple-system, sans-serif; background: var(--bg); }
    .card { width: min(540px, 100%); background: var(--card); border-radius: 20px; padding: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border-top: 5px solid var(--c); text-align: center; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-weight: 700; font-size: 14px; color: var(--c); background: rgba(255,255,255,0.08); margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 10px; }
    p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.6; }
    code { background: rgba(249, 115, 22, 0.15); color: var(--accent); padding: 2px 8px; border-radius: 6px; font-size: 14px; direction: ltr; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">\${badge}</span>
    <h1>\${title}</h1>
    <p>\${text}</p>
  </div>
</body>
</html>\`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, User-Agent, Accept, X-Relay-Secret",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Configured secret
    const configuredSecret = (env && (env.SECRET || env.RELAY_SECRET)) ? (env.SECRET || env.RELAY_SECRET) : SECRET;

    // Flexible secret extraction: ?secret=..., ?RAW_SECRET (query without =), or X-Relay-Secret header
    let secretProvided = url.searchParams.get("secret") || request.headers.get("X-Relay-Secret");
    if (!secretProvided && url.search && url.search.length > 1) {
      const q = url.search.slice(1);
      if (!q.includes("=")) {
        secretProvided = decodeURIComponent(q);
      }
    }

    // Health probe (?health=1 or /health)
    const isProbe = url.searchParams.get("health") === "1" || url.pathname === "/health";
    if (isProbe) {
      if (configuredSecret && secretProvided !== configuredSecret) {
        return new Response(JSON.stringify({ error: "unauthorized", message: "Invalid secret" }), {
          status: 403,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      return new Response(JSON.stringify({
        relay: "arman-vpn",
        service: "FoxyVPN Mozilla Guardian Relay",
        version: 1,
        ready: true,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Browser visit without target URL: show status dashboard
    const isBrowser = !url.searchParams.has("url") && (url.pathname === "/" || url.pathname === "");
    if (isBrowser) {
      if (configuredSecret && secretProvided !== configuredSecret) {
        return statusPage(
          "کلید رمز رله وارد نشده یا اشتباه است",
          "آدرس ورکر باید با <code>?secret=YOUR_SECRET</code> به پایان برسد.",
          "✗ رمز عبور اشتباه است",
          "#ef4444"
        );
      }
      return statusPage(
        "سرور رله کلادفلر آماده اتصال است",
        "این آدرس را به همراه پارامتر سکرت در فیلد سرور رله برنامه وارد کنید.",
        "✓ Working / آماده به کار",
        "#10b981"
      );
    }

    // Verify secret if configured
    if (configuredSecret && secretProvided !== configuredSecret) {
      return new Response(JSON.stringify({
        error: "unauthorized",
        message: "Missing or invalid relay secret key",
      }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Determine target upstream URL
    let targetURL;
    if (url.searchParams.has("url")) {
      // Arman VPN standard format: ?url=https://vpn.mozilla.org/api/v1/fpn/token
      try {
        targetURL = new URL(url.searchParams.get("url"));
      } catch {
        return new Response("Invalid target URL", { status: 400 });
      }
    } else {
      // Direct subpath format: /api/v1/fpn/token
      let subPath = url.pathname;
      if (!subPath.startsWith("/api/v1/fpn/")) {
        subPath = "/api/v1/fpn/" + subPath.replace(/^\\/+/, "");
      }
      targetURL = new URL(subPath, UPSTREAM_ORIGIN);
      // Forward other query params excluding 'secret'
      url.searchParams.forEach((val, key) => {
        if (key !== "secret") {
          targetURL.searchParams.set(key, val);
        }
      });
    }

    // Host validation
    const host = targetURL.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.some((domain) => host === domain || host.endsWith("." + domain))) {
      return new Response(JSON.stringify({ error: "forbidden_host", host }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Prepare headers for upstream
    const newHeaders = new Headers();
    for (const [name, val] of request.headers) {
      const lower = name.toLowerCase();
      if (DROP_HEADERS.includes(lower) || lower.startsWith("cf-")) continue;
      newHeaders.set(name, val);
    }
    newHeaders.set("User-Agent", "MozillaVPN/2.35.0 (sys:windows; iap:true)");
    newHeaders.set("Accept", "application/json");

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? await request.arrayBuffer() : undefined;

    try {
      const upstreamResp = await fetch(targetURL.toString(), {
        method: request.method,
        headers: newHeaders,
        body,
        redirect: "manual",
      });

      const respHeaders = new Headers(upstreamResp.headers);
      respHeaders.set("Access-Control-Allow-Origin", "*");
      respHeaders.set("X-Arman-Relay", "1");
      respHeaders.set("X-Relayed-By", "FoxyVPN-Worker");

      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: "upstream_relay_failed",
        message: err.message || "Failed to reach Mozilla from relay",
      }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
`;
