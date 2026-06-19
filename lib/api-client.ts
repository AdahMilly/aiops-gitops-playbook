import { supabase } from "./supabase";
import {
  Incident,
  IncidentComment,
  User,
  Team,
  Notification,
  AuditLog,
  IncidentStats,
  IncidentFilters,
  UserFilters,
  NotificationFilters,
  PaginatedResponse,
} from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const INCIDENTS_API_URL = `${FUNCTIONS_URL}/incidents-api`;
const USERS_API_URL = `${FUNCTIONS_URL}/users-api`;
const NOTIFICATIONS_API_URL = `${FUNCTIONS_URL}/notifications-api`;

const SERVICE_ROUTES = [
  {
    prefix: "/incidents",
    service: "incidents-api",
    description: "Incident lifecycle management, comments, timeline",
    url: INCIDENTS_API_URL,
  },
  {
    prefix: "/users",
    service: "users-api",
    description: "User profiles, roles, team management",
    url: USERS_API_URL,
  },
  {
    prefix: "/notifications",
    service: "notifications-api",
    description: "Notification center, alerts, webhooks",
    url: NOTIFICATIONS_API_URL,
  },
];

async function getHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(url, {
    ...options,
    headers,
  });
  if (!res.ok) {
    throw await apiError(res);
  }
  return res.json();
}

async function apiError(res: Response): Promise<Error> {
  const fallback = `API error: ${res.status}`;
  const text = await res.text().catch(() => "");

  if (!text) return new Error(fallback);

  try {
    const err = JSON.parse(text);
    return new Error(err.error || err.message || fallback);
  } catch {
    return new Error(text || fallback);
  }
}

function buildQueryString(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function normalizePaginatedResponse<T>(
  response: PaginatedResponse<T> | { data?: unknown; pagination?: unknown },
  fallbackLimit = 20,
): PaginatedResponse<T> {
  const data = Array.isArray(response.data) ? response.data as T[] : [];
  const fallbackPagination = {
    page: 1,
    limit: fallbackLimit,
    total: data.length,
    total_pages: data.length > 0 ? 1 : 0,
  };

  return {
    data,
    pagination: response.pagination && typeof response.pagination === "object"
      ? response.pagination as PaginatedResponse<T>["pagination"]
      : fallbackPagination,
  };
}

export async function getIncidents(
  filters: IncidentFilters = {},
): Promise<PaginatedResponse<Incident>> {
  const res = await fetchJSON<PaginatedResponse<Incident> | { data?: unknown; pagination?: unknown }>(
    `${INCIDENTS_API_URL}${buildQueryString(filters as Record<string, unknown>)}`,
  );
  return normalizePaginatedResponse<Incident>(res, filters.limit);
}

export async function getIncident(id: string): Promise<{ data: Incident }> {
  return fetchJSON(`${INCIDENTS_API_URL}/${id}`);
}

export async function getIncidentStats(): Promise<IncidentStats> {
  return fetchJSON(`${INCIDENTS_API_URL}/stats`);
}

export async function createIncident(data: {
  title: string;
  description?: string;
  severity?: string;
  assigned_to?: string;
  team_id?: string;
}): Promise<{ data: Incident }> {
  return fetchJSON(`${INCIDENTS_API_URL}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateIncident(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    severity: string;
    status: string;
    assigned_to: string | null;
  }>,
): Promise<{ data: Incident }> {
  return fetchJSON(`${INCIDENTS_API_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function addIncidentComment(
  incidentId: string,
  comment: string,
  isInternal = false,
): Promise<{ data: IncidentComment }> {
  return fetchJSON(`${INCIDENTS_API_URL}/${incidentId}/comments`, {
    method: "POST",
    body: JSON.stringify({ comment, is_internal: isInternal }),
  });
}

export async function getCurrentUser(): Promise<{ data: User }> {
  return fetchJSON(`${USERS_API_URL}/me`);
}

export async function getUsers(
  filters: UserFilters = {},
): Promise<PaginatedResponse<User>> {
  const res = await fetchJSON<PaginatedResponse<User> | { data?: unknown; pagination?: unknown }>(
    `${USERS_API_URL}${buildQueryString(filters as Record<string, unknown>)}`,
  );
  return normalizePaginatedResponse<User>(res, filters.limit);
}

export async function getUser(id: string): Promise<{ data: User }> {
  return fetchJSON(`${USERS_API_URL}/${id}`);
}

export async function updateUser(
  id: string,
  data: Partial<{
    name: string;
    avatar_url: string;
    role: string;
    team_id: string | null;
  }>,
): Promise<{ data: User }> {
  return fetchJSON(`${USERS_API_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getTeams(): Promise<{ data: Team[] }> {
  const res = await fetchJSON<{ data: unknown }>(`${USERS_API_URL}/teams`);
  return { data: Array.isArray(res.data) ? res.data as Team[] : [] };
}

export async function createTeam(data: {
  name: string;
  slug?: string;
  description?: string;
}): Promise<{ data: Team }> {
  return fetchJSON(`${USERS_API_URL}/teams`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getNotifications(
  filters: NotificationFilters = {},
): Promise<PaginatedResponse<Notification>> {
  const res = await fetchJSON<PaginatedResponse<Notification> | { data?: unknown; pagination?: unknown }>(
    `${NOTIFICATIONS_API_URL}${buildQueryString(filters as Record<string, unknown>)}`,
  );
  return normalizePaginatedResponse<Notification>(res, filters.limit);
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return fetchJSON(`${NOTIFICATIONS_API_URL}/unread`);
}

export async function markNotificationRead(
  id: string,
): Promise<{ success: boolean }> {
  return fetchJSON(`${NOTIFICATIONS_API_URL}/${id}/read`, {
    method: "PUT",
  });
}

export async function markAllRead(): Promise<{ success: boolean }> {
  return fetchJSON(`${NOTIFICATIONS_API_URL}/read-all`, {
    method: "PUT",
  });
}

export async function deleteNotification(
  id: string,
): Promise<{ deleted: boolean }> {
  return fetchJSON(`${NOTIFICATIONS_API_URL}/${id}`, {
    method: "DELETE",
  });
}

export async function getServiceInfo(): Promise<{
  architecture: string;
  version: string;
  routes: { prefix: string; service: string; description: string; url: string }[];
}> {
  return {
    architecture: "direct-edge-functions",
    version: "1.0.0",
    routes: SERVICE_ROUTES,
  };
}

export async function getServiceHealth(): Promise<{
  architecture: string;
  status: string;
  services: { service: string; prefix: string; status: string; latency_ms: number }[];
}> {
  const checks = await Promise.all(
    SERVICE_ROUTES.map(async (route) => {
      const start = performance.now();
      try {
        await fetchJSON(`${route.url}/health`);
        return {
          service: route.service,
          prefix: route.prefix,
          status: "healthy",
          latency_ms: Math.round(performance.now() - start),
        };
      } catch {
        return {
          service: route.service,
          prefix: route.prefix,
          status: "unhealthy",
          latency_ms: Math.round(performance.now() - start),
        };
      }
    }),
  );

  const allHealthy = checks.every((check) => check.status === "healthy");
  return {
    architecture: "direct-edge-functions",
    status: allHealthy ? "healthy" : "degraded",
    services: checks,
  };
}
