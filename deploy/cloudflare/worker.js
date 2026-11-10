/**
 * Cloudflare Worker Relay for Mozilla Guardian (HTTP 451 Bypass)
 * 
 * Proxies Mozilla VPN Guardian control-plane requests (status, activate, token)
 * from regions blocked by Mozilla (such as Iran returning HTTP 451: unavailable_in_region).
 * 
 * Your main internet traffic continues through Mozilla's Fastly MASQUE tunnel directly.
 * Only license/token acquisition requests go through this lightweight worker.
 */

// Replace with a secure secret of your choice, or set it via Cloudflare Environment Variable 'RELAY_SECRET'
const DEFAULT_SECRET = "foxyvpn_secret_relay_key";
const UPSTREAM_ORIGIN = "https://vpn.mozilla.org";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, User-Agent, Accept",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health check endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      const qSecret = url.searchParams.get("secret");
      const configuredSecret = (env && env.RELAY_SECRET) ? env.RELAY_SECRET : DEFAULT_SECRET;
      
      if (qSecret && qSecret !== configuredSecret) {
        return new Response(JSON.stringify({ status: "error", message: "Invalid secret" }), {
          status: 403,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      return new Response(JSON.stringify({
        status: "ok",
        service: "FoxyVPN Mozilla Guardian Relay",
        version: "1.1.0",
        upstream: UPSTREAM_ORIGIN,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Authenticate request using ?secret=... or X-Relay-Secret header
    const secretProvided = url.searchParams.get("secret") || request.headers.get("X-Relay-Secret");
    const configuredSecret = (env && env.RELAY_SECRET) ? env.RELAY_SECRET : DEFAULT_SECRET;

    if (!secretProvided || secretProvided !== configuredSecret) {
      return new Response(JSON.stringify({
        error: "unauthorized",
        message: "Missing or invalid relay secret key",
      }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Determine target upstream path
    let upstreamPath = url.pathname;
    if (url.searchParams.has("path")) {
      upstreamPath = url.searchParams.get("path");
    }

    // Ensure path starts with /api/v1/fpn/
    if (!upstreamPath.startsWith("/api/v1/fpn/")) {
      upstreamPath = "/api/v1/fpn/" + upstreamPath.replace(/^\/+/, "");
    }

    const upstreamURL = new URL(upstreamPath, UPSTREAM_ORIGIN);

    // Forward relevant query parameters excluding 'secret' and 'path'
    url.searchParams.forEach((val, key) => {
      if (key !== "secret" && key !== "path") {
        upstreamURL.searchParams.set(key, val);
      }
    });

    // Build headers for Mozilla Guardian
    const newHeaders = new Headers();
    newHeaders.set("User-Agent", "MozillaVPN/2.35.0 (sys:windows; iap:true)");
    newHeaders.set("Accept", "application/json");
    newHeaders.set("Accept-Language", "en-US,en;q=0.9");

    if (request.headers.has("Authorization")) {
      newHeaders.set("Authorization", request.headers.get("Authorization"));
    }
    if (request.headers.has("Content-Type")) {
      newHeaders.set("Content-Type", request.headers.get("Content-Type"));
    }

    try {
      const upstreamResp = await fetch(upstreamURL.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
      });

      const respHeaders = new Headers(upstreamResp.headers);
      respHeaders.set("Access-Control-Allow-Origin", "*");
      respHeaders.set("X-Relayed-By", "FoxyVPN-Cloudflare-Worker");

      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: "upstream_relay_failed",
        message: err.message || "Failed to reach vpn.mozilla.org from relay",
      }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
