export interface RootCause {
  title: string;
  confidence: number;
  recommendation: string;
}

export function detectRootCause(
  health: any,
  trends: any,
  logs: any[],
  traces: any[],
  events: any[],
): RootCause[] {
  const causes: RootCause[] = [];

  const cpu = Number.parseFloat(health.cpu);
  const memory = Number.parseFloat(health.memory);

  const livenessFailure = events.find(
    (e: any) =>
      e.reason === "Unhealthy" && e.message?.toLowerCase().includes("liveness"),
  );

  if (livenessFailure) {
    causes.push({
      title: "Liveness Probe Failure",
      confidence: 99,
      recommendation:
        "Application failed Kubernetes liveness checks. Inspect application startup time, HTTP health endpoint, container logs, and recent deployments.",
    });
  }

  const readinessFailure = events.find(
    (e: any) =>
      e.reason === "Unhealthy" &&
      e.message?.toLowerCase().includes("readiness"),
  );

  if (readinessFailure) {
    causes.push({
      title: "Readiness Probe Failure",
      confidence: 98,
      recommendation:
        "Application is not becoming ready. Verify dependencies such as databases, APIs, startup initialization, and readiness endpoint configuration.",
    });
  }

  if (cpu > 80) {
    causes.push({
      title: "High CPU Usage",
      confidence: trends.cpu.trend === "rising" ? 98 : 90,
      recommendation:
        "Inspect expensive requests, hot endpoints, background jobs, and recent deployments.",
    });
  }

  if (memory > 400) {
    causes.push({
      title: "High Memory Usage",
      confidence: trends.memory.trend === "rising" ? 96 : 88,
      recommendation:
        "Inspect heap usage, memory allocations, caches, and restart unhealthy pods if required.",
    });
  }

  if (trends.memory.trend === "rising" && cpu < 30 && memory > 200) {
    causes.push({
      title: "Possible Memory Leak",
      confidence: 92,
      recommendation:
        "Memory continues increasing while CPU remains stable. Investigate object retention, caches, and long-lived sessions.",
    });
  }

  if (trends.cpu.trend === "rising" && cpu > 50) {
    causes.push({
      title: "CPU Saturation Trend",
      confidence: 88,
      recommendation:
        "CPU has been steadily increasing. Investigate workload spikes or inefficient application code.",
    });
  }

  const logCount = logs.reduce(
    (count, stream) => count + (stream.values?.length ?? 0),
    0,
  );

  if (logCount > 100) {
    causes.push({
      title: "Log Explosion",
      confidence: 80,
      recommendation:
        "Large log volume detected. Inspect repeated exceptions or excessive logging.",
    });
  }

  if (!traces.length) {
    causes.push({
      title: "Tracing Missing",
      confidence: 100,
      recommendation:
        "No distributed traces were collected. Verify OpenTelemetry instrumentation and collector connectivity.",
    });
  }

  const slowTrace = traces.find((trace: any) => (trace.durationMs ?? 0) > 5000);

  if (slowTrace) {
    causes.push({
      title: "Slow Request Detected",
      confidence: 90,
      recommendation: `Trace ${slowTrace.traceID} took ${slowTrace.durationMs} ms. Inspect the trace in Tempo to identify latency bottlenecks.`,
    });
  }

  if (causes.length === 0) {
    causes.push({
      title: "No Root Cause Identified",
      confidence: 100,
      recommendation:
        "No infrastructure, application, or Kubernetes issues were detected. Continue monitoring.",
    });
  }

  return causes.sort((a, b) => b.confidence - a.confidence);
}
