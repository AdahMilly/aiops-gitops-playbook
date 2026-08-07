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

export interface DetailedFinding {
  issue: string;

  severity: "Low" | "Medium" | "High" | "Critical";

  status: FindingStatus;

  source: "Kubernetes" | "Application" | "Metrics" | "Analysis";

  evidence: string[];

  timestamp?: string;
}

export interface HealthReport {
  cpu: string;
  memory: string;

  healthy: boolean;

  applicationHealthy: boolean;
  kubernetesHealthy: boolean;

  findings: string[];

  detailedFindings: DetailedFinding[];
}

const CPU_WARNING_THRESHOLD = 80;
const MEMORY_WARNING_THRESHOLD_MB = 400;

export function analyze(telemetry: Telemetry): HealthReport {
  const cpuUsage = telemetry.metrics.cpu * 100;

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
      severity: "Critical",
      status: "Active",
      source: "Kubernetes",
      evidence: ["Kubernetes node is currently NotReady"],
      timestamp: telemetry.timestamp,
    });
  }

  if (kubernetes?.pods) {
    for (const pod of kubernetes.pods) {
      if (!pod.ready) {
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
          source: "Kubernetes",
          evidence,
          timestamp: telemetry.timestamp,
        });
      }
    }
  }

  const events = telemetry.events ?? [];

  for (const event of events) {
    const message = String(event.message ?? "").toLowerCase();

    const reason = String(event.reason ?? "").toLowerCase();

    const eventTimestamp =
      event.timestamp ??
      event.time ??
      event.lastTimestamp ??
      telemetry.timestamp;

    const timestamp =
      eventTimestamp instanceof Date
        ? eventTimestamp.toISOString()
        : eventTimestamp;

    if (
      message.includes("liveness probe failed") ||
      message.includes("readiness probe failed")
    ) {
      const isLiveness = message.includes("liveness");

      const issue = isLiveness
        ? "LivenessProbeFailure"
        : "ReadinessProbeFailure";

      const eventMessage = event.message ?? "Kubernetes health probe failed";

      detailedFindings.push({
        issue,
        severity: "High",
        status: "Historical",
        source: "Application",
        evidence: [eventMessage],
        timestamp,
      });
    }

    if (
      reason.includes("crashloopbackoff") ||
      message.includes("crashloopbackoff")
    ) {
      applicationHealthy = false;

      findings.push("Pod is CrashLoopBackOff");

      detailedFindings.push({
        issue: "CrashLoopBackOff",
        severity: "Critical",
        status: "Active",
        source: "Application",
        evidence: [event.message ?? "Pod is currently in CrashLoopBackOff"],
        timestamp,
      });
    }

    if (reason.includes("oomkilled") || message.includes("oomkilled")) {
      applicationHealthy = false;

      findings.push("Container OOMKilled");

      detailedFindings.push({
        issue: "OOMKilled",
        severity: "Critical",
        status: "Active",
        source: "Application",
        evidence: [event.message ?? "Container was OOMKilled"],
        timestamp,
      });
    }

    if (
      reason.includes("nodenotready") ||
      message.includes("node is not ready")
    ) {
      detailedFindings.push({
        issue: "NodeNotReady",
        severity: "High",
        status: "Historical",
        source: "Kubernetes",
        evidence: [event.message ?? "Node is not ready"],
        timestamp,
      });
    }

    if (
      reason.includes("failedscheduling") ||
      message.includes("failed scheduling")
    ) {
      kubernetesHealthy = false;

      findings.push("Pod scheduling failure");

      detailedFindings.push({
        issue: "FailedScheduling",
        severity: "High",
        status: "Active",
        source: "Kubernetes",
        evidence: [event.message ?? "Pod scheduling failed"],
        timestamp,
      });
    }

    if (
      reason.includes("imagepullbackoff") ||
      message.includes("imagepullbackoff") ||
      reason.includes("errimagepull") ||
      message.includes("errimagepull")
    ) {
      applicationHealthy = false;

      findings.push("Container image pull failed");

      detailedFindings.push({
        issue: "ImagePullFailure",
        severity: "High",
        status: "Active",
        source: "Application",
        evidence: [event.message ?? "Container image pull failed"],
        timestamp,
      });
    }
  }

  const infrastructureHealthy =
    cpuUsage <= CPU_WARNING_THRESHOLD &&
    memoryMB <= MEMORY_WARNING_THRESHOLD_MB;

  const healthy =
    infrastructureHealthy && applicationHealthy && kubernetesHealthy;

  return {
    cpu: `${cpuUsage.toFixed(2)} %`,

    memory: `${memoryMB.toFixed(2)} MB`,

    healthy,

    applicationHealthy,

    kubernetesHealthy,

    findings: [...new Set(findings)],

    detailedFindings: deduplicateFindings(detailedFindings),
  };
}

function deduplicateFindings(findings: DetailedFinding[]): DetailedFinding[] {
  const unique = new Map<string, DetailedFinding>();

  for (const finding of findings) {
    const key = [
      finding.issue,
      finding.status,
      finding.source,
      finding.timestamp ?? "",
      finding.evidence.join("|"),
    ].join("::");

    if (!unique.has(key)) {
      unique.set(key, finding);
    }
  }

  return Array.from(unique.values());
}
