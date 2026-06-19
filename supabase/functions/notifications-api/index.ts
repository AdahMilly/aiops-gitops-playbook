import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICE_NAME = "notifications-api";
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

function getAuthHeaders(_req: Request, serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

function getRouteParts(url: URL): string[] {
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const functionNameIndex = parts.indexOf(SERVICE_NAME);
  return functionNameIndex >= 0 ? parts.slice(functionNameIndex + 1) : parts;
}

async function getUserId(req: Request, supabaseUrl: string, serviceKey: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user.id;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = getRouteParts(url);
  const action = pathParts[0] || null;
  const notificationId = pathParts[1] || null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    if (action === "health") {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      return jsonResponse({
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        status: "healthy",
        uptime_seconds: uptime,
        endpoints: [
          { method: "GET", path: "/", description: "List current user's notifications" },
          { method: "GET", path: "/unread", description: "Count unread notifications" },
          { method: "PUT", path: "/:id/read", description: "Mark notification as read" },
          { method: "PUT", path: "/read-all", description: "Mark all notifications as read" },
          { method: "DELETE", path: "/:id", description: "Delete notification" },
          { method: "GET", path: "/health", description: "Health check" },
        ],
      });
    }

    if (action === "unread") {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      const result = await fetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${userId}&is_read=eq.false&select=id`, { headers });
      const notifications = await result.json();

      return jsonResponse({ count: notifications.length });
    }

    if (req.method === "PUT" && action === "read-all") {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      await fetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${userId}&is_read=eq.false`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_read: true }),
      });

      return jsonResponse({ success: true });
    }
    if (req.method === "PUT" && action && notificationId === "read") {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${action}&user_id=eq.${userId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_read: true }),
      });

      return jsonResponse({ success: true });
    }
    if (req.method === "GET" && !action) {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
      const unreadOnly = url.searchParams.get("unread_only") === "true";

      const offset = (page - 1) * limit;
      let query = `${supabaseUrl}/rest/v1/notifications?user_id=eq.${userId}&select=*,incidents(id,title,severity,status)&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (unreadOnly) query += "&is_read=eq.false";

      const result = await fetch(query, { headers: { ...headers, Prefer: "count=exact" } });
      const notifications = await result.json();
      const contentRange = result.headers.get("content-range");
      const total = contentRange ? parseInt(contentRange.split("/")[1] || "0") : notifications.length;

      return jsonResponse({
        data: notifications,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      });
    }
    if (req.method === "DELETE" && action) {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${action}&user_id=eq.${userId}`, {
        method: "DELETE",
        headers,
      });

      return jsonResponse({ deleted: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
