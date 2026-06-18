// ── Domain Types ─────────────────────────────────────────────────────

export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "identified" | "monitoring" | "resolved" | "closed";
export type UserRole = "admin" | "engineer" | "viewer";
export type NotificationType = "incident_created" | "incident_assigned" | "incident_updated" | "incident_resolved" | "comment_added";

// ── User ──────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  team_id?: string;
  team?: Team;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Incident ──────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: Severity;
  status: IncidentStatus;
  created_by: string;
  assigned_to?: string;
  team_id?: string;
  resolved_at?: string;
  acknowledged_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  profiles?: User;
  profiles_incidents_assigned_to_fkey?: User;
  teams?: Team;
  comments?: IncidentComment[];
  timeline?: IncidentTimelineEvent[];
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  profiles?: User;
}

export interface IncidentTimelineEvent {
  id: string;
  incident_id: string;
  event_type: string;
  description: string;
  user_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: User;
}

// ── Notification ───────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  incident_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  incidents?: { id: string; title: string; severity: Severity; status: IncidentStatus };
}

// ── Audit Log ──────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  profiles?: User;
}

// ── API Response Types ──────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface IncidentStats {
  total: number;
  open: number;
  resolved: number;
  by_severity: Record<Severity, number>;
  recent: Incident[];
  mttr_hours?: number;
}

// ── Filter Types ────────────────────────────────────────────────────────

export interface IncidentFilters {
  page?: number;
  limit?: number;
  status?: IncidentStatus;
  severity?: Severity;
  assigned_to?: string;
  team_id?: string;
  created_by?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  q?: string;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  role?: UserRole;
  team_id?: string;
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  unread_only?: boolean;
}
