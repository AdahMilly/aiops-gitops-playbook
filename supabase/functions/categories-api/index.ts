import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICE_NAME = "categories-api";
const SERVICE_VERSION = "1.0.0";
const startTime = Date.now();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const slug = pathParts[1] || null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  try {
    if (slug === "health") {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      const dbStart = Date.now();
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/categories?select=id&limit=1`, { headers: authHeaders });
      const dbLatency = Date.now() - dbStart;

      return jsonResponse({
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        status: dbRes.ok ? "healthy" : "degraded",
        uptime_seconds: uptime,
        dependencies: {
          database: {
            status: dbRes.ok ? "connected" : "error",
            latency_ms: dbLatency,
          },
        },
        endpoints: [
          { method: "GET", path: "/", description: "List categories with product counts" },
          { method: "GET", path: "/:slug", description: "Get category by slug with products" },
          { method: "GET", path: "/health", description: "Health check" },
          { method: "POST", path: "/", description: "Create category (auth required)" },
          { method: "PUT", path: "/:slug", description: "Update category (auth required)" },
          { method: "DELETE", path: "/:slug", description: "Delete category (auth required)" },
        ],
      });
    }
    if (req.method === "GET" && !slug) {
      const result = await fetch(
        `${supabaseUrl}/rest/v1/categories?select=*,products(count)&is_active=eq.true&order=sort_order.asc`,
        { headers: authHeaders }
      );
      const categories = await result.json();
      return jsonResponse({ data: categories });
    }
    if (req.method === "GET" && slug) {
      const result = await fetch(
        `${supabaseUrl}/rest/v1/categories?slug=eq.${slug}&select=*,products(id,name,slug,price,short_description,product_images(id,url,alt_text,sort_order,is_primary))`,
        { headers: authHeaders }
      );
      const categories = await result.json();
      if (!categories || categories.length === 0) return errorResponse("Category not found", 404);
      return jsonResponse({ data: categories[0] });
    }
    if (req.method === "POST" && !slug) {
      const body = await req.json();
      const result = await fetch(`${supabaseUrl}/rest/v1/categories`, {
        method: "POST",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to create category", result.status);
      return jsonResponse({ data: data[0] }, 201);
    }

    if (req.method === "PUT" && slug) {
      const body = await req.json();
      const result = await fetch(`${supabaseUrl}/rest/v1/categories?slug=eq.${slug}`, {
        method: "PATCH",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to update category", result.status);
      return jsonResponse({ data: data[0] });
    }

    if (req.method === "DELETE" && slug) {
      await fetch(`${supabaseUrl}/rest/v1/categories?slug=eq.${slug}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      return jsonResponse({ deleted: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
