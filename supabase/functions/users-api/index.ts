import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICE_NAME = "users-api";
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

function getAuthHeaders(req: Request, serviceKey: string) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${token || serviceKey}`,
    "Content-Type": "application/json",
  };
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

async function isAdmin(userId: string, supabaseUrl: string, headers: Record<string, string>): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=role`, { headers });
  const data = await res.json();
  return data[0]?.role === "admin";
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

  try {
    // ── Health Check ──
    if (action === "health") {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      return jsonResponse({
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        status: "healthy",
        uptime_seconds: uptime,
        endpoints: [
          { method: "GET", path: "/", description: "List users (admin only)" },
          { method: "GET", path: "/me", description: "Get current user profile" },
          { method: "GET", path: "/:id", description: "Get user by ID" },
          { method: "PUT", path: "/:id", description: "Update user profile" },
          { method: "GET", path: "/teams", description: "List all teams" },
          { method: "POST", path: "/teams", description: "Create team (admin only)" },
          { method: "GET", path: "/health", description: "Health check" },
        ],
      });
    }

    // ── List Teams ──
    if (action === "teams") {
      const headers = getAuthHeaders(req, serviceKey);
      const result = await fetch(`${supabaseUrl}/rest/v1/teams?select=*,profiles(count)&order=name.asc`, { headers });
      const teams = await result.json();
      return jsonResponse({ data: teams });
    }

    // ── Create Team ──
    if (req.method === "POST" && action === "teams") {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      const admin = await isAdmin(userId, supabaseUrl, headers);
      if (!admin) return errorResponse("Forbidden: Admin only", 403);

      const body = await req.json();
      const result = await fetch(`${supabaseUrl}/rest/v1/teams`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          name: body.name,
          slug: body.slug || body.name.toLowerCase().replace(/\s+/g, "-"),
          description: body.description,
        }),
      });

      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to create team", result.status);
      return jsonResponse({ data: data[0] }, 201);
    }

    // ── Get Current User ──
    if (action === "me") {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      const result = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*,teams(id,name,slug)`, { headers });
      const users = await result.json();

      if (!users || users.length === 0) {
        return errorResponse("Profile not found", 404);
      }

      return jsonResponse({ data: users[0] });
    }

    // ── List Users ──
    if (req.method === "GET" && !action) {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      const admin = await isAdmin(userId, supabaseUrl, headers);
      if (!admin) return errorResponse("Forbidden: Admin only", 403);

      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const offset = (page - 1) * limit;
      const role = url.searchParams.get("role");
      const teamId = url.searchParams.get("team_id");

      let query = `${supabaseUrl}/rest/v1/profiles?select=*,teams(id,name,slug)&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (role) query += `&role=eq.${role}`;
      if (teamId) query += `&team_id=eq.${teamId}`;

      const result = await fetch(query, { headers: { ...headers, Prefer: "count=exact" } });
      const users = await result.json();
      const contentRange = result.headers.get("content-range");
      const total = contentRange ? parseInt(contentRange.split("/")[1] || "0") : users.length;

      return jsonResponse({
        data: users,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      });
    }

    // ── Get Single User ──
    if (req.method === "GET" && action) {
      const headers = getAuthHeaders(req, serviceKey);
      const result = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${action}&select=*,teams(id,name,slug)`, { headers });
      const users = await result.json();
      if (!users || users.length === 0) {
        return errorResponse("User not found", 404);
      }
      return jsonResponse({ data: users[0] });
    }

    // ── Update User ──
    if (req.method === "PUT" && action) {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      const admin = await isAdmin(userId, supabaseUrl, headers);

      // Only admin or the user themselves can update
      if (action !== userId && !admin) {
        return errorResponse("Forbidden", 403);
      }

      const body = await req.json();
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.name) updates.name = body.name;
      if (body.avatar_url) updates.avatar_url = body.avatar_url;

      // Only admins can change role and team
      if (admin) {
        if (body.role) updates.role = body.role;
        if (body.team_id !== undefined) updates.team_id = body.team_id;
        if (body.is_active !== undefined) updates.is_active = body.is_active;
      }

      const result = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${action}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(updates),
      });

      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to update user", result.status);
      return jsonResponse({ data: data[0] });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
