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
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/api-gateway`;

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
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
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
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

// ── Incidents API ─────────────────────────────────────────────────────

export async function getIncidents(
  filters: IncidentFilters = {}
): Promise<PaginatedResponse<Incident>> {
  return fetchJSON(`${GATEWAY_URL}/incidents${buildQueryString(filters as Record<string, unknown>)}`);
}

export async function getIncident(id: string): Promise<{ data: Incident }> {
  return fetchJSON(`${GATEWAY_URL}/incidents/${id}`);
}

export async function getIncidentStats(): Promise<IncidentStats> {
  return fetchJSON(`${GATEWAY_URL}/incidents/stats`);
}

export async function createIncident(data: {
  title: string;
  description?: string;
  severity?: string;
  assigned_to?: string;
  team_id?: string;
}): Promise<{ data: Incident }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/incidents`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function updateIncident(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    severity: string;
    status: string;
    assigned_to: string | null;
  }>
): Promise<{ data: Incident }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/incidents/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function addIncidentComment(
  incidentId: string,
  comment: string,
  isInternal = false
): Promise<{ data: IncidentComment }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/incidents/${incidentId}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ comment, is_internal: isInternal }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Users API ──────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<{ data: User }> {
  return fetchJSON(`${GATEWAY_URL}/users/me`);
}

export async function getUsers(
  filters: UserFilters = {}
): Promise<PaginatedResponse<User>> {
  return fetchJSON(`${GATEWAY_URL}/users${buildQueryString(filters as Record<string, unknown>)}`);
}

export async function getUser(id: string): Promise<{ data: User }> {
  return fetchJSON(`${GATEWAY_URL}/users/${id}`);
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; avatar_url: string; role: string; team_id: string | null }>
): Promise<{ data: User }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/users/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Teams API ──────────────────────────────────────────────────────────

export async function getTeams(): Promise<{ data: Team[] }> {
  return fetchJSON(`${GATEWAY_URL}/users/teams`);
}

export async function createTeam(data: {
  name: string;
  slug?: string;
  description?: string;
}): Promise<{ data: Team }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/users/teams`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Notifications API ──────────────────────────────────────────────────

export async function getNotifications(
  filters: NotificationFilters = {}
): Promise<PaginatedResponse<Notification>> {
  return fetchJSON(`${GATEWAY_URL}/notifications${buildQueryString(filters as Record<string, unknown>)}`);
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return fetchJSON(`${GATEWAY_URL}/notifications/unread`);
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/notifications/${id}/read`, { method: "PUT", headers });
  if (!res.ok) throw new Error("Failed to mark read");
  return res.json();
}

export async function markAllRead(): Promise<{ success: boolean }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/notifications/read-all`, { method: "PUT", headers });
  if (!res.ok) throw new Error("Failed to mark all read");
  return res.json();
}

export async function deleteNotification(id: string): Promise<{ deleted: boolean }> {
  const headers = await getHeaders();
  const res = await fetch(`${GATEWAY_URL}/notifications/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete notification");
  return res.json();
}

// ── Health & Gateway ──────────────────────────────────────────────────

export async function getGatewayInfo(): Promise<{
  gateway: string;
  version: string;
  routes: { prefix: string; service: string; description: string }[];
}> {
  return fetchJSON(`${GATEWAY_URL}/`);
}

export async function getGatewayHealth(): Promise<{
  gateway: string;
  status: string;
  services: { service: string; status: string; latency_ms: number }[];
}> {
  return fetchJSON(`${GATEWAY_URL}/health`);
}
