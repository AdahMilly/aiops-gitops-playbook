export const ISSUE_ALIASES: Record<string, string> = {
  NodeNotReady: "Cluster node unavailable",

  "Cluster node unavailable": "Cluster node unavailable",

  Unhealthy: "Application unavailable",

  "Readiness Probe Failure": "Application unavailable",

  "Liveness Probe Failure": "Application unavailable",

  "Readiness timeout": "Application unavailable",

  "Liveness timeout": "Application unavailable",

  "Tracing Missing": "Tracing unavailable",

  "No recent traces returned by Tempo": "Tracing unavailable",

  "CPU Saturation Trend": "High CPU Usage",

  "Possible Memory Leak": "Memory Leak",
};
