import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICE_NAME = "api-gateway";
const SERVICE_VERSION = "1.0.0";
const startTime = Date.now();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

interface ServiceRoute {
  slug: string;
  prefix: string;
  description: string;
}

const SERVICES: ServiceRoute[] = [
  { slug: "incidents-api", prefix: "incidents", description: "Incident lifecycle management, comments, timeline" },
  { slug: "users-api", prefix: "users", description: "User profiles, roles, team management" },
  { slug: "notifications-api", prefix: "notifications", description: "Notification center, alerts, webhooks" },
];

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

async function proxyToService(serviceSlug: string, path: string, req: Request): Promise<Response> {
  const targetUrl = `${supabaseUrl}/functions/v1/${serviceSlug}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("Content-Type") || "application/json",
    apikey: req.headers.get("apikey") || anonKey,
    Authorization: req.headers.get("Authorization") || `Bearer ${anonKey}`,
  };

  const init: RequestInit = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const start = Date.now();
  try {
    const res = await fetch(targetUrl, init);
    const latency = Date.now() - start;
    const body = await res.text();

    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
        "X-Service": serviceSlug,
        "X-Latency-Ms": String(latency),
      },
    });
  } catch (err) {
    return jsonResponse({
      error: "Service unavailable",
      service: serviceSlug,
      message: err.message,
    }, 503);
  }
}

async function checkServiceHealth(serviceSlug: string): Promise<{
  status: string;
  latency_ms: number;
  data?: unknown;
}> {
  const start = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${serviceSlug}/health`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const latency = Date.now() - start;
    const data = res.ok ? await res.json() : null;
    return { status: res.ok ? "healthy" : "unhealthy", latency_ms: latency, data };
  } catch {
    return { status: "unreachable", latency_ms: Date.now() - start };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const prefix = pathParts[0] || "";
  const subPath = "/" + pathParts.slice(1).join("/") + (url.search ? `?${url.search}` : "");

  try {
    // ── Gateway Root ──
    if (!prefix || prefix === "") {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      return jsonResponse({
        gateway: SERVICE_NAME,
        version: SERVICE_VERSION,
        uptime_seconds: uptime,
        description: "API Gateway for the Incident Management Platform",
        routes: SERVICES.map((s) => ({
          prefix: `/${s.prefix}`,
          service: s.slug,
          description: s.description,
          proxy: `/${s.prefix}/* -> ${s.slug}/*`,
        })),
        endpoints: [
          { method: "GET", path: "/", description: "Gateway info and service registry" },
          { method: "GET", path: "/health", description: "Aggregate health check for all services" },
          { method: "*", path: "/incidents/*", description: "Proxy to Incidents microservice" },
          { method: "*", path: "/users/*", description: "Proxy to Users microservice" },
          { method: "*", path: "/notifications/*", description: "Proxy to Notifications microservice" },
        ],
        architecture: {
          pattern: "API Gateway",
          services: SERVICES.length,
          database: "PostgreSQL (Supabase)",
          auth: "Supabase Auth + RLS",
          runtime: "Deno Edge Functions",
        },
      });
    }

    // ── Aggregate Health ──
    if (prefix === "health") {
      const checks = await Promise.all(
        SERVICES.map(async (s) => {
          const health = await checkServiceHealth(s.slug);
          return { service: s.slug, prefix: s.prefix, ...health };
        })
      );
      const allHealthy = checks.every((c) => c.status === "healthy");
      return jsonResponse({
        gateway: SERVICE_NAME,
        status: allHealthy ? "healthy" : "degraded",
        services: checks,
      }, allHealthy ? 200 : 503);
    }

    // ── Route to service ──
    const route = SERVICES.find((s) => s.prefix === prefix);
    if (!route) {
      return jsonResponse({
        error: "No route matched",
        available_routes: SERVICES.map((s) => `/${s.prefix}`),
      }, 404);
    }

    return await proxyToService(route.slug, subPath, req);
  } catch (err) {
    return jsonResponse({
      error: "Gateway error",
      message: err.message,
    }, 500);
  }
});
