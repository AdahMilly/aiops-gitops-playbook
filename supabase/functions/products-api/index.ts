import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICE_NAME = "products-api";
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
    // ── Health Check ──
    if (slug === "health") {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      // Quick DB ping
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
        },
        endpoints: [
          { method: "GET", path: "/", description: "List products with filtering and pagination" },
          { method: "GET", path: "/:slug", description: "Get product by slug" },
          { method: "GET", path: "/health", description: "Health check" },
          { method: "GET", path: "/stats", description: "Product statistics" },
          { method: "POST", path: "/", description: "Create product (auth required)" },
          { method: "PUT", path: "/:slug", description: "Update product (auth required)" },
          { method: "DELETE", path: "/:slug", description: "Delete product (auth required)" },
        ],
        query_params: [
          { name: "page", type: "number", default: 1, description: "Page number" },
          { name: "limit", type: "number", default: 12, description: "Items per page (max 50)" },
          { name: "category", type: "string", description: "Filter by category slug" },
          { name: "category_id", type: "uuid", description: "Filter by category ID" },
          { name: "featured", type: "boolean", description: "Filter featured products" },
          { name: "min_price", type: "number", description: "Minimum price filter" },
          { name: "max_price", type: "number", description: "Maximum price filter" },
          { name: "sort_by", type: "string", default: "created_at", description: "Sort field (created_at, price, name, stock_quantity)" },
          { name: "sort_order", type: "string", default: "desc", description: "Sort direction (asc, desc)" },
        ],
      });
    }

    // ── Stats ──
    if (slug === "stats") {
      const [totalRes, featuredRes, outOfStockRes, avgPriceRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/products?select=id&is_active=eq.true`, { headers: { ...authHeaders, Prefer: "count=exact" } }),
        fetch(`${supabaseUrl}/rest/v1/products?select=id&is_active=eq.true&is_featured=eq.true`, { headers: authHeaders }),
        fetch(`${supabaseUrl}/rest/v1/products?select=id&is_active=eq.true&stock_quantity=eq.0`, { headers: authHeaders }),
        fetch(`${supabaseUrl}/rest/v1/rpc/get_avg_price`, { headers: authHeaders }).catch(() => null),
      ]);

      const total = totalRes.headers.get("content-range")?.split("/")[1] || "0";
      const featured = (await featuredRes.json()).length;
      const outOfStock = (await outOfStockRes.json()).length;

      return jsonResponse({
        service: SERVICE_NAME,
        total_products: parseInt(total),
        featured_products: featured,
        out_of_stock: outOfStock,
      });
    }

    // ── GET /products - List products with filtering ──
    if (req.method === "GET" && !slug) {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "12"), 50);
      const categoryId = url.searchParams.get("category_id");
      const categorySlug = url.searchParams.get("category");
      const featured = url.searchParams.get("featured");
      const minPrice = url.searchParams.get("min_price");
      const maxPrice = url.searchParams.get("max_price");
      const sortBy = url.searchParams.get("sort_by") || "created_at";
      const sortOrder = url.searchParams.get("sort_order") || "desc";

      const offset = (page - 1) * limit;

      let resolvedCategoryId = categoryId;
      if (categorySlug && !categoryId) {
        const catRes = await fetch(
          `${supabaseUrl}/rest/v1/categories?slug=eq.${categorySlug}&select=id`,
          { headers: authHeaders }
        );
        const cats = await catRes.json();
        if (cats && cats.length > 0) resolvedCategoryId = cats[0].id;
      }

      const allowedSorts = ["created_at", "price", "name", "stock_quantity"];
      const safeSort = allowedSorts.includes(sortBy) ? sortBy : "created_at";
      const safeOrder = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

      let postgrestQuery = `select=*,categories(id,name,slug),product_images(id,url,alt_text,sort_order,is_primary),product_tags(tag)&is_active=eq.true&order=${safeSort}.${safeOrder}&limit=${limit}&offset=${offset}`;
      if (resolvedCategoryId) postgrestQuery += `&category_id=eq.${resolvedCategoryId}`;
      if (featured === "true") postgrestQuery += `&is_featured=eq.true`;
      if (minPrice) postgrestQuery += `&price=gte.${minPrice}`;
      if (maxPrice) postgrestQuery += `&price=lte.${maxPrice}`;

      const result = await fetch(
        `${supabaseUrl}/rest/v1/products?${postgrestQuery}`,
        { headers: { ...authHeaders, Prefer: "count=exact" } }
      );

      const products = await result.json();
      const contentRange = result.headers.get("content-range");
      const total = contentRange ? parseInt(contentRange.split("/")[1] || "0") : products.length;

      return jsonResponse({
        data: products,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      });
    }

    // ── GET /products/:slug ──
    if (req.method === "GET" && slug) {
      const result = await fetch(
        `${supabaseUrl}/rest/v1/products?slug=eq.${slug}&select=*,categories(id,name,slug,description),product_images(id,url,alt_text,sort_order,is_primary),product_tags(tag)`,
        { headers: authHeaders }
      );
      const products = await result.json();
      if (!products || products.length === 0) return errorResponse("Product not found", 404);
      return jsonResponse({ data: products[0] });
    }

    // ── POST /products ──
    if (req.method === "POST" && !slug) {
      const body = await req.json();
      const result = await fetch(`${supabaseUrl}/rest/v1/products`, {
        method: "POST",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to create product", result.status);
      return jsonResponse({ data: data[0] }, 201);
    }

    // ── PUT /products/:slug ──
    if (req.method === "PUT" && slug) {
      const body = await req.json();
      const result = await fetch(`${supabaseUrl}/rest/v1/products?slug=eq.${slug}`, {
        method: "PATCH",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to update product", result.status);
      return jsonResponse({ data: data[0] });
    }

    // ── DELETE /products/:slug ──
    if (req.method === "DELETE" && slug) {
      await fetch(`${supabaseUrl}/rest/v1/products?slug=eq.${slug}`, {
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
