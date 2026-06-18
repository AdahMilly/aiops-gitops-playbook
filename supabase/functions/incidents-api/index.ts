import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SERVICE_NAME = "incidents-api";
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
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceKey,
      },
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
  const pathParts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const action = pathParts[1] || null;
  const subAction = pathParts[2] || null;

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
          { method: "GET", path: "/", description: "List incidents with filtering and pagination" },
          { method: "GET", path: "/stats", description: "Incident statistics and metrics" },
          { method: "GET", path: "/:id", description: "Get incident by ID with comments and timeline" },
          { method: "POST", path: "/", description: "Create new incident" },
          { method: "PUT", path: "/:id", description: "Update incident (status, assignment)" },
          { method: "POST", path: "/:id/comments", description: "Add comment to incident" },
          { method: "GET", path: "/health", description: "Health check" },
        ],
        query_params: [
          { name: "status", type: "string", description: "Filter by status (open, investigating, identified, monitoring, resolved, closed)" },
          { name: "severity", type: "string", description: "Filter by severity (low, medium, high, critical)" },
          { name: "assigned_to", type: "uuid", description: "Filter by assigned user ID" },
          { name: "team_id", type: "uuid", description: "Filter by team ID" },
          { name: "sort_by", type: "string", default: "created_at", description: "Sort field" },
          { name: "sort_order", type: "string", default: "desc", description: "Sort direction (asc, desc)" },
        ],
      });
    }

    // ── Statistics ──
    if (action === "stats") {
      const headers = getAuthHeaders(req, serviceKey);

      const [totalRes, openRes, resolvedRes, bySeverityRes, mttrRes, recentRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/incidents?select=id`, { headers: { ...headers, Prefer: "count=exact" } }),
        fetch(`${supabaseUrl}/rest/v1/incidents?select=id&status=in.(open,investigating,identified,monitoring)`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/incidents?select=id&status=in.(resolved,closed)`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/incidents?select=severity`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/rpc/get_mttr`, { headers }).catch(() => null),
        fetch(`${supabaseUrl}/rest/v1/incidents?select=id,title,severity,status,created_at&order=created_at.desc&limit=5`, { headers }),
      ]);

      const total = totalRes.headers.get("content-range")?.split("/")[1] || "0";
      const open = (await openRes.json()).length;
      const resolved = (await resolvedRes.json()).length;
      const allIncidents = await bySeverityRes.json();
      const recent = await recentRes.json();

      const bySeverity = {
        low: allIncidents.filter((i: { severity: string }) => i.severity === "low").length,
        medium: allIncidents.filter((i: { severity: string }) => i.severity === "medium").length,
        high: allIncidents.filter((i: { severity: string }) => i.severity === "high").length,
        critical: allIncidents.filter((i: { severity: string }) => i.severity === "critical").length,
      };

      return jsonResponse({
        total: parseInt(total),
        open,
        resolved,
        by_severity: bySeverity,
        recent,
        mttr_hours: null, // Would need custom SQL function
      });
    }

    // ── List Incidents ──
    if (req.method === "GET" && !action) {
      const headers = getAuthHeaders(req, serviceKey);
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
      const status = url.searchParams.get("status");
      const severity = url.searchParams.get("severity");
      const assignedTo = url.searchParams.get("assigned_to");
      const teamId = url.searchParams.get("team_id");
      const createdBy = url.searchParams.get("created_by");
      const sortBy = url.searchParams.get("sort_by") || "created_at";
      const sortOrder = url.searchParams.get("sort_order") || "desc";
      const search = url.searchParams.get("q");

      const offset = (page - 1) * limit;
      const safeSort = ["created_at", "updated_at", "severity", "status"].includes(sortBy) ? sortBy : "created_at";
      const safeOrder = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

      let query = `${supabaseUrl}/rest/v1/incidents?select=*,profiles!incidents_created_by_fkey(id,name,email),profiles_incidents_assigned_to_fkey(id,name,email),teams(id,name,slug)&order=${safeSort}.${safeOrder}&limit=${limit}&offset=${offset}`;

      if (status) query += `&status=eq.${status}`;
      if (severity) query += `&severity=eq.${severity}`;
      if (assignedTo) query += `&assigned_to=eq.${assignedTo}`;
      if (teamId) query += `&team_id=eq.${teamId}`;
      if (createdBy) query += `&created_by=eq.${createdBy}`;
      if (search) query += `&or=(title.ilike.*${search}*,description.ilike.*${search}*)`;

      const result = await fetch(query, { headers: { ...headers, Prefer: "count=exact" } });
      const incidents = await result.json();
      const contentRange = result.headers.get("content-range");
      const total = contentRange ? parseInt(contentRange.split("/")[1] || "0") : incidents.length;

      return jsonResponse({
        data: incidents,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      });
    }

    // ── Get Single Incident ──
    if (req.method === "GET" && action && !subAction) {
      const headers = getAuthHeaders(req, serviceKey);

      const [incidentRes, commentsRes, timelineRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/incidents?id=eq.${action}&select=*,profiles!incidents_created_by_fkey(id,name,email,avatar_url),profiles_incidents_assigned_to_fkey(id,name,email,avatar_url),teams(id,name,slug)`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/incident_comments?incident_id=eq.${action}&select=*,profiles(id,name,email,avatar_url)&order=created_at.asc`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/incident_timeline?incident_id=eq.${action}&select=*,profiles(id,name,email)&order=created_at.asc`, { headers }),
      ]);

      const incidents = await incidentRes.json();
      if (!incidents || incidents.length === 0) {
        return errorResponse("Incident not found", 404);
      }

      const incident = incidents[0];
      incident.comments = await commentsRes.json();
      incident.timeline = await timelineRes.json();

      return jsonResponse({ data: incident });
    }

    // ── Create Incident ──
    if (req.method === "POST" && !action) {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const body = await req.json();
      const headers = getAuthHeaders(req, serviceKey);

      const incident = {
        title: body.title,
        description: body.description || null,
        severity: body.severity || "medium",
        status: "open",
        created_by: userId,
        assigned_to: body.assigned_to || null,
        team_id: body.team_id || null,
        metadata: body.metadata || {},
      };

      const result = await fetch(`${supabaseUrl}/rest/v1/incidents`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(incident),
      });

      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to create incident", result.status);

      // Create timeline event
      await fetch(`${supabaseUrl}/rest/v1/incident_timeline`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          incident_id: data[0].id,
          event_type: "created",
          description: "Incident created",
          user_id: userId,
        }),
      });

      // Create notification for assigned user
      if (body.assigned_to) {
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: body.assigned_to,
            incident_id: data[0].id,
            type: "incident_assigned",
            title: "New Incident Assigned",
            message: `You have been assigned to "${body.title}"`,
          }),
        });
      }

      return jsonResponse({ data: data[0] }, 201);
    }

    // ── Update Incident ──
    if (req.method === "PUT" && action && !subAction) {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const headers = getAuthHeaders(req, serviceKey);
      const body = await req.json();

      // Get current incident
      const currentRes = await fetch(`${supabaseUrl}/rest/v1/incidents?id=eq.${action}`, { headers });
      const current = (await currentRes.json())[0];
      if (!current) return errorResponse("Incident not found", 404);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const timelineEvents: { event_type: string; description: string }[] = [];

      if (body.status && body.status !== current.status) {
        updates.status = body.status;
        timelineEvents.push({
          event_type: "status_changed",
          description: `Status changed from ${current.status} to ${body.status}`,
        });

        if (body.status === "resolved") {
          updates.resolved_at = new Date().toISOString();
        }
      }

      if (body.assigned_to !== undefined && body.assigned_to !== current.assigned_to) {
        updates.assigned_to = body.assigned_to;
        timelineEvents.push({
          event_type: "assigned",
          description: body.assigned_to ? "Incident reassigned" : "Assignment removed",
        });
      }

      if (body.severity && body.severity !== current.severity) {
        updates.severity = body.severity;
        timelineEvents.push({
          event_type: "severity_changed",
          description: `Severity changed from ${current.severity} to ${body.severity}`,
        });
      }

      if (body.title) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;

      // Update incident
      const result = await fetch(`${supabaseUrl}/rest/v1/incidents?id=eq.${action}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(updates),
      });

      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to update incident", result.status);

      // Create timeline events
      for (const event of timelineEvents) {
        await fetch(`${supabaseUrl}/rest/v1/incident_timeline`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            incident_id: action,
            ...event,
            user_id: userId,
          }),
        });
      }

      // Create audit log
      await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: userId,
          action: "update",
          entity_type: "incident",
          entity_id: action,
          old_values: current,
          new_values: updates,
        }),
      });

      return jsonResponse({ data: data[0] });
    }

    // ── Add Comment ──
    if (req.method === "POST" && action && subAction === "comments") {
      const userId = await getUserId(req, supabaseUrl, serviceKey);
      if (!userId) return errorResponse("Unauthorized", 401);

      const body = await req.json();
      const headers = getAuthHeaders(req, serviceKey);

      const comment = {
        incident_id: action,
        user_id: userId,
        comment: body.comment,
        is_internal: body.is_internal || false,
      };

      const result = await fetch(`${supabaseUrl}/rest/v1/incident_comments`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(comment),
      });

      const data = await result.json();
      if (!result.ok) return errorResponse(data.message || "Failed to add comment", result.status);

      // Create timeline event
      await fetch(`${supabaseUrl}/rest/v1/incident_timeline`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          incident_id: action,
          event_type: "comment_added",
          description: "Comment added",
          user_id: userId,
        }),
      });

      return jsonResponse({ data: data[0] }, 201);
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
