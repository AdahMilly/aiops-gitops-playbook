import { IncidentLifecycleResult } from "../analyzers/incidentLifecycle";

export type SystemHealthLevel = "Healthy" | "Warning" | "Critical";

export interface FinalHealthState {
  healthy: boolean;
  level: SystemHealthLevel;
  reason: string;
  activeIncidentCount: number;
}

export function reconcileHealthState(
  currentHealthy: boolean,
  currentLevel: SystemHealthLevel,
  lifecycle: IncidentLifecycleResult,
): FinalHealthState {
  const activeIncidents = lifecycle.activeIncidents ?? [];

  if (activeIncidents.length === 0) {
    return {
      healthy: currentHealthy,
      level: currentLevel,
      reason: currentHealthy
        ? "No active incidents detected."
        : "Current telemetry indicates an unhealthy system.",
      activeIncidentCount: 0,
    };
  }

  const hasCriticalIncident = activeIncidents.some(
    (incident) => incident.severity === "Critical",
  );

  if (hasCriticalIncident) {
    return {
      healthy: false,
      level: "Critical",
      reason: "One or more critical incidents are currently active.",
      activeIncidentCount: activeIncidents.length,
    };
  }

  const hasHighIncident = activeIncidents.some(
    (incident) => incident.severity === "High",
  );

  if (hasHighIncident) {
    return {
      healthy: false,
      level: "Warning",
      reason: "One or more high-severity incidents are currently active.",
      activeIncidentCount: activeIncidents.length,
    };
  }

  return {
    healthy: false,
    level: "Warning",
    reason: "Active incidents require attention.",
    activeIncidentCount: activeIncidents.length,
  };
}
