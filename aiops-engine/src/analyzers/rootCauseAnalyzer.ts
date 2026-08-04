export interface RootCause {
  title: string;
  confidence: number;
  recommendation: string;
}

export function detectRootCause(
  health: any,
  logs: any[],
  traces: any[],
): RootCause[] {
  const causes: RootCause[] = [];

  if (Number.parseFloat(health.cpu) > 80) {
    causes.push({
      title: "High CPU Usage",
      confidence: 95,
      recommendation:
        "Inspect recent deployments and identify CPU-intensive endpoints.",
    });
  }

  if (Number.parseFloat(health.memory) > 400) {
    causes.push({
      title: "Memory Leak",
      confidence: 92,
      recommendation: "Check heap usage and restart unhealthy pods.",
    });
  }

  if (logs.length > 100) {
    causes.push({
      title: "Log Explosion",
      confidence: 80,
      recommendation: "Investigate repetitive error messages.",
    });
  }

  if (traces.length === 0) {
    causes.push({
      title: "Tracing Missing",
      confidence: 100,
      recommendation: "Verify OpenTelemetry instrumentation.",
    });
  }

  return causes;
}
