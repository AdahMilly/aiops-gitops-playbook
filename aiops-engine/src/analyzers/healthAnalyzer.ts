interface Telemetry {
  timestamp: string;
  service: string;
  metrics: {
    cpu: number;
    memory: number;
  };
  logs: any[];
  traces: any[];
}

export function analyze(telemetry: Telemetry) {
  const cpuUsage = telemetry.metrics.cpu * 100;
  const memoryMB = telemetry.metrics.memory / 1024 / 1024;

  const findings: string[] = [];

  if (cpuUsage > 80) findings.push("High CPU usage");

  if (memoryMB > 400) findings.push("High memory usage");

  return {
    cpu: `${cpuUsage.toFixed(2)} %`,
    memory: `${memoryMB.toFixed(2)} MB`,
    healthy: findings.length === 0,
    findings,
  };
}
