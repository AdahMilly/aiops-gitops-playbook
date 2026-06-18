import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICE_NAME = "search-api";
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
  const action = pathParts[1] || null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  try {
    // ── Health Check ──
    if (action === "health") {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      const dbStart = Date.now();
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/products?select=id&limit=1`, { headers: authHeaders });
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
          categories_api: {
            status: "available",
            description: "Used for slug-to-ID resolution",
          },
        },
        endpoints: [
          { method: "GET", path: "/", description: "Search products with full-text, faceted filtering" },
          { method: "GET", path: "/health", description: "Health check" },
        ],
        query_params: [
          { name: "q", type: "string", description: "Search query (searches name, description, SKU)" },
          { name: "category", type: "string", description: "Filter by category slug" },
          { name: "min_price", type: "number", description: "Minimum price filter" },
          { name: "max_price", type: "number", description: "Maximum price filter" },
          { name: "tags", type: "string", description: "Comma-separated tag filter" },
          { name: "in_stock", type: "boolean", description: "Filter to in-stock only" },
          { name: "sort_by", type: "string", default: "relevance", description: "Sort (relevance, price_asc, price_desc, name_asc, newest)" },
          { name: "page", type: "number", default: 1, description: "Page number" },
          { name: "limit", type: "number", default: 12, description: "Items per page (max 50)" },
        ],
      });
    }

    if (req.method !== "GET") {
      return errorResponse("Method not allowed", 405);
    }

    // ── Search ──
    const q = url.searchParams.get("q") || "";
    const categorySlug = url.searchParams.get("category");
    const minPrice = url.searchParams.get("min_price");
    const maxPrice = url.searchParams.get("max_price");
    const tags = url.searchParams.get("tags");
    const inStock = url.searchParams.get("in_stock");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "12"), 50);
    const sortBy = url.searchParams.get("sort_by") || "relevance";

    let queryParams: string[] = [
      "select=*,categories(id,name,slug),product_images(id,url,alt_text,sort_order,is_primary),product_tags(tag)",
      "is_active=eq.true",
    ];

    if (q) {
      const searchTerm = q.replace(/%/g, "").replace(/'/g, "''");
      queryParams.push(`or=(name.ilike.*${searchTerm}*,short_description.ilike.*${searchTerm}*,description.ilike.*${searchTerm}*,sku.ilike.*${searchTerm}*)`);
    }
    if (minPrice) queryParams.push(`price=gte.${minPrice}`);
    if (maxPrice) queryParams.push(`price=lte.${maxPrice}`);
    if (inStock === "true") queryParams.push("stock_quantity=gt.0");

    const allowedSorts: Record<string, string> = {
      relevance: "created_at.desc",
      price_asc: "price.asc",
      price_desc: "price.desc",
      name_asc: "name.asc",
      newest: "created_at.desc",
    };
    queryParams.push(`order=${allowedSorts[sortBy] || "created_at.desc"}`);
    queryParams.push(`limit=${limit}`);
    queryParams.push(`offset=${(page - 1) * limit}`);

    if (categorySlug) {
      const catResult = await fetch(
        `${supabaseUrl}/rest/v1/categories?slug=eq.${categorySlug}&select=id`,
        { headers: authHeaders }
      );
      const cats = await catResult.json();
      if (cats && cats.length > 0) queryParams.push(`category_id=eq.${cats[0].id}`);
    }

    const result = await fetch(
      `${supabaseUrl}/rest/v1/products?${queryParams.join("&")}`,
      {
        headers: {
          ...authHeaders,
          Prefer: "count=exact",
        },
      }
    );

    const products = await result.json();
    const total = parseInt(result.headers.get("content-range")?.split("/")[1] || "0");

    let filtered = products;
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim().toLowerCase());
      filtered = products.filter((p: { product_tags?: { tag: string }[] }) => {
        const pTags = (p.product_tags || []).map((t: { tag: string }) => t.tag.toLowerCase());
        return tagList.some((tag) => pTags.includes(tag));
      });
    }

    const tagsResult = await fetch(
      `${supabaseUrl}/rest/v1/product_tags?select=tag&order=tag.asc`,
      { headers: authHeaders }
    );
    const allTags = await tagsResult.json();
    const uniqueTags = [...new Set(allTags.map((t: { tag: string }) => t.tag))];

    return jsonResponse({
      data: filtered,
      facets: { tags: uniqueTags },
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
