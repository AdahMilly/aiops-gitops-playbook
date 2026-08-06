export interface Telemetry {
  timestamp: string;
  service: string;
  metrics: {
    cpu: number;
    memory: number;
  };
  logs: any[];
  traces: any[];
  events?: any[];
}

export interface HealthReport {
  cpu: string;
  memory: string;

  healthy: boolean;

  applicationHealthy: boolean;
  kubernetesHealthy: boolean;

  findings: string[];
}

export function analyze(telemetry: Telemetry): HealthReport {
  const cpuUsage = telemetry.metrics.cpu * 100;
  const memoryMB = telemetry.metrics.memory / 1024 / 1024;

  const findings: string[] = [];

  let applicationHealthy = true;
  let kubernetesHealthy = true;

  if (cpuUsage > 80) {
    findings.push("High CPU usage");
  }

  if (memoryMB > 400) {
    findings.push("High memory usage");
  }

  const events = telemetry.events ?? [];

  for (const event of events) {
    const message = (event.message ?? "").toLowerCase();
    const reason = (event.reason ?? "").toLowerCase();

    if (
      message.includes("liveness probe failed") ||
      message.includes("readiness probe failed")
    ) {
      applicationHealthy = false;
      findings.push(event.message);
    }

    if (
      reason.includes("crashloopbackoff") ||
      message.includes("crashloopbackoff")
    ) {
      applicationHealthy = false;
      findings.push("Pod is CrashLoopBackOff");
    }

    if (reason.includes("oomkilled") || message.includes("oomkilled")) {
      applicationHealthy = false;
      findings.push("Container OOMKilled");
    }

    if (
      reason.includes("nodenotready") ||
      message.includes("node is not ready")
    ) {
      kubernetesHealthy = false;
      findings.push("Cluster node is not ready");
    }

    if (
      reason.includes("failedscheduling") ||
      message.includes("failed scheduling")
    ) {
      kubernetesHealthy = false;
      findings.push("Pod scheduling failure");
    }

    if (
      message.includes("imagepullbackoff") ||
      message.includes("errimagepull")
    ) {
      applicationHealthy = false;
      findings.push("Container image pull failed");
    }
  }

  const infrastructureHealthy = cpuUsage <= 80 && memoryMB <= 400;

  const healthy =
    infrastructureHealthy && applicationHealthy && kubernetesHealthy;

  return {
    cpu: `${cpuUsage.toFixed(2)} %`,
    memory: `${memoryMB.toFixed(2)} MB`,

    healthy,

    applicationHealthy,

    kubernetesHealthy,

    findings: [...new Set(findings)],
  };
}
