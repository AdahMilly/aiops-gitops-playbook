export interface TelemetryEvent {
  timestamp?: string | Date;
  time?: string | Date;
  lastTimestamp?: string | Date;
  reason?: string;
  message?: string;
  type?: string;
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  metadata?: {
    name?: string;
    namespace?: string;
  };
}

export interface CurrentKubernetesState {
  nodeReady?: boolean;
  pods?: Array<{
    name: string;
    namespace?: string;
    ready: boolean;
    phase?: string;
    restartCount?: number;
  }>;
}

export interface Telemetry {
  timestamp: string;
  service: string;
  metrics: {
    cpu: number;
    memory: number;
  };
  logs: any[];
  traces: any[];
  events?: TelemetryEvent[];
  kubernetes?: CurrentKubernetesState;
}

export type FindingStatus = "Active" | "Historical";

export type FindingSeverity = "Low" | "Medium" | "High" | "Critical";
export interface DetailedFinding {
  issue: string;
  severity: FindingSeverity;
  status: FindingStatus;
  source: "Kubernetes" | "Application" | "Metrics" | "Analysis";
  evidence: string[];
  timestamp?: string;
}

export type HealthStatus = "Healthy" | "Degraded" | "Incident";
export interface HealthReport {
  cpu: string;
  memory: string;
  healthy: boolean;
  status: HealthStatus;
  applicationHealthy: boolean;
  kubernetesHealthy: boolean;
  findings: string[];
  detailedFindings: DetailedFinding[];
}

const CPU_WARNING_THRESHOLD = 80;

const MEMORY_WARNING_THRESHOLD_MB = 400;

export function analyze(telemetry: Telemetry): HealthReport {
  const cpuUsage = normalizeCpuUsage(telemetry.metrics.cpu);

  const memoryMB = telemetry.metrics.memory / 1024 / 1024;

  const findings: string[] = [];

  const detailedFindings: DetailedFinding[] = [];

  let applicationHealthy = true;

  let kubernetesHealthy = true;

  if (cpuUsage > CPU_WARNING_THRESHOLD) {
    findings.push("High CPU usage");

    detailedFindings.push({
      issue: "HighCPU",
      severity: cpuUsage > 95 ? "Critical" : "High",
      status: "Active",
      source: "Metrics",
      evidence: [`CPU usage is ${cpuUsage.toFixed(2)}%`],
      timestamp: telemetry.timestamp,
    });
  }

  if (memoryMB > MEMORY_WARNING_THRESHOLD_MB) {
    findings.push("High memory usage");
    detailedFindings.push({
      issue: "HighMemory",
      severity: memoryMB > 500 ? "Critical" : "High",
      status: "Active",
      source: "Metrics",
      evidence: [`Memory usage is ${memoryMB.toFixed(2)} MB`],
      timestamp: telemetry.timestamp,
    });
  }

  const kubernetes = telemetry.kubernetes;

  if (kubernetes?.nodeReady === false) {
    kubernetesHealthy = false;
    findings.push("Kubernetes node is not ready");
    detailedFindings.push({
      issue: "NodeNotReady",
      severity: "High",
      status: "Active",
      source: "Kubernetes",
      evidence: ["Kubernetes node is currently NotReady"],
      timestamp: telemetry.timestamp,
    });
  }

  if (kubernetes?.pods) {
    for (const pod of kubernetes.pods) {
      if (pod.ready) {
        continue;
      }
      applicationHealthy = false;
      findings.push(`Pod ${pod.name} is not ready`);
      const evidence: string[] = [`Pod ${pod.name} is not ready`];
      if (pod.phase) {
        evidence.push(`Pod phase: ${pod.phase}`);
      }
      if (pod.restartCount !== undefined) {
        evidence.push(`Restart count: ${pod.restartCount}`);
      }
      detailedFindings.push({
        issue: "PodNotReady",
        severity: "High",
        status: "Active",
        source: "Application",
        evidence,
        timestamp: telemetry.timestamp,
      });
    }
  }

  const events = telemetry.events ?? [];

  for (const event of events) {
    const message = String(event.message ?? "").trim();

    const reason = String(event.reason ?? "").trim();

    const normalizedMessage = message.toLowerCase();

    const normalizedReason = reason.toLowerCase();

    const eventTimestamp =
      event.timestamp ??
      event.time ??
      event.lastTimestamp ??
      telemetry.timestamp;

    const timestamp =
      eventTimestamp instanceof Date
        ? eventTimestamp.toISOString()
        : String(eventTimestamp);
    if (
      normalizedMessage.includes("readiness probe failed") ||
      (normalizedReason.includes("unhealthy") &&
        normalizedMessage.includes("readiness"))
    ) {
      applicationHealthy = false;

      const eventMessage = message || "Kubernetes readiness probe failed";

      findings.push("Application readiness probe failed");

      detailedFindings.push({
        issue: "ReadinessProbeFailure",
        severity: "High",
        status: "Active",
        source: "Application",
        evidence: [eventMessage],
        timestamp,
      });

      continue;
    }

    if (normalizedMessage.includes("liveness probe failed")) {
      applicationHealthy = false;

      const eventMessage = message || "Kubernetes liveness probe failed";

      findings.push("Application liveness probe failed");

      detailedFindings.push({
        issue: "LivenessProbeFailure",
        severity: "High",
        status: "Active",
        source: "Application",
        evidence: [eventMessage],
        timestamp,
      });
      continue;
    }

    if (
      normalizedReason.includes("crashloopbackoff") ||
      normalizedMessage.includes("crashloopbackoff")
    ) {
      applicationHealthy = false;
      findings.push("Pod is CrashLoopBackOff");
      detailedFindings.push({
        issue: "CrashLoopBackOff",
        severity: "Critical",
        status: "Active",
        source: "Application",
        evidence: [message || "Pod is currently in CrashLoopBackOff"],
        timestamp,
      });
      continue;
    }

    if (
      normalizedReason.includes("oomkilled") ||
      normalizedMessage.includes("oomkilled")
    ) {
      applicationHealthy = false;
      findings.push("Container OOMKilled");
      detailedFindings.push({
        issue: "OOMKilled",
        severity: "Critical",
        status: "Active",
        source: "Application",
        evidence: [message || "Container was OOMKilled"],
        timestamp,
      });
      continue;
    }
    if (
      normalizedReason.includes("nodenotready") ||
      normalizedMessage.includes("node is not ready")
    ) {
      kubernetesHealthy = false;
      findings.push("Kubernetes node is not ready");
      detailedFindings.push({
        issue: "NodeNotReady",
        severity: "High",
        status: "Active",
        source: "Kubernetes",
        evidence: [message || "Kubernetes node is not ready"],
        timestamp,
      });
      continue;
    }

    if (
      normalizedReason.includes("failedscheduling") ||
      normalizedMessage.includes("failed scheduling")
    ) {
      kubernetesHealthy = false;
      applicationHealthy = false;
      findings.push("Pod scheduling failure");
      detailedFindings.push({
        issue: "FailedScheduling",
        severity: "High",
        status: "Active",
        source: "Kubernetes",
        evidence: [message || "Pod scheduling failed"],
        timestamp,
      });
      continue;
    }

    if (
      normalizedReason.includes("imagepullbackoff") ||
      normalizedMessage.includes("imagepullbackoff") ||
      normalizedReason.includes("errimagepull") ||
      normalizedMessage.includes("errimagepull")
    ) {
      applicationHealthy = false;
      findings.push("Container image pull failed");
      detailedFindings.push({
        issue: "ImagePullFailure",
        severity: "High",
        status: "Active",
        source: "Application",
        evidence: [message || "Container image pull failed"],
        timestamp,
      });
      continue;
    }
    if (normalizedReason === "unhealthy") {
      detailedFindings.push({
        issue: "Unhealthy",
        severity: "Medium",
        status: "Active",
        source: "Kubernetes",
        evidence: [message || "Kubernetes reported an unhealthy resource"],
        timestamp,
      });
    }
  }

  const infrastructureHealthy =
    cpuUsage <= CPU_WARNING_THRESHOLD &&
    memoryMB <= MEMORY_WARNING_THRESHOLD_MB;

  const healthy =
    infrastructureHealthy && applicationHealthy && kubernetesHealthy;

  const hasActiveCritical = detailedFindings.some(
    (finding) => finding.status === "Active" && finding.severity === "Critical",
  );

  const hasActiveHigh = detailedFindings.some(
    (finding) => finding.status === "Active" && finding.severity === "High",
  );

  let status: HealthStatus = "Healthy";

  if (hasActiveCritical) {
    status = "Incident";
  } else if (hasActiveHigh || !healthy) {
    status = "Degraded";
  }

  return {
    cpu: `${cpuUsage.toFixed(2)} %`,

    memory: `${memoryMB.toFixed(2)} MB`,

    healthy,

    status,

    applicationHealthy,

    kubernetesHealthy,

    findings: [...new Set(findings)],

    detailedFindings: deduplicateFindings(detailedFindings),
  };
}

function normalizeCpuUsage(cpu: number): number {
  if (!Number.isFinite(cpu)) {
    return 0;
  }

  if (cpu >= 0 && cpu <= 1) {
    return cpu * 100;
  }

  return cpu;
}

function deduplicateFindings(findings: DetailedFinding[]): DetailedFinding[] {
  const unique = new Map<string, DetailedFinding>();

  for (const finding of findings) {
    const key = [finding.issue, finding.status, finding.source].join("::");

    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, finding);
      continue;
    }

    if (severityRank(finding.severity) > severityRank(existing.severity)) {
      unique.set(key, finding);
      continue;
    }
    if (
      finding.timestamp &&
      existing.timestamp &&
      new Date(finding.timestamp).getTime() >
        new Date(existing.timestamp).getTime()
    ) {
      unique.set(key, finding);
    }
  }

  return Array.from(unique.values());
}

function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case "Critical":
      return 4;

    case "High":
      return 3;

    case "Medium":
      return 2;

    case "Low":
      return 1;

    default:
      return 0;
  }
}
