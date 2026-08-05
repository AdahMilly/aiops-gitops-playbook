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
): RootCause[] {
  const causes: RootCause[] = [];

  const cpu = Number.parseFloat(health.cpu);
  const memory = Number.parseFloat(health.memory);

  if (cpu > 80) {
    causes.push({
      title: "High CPU Usage",
      confidence: trends.cpu.trend === "rising" ? 98 : 90,
      recommendation:
        "Inspect recent deployments, expensive requests and hot endpoints.",
    });
  }

  if (memory > 400) {
    causes.push({
      title: "High Memory Usage",
      confidence: trends.memory.trend === "rising" ? 95 : 85,
      recommendation:
        "Inspect heap usage, object retention and restart unhealthy pods.",
    });
  }

  if (trends.memory.trend === "rising" && cpu < 30 && memory > 200) {
    causes.push({
      title: "Possible Memory Leak",
      confidence: 92,
      recommendation:
        "Memory keeps increasing while CPU remains stable. Inspect long-lived objects or caches.",
    });
  }

  if (trends.cpu.trend === "rising" && cpu > 50) {
    causes.push({
      title: "CPU Saturation Trend",
      confidence: 88,
      recommendation:
        "Recent traffic or deployment may be increasing CPU consumption.",
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
        "Inspect repeated errors or stack traces flooding the logs.",
    });
  }

  if (!traces.length) {
    causes.push({
      title: "Tracing Missing",
      confidence: 100,
      recommendation:
        "Verify OpenTelemetry instrumentation and collector connectivity.",
    });
  }

  const slowTrace = traces.find((trace: any) => (trace.durationMs ?? 0) > 5000);

  if (slowTrace) {
    causes.push({
      title: "Slow Request Detected",
      confidence: 90,
      recommendation: `Trace ${slowTrace.traceID} took ${slowTrace.durationMs} ms. Inspect this request in Tempo.`,
    });
  }

  return causes.sort((a, b) => b.confidence - a.confidence);
}
