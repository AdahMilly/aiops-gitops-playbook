import { Incident } from "../models/Incident";

export type FindingStatus = "Active" | "Historical";

export interface CorrelationFinding {
  severity: "Low" | "Medium" | "High" | "Critical";
  issue: string;
  evidence: string[];
  status: FindingStatus;
  source: string;
  timestamp?: string | Date;
}

interface Trend {
  trend: string;
  anomaly: boolean;
}

interface DetailedHealthFinding {
  issue: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: FindingStatus;
  source: string;
  evidence: string[];
  timestamp?: string | Date;
}

interface CorrelationInput {
  health: {
    cpu: string;
    memory: string;
    healthy: boolean;
    detailedFindings?: DetailedHealthFinding[];
  };

  metrics: {
    cpu: number;
    memory: number;
  };

  trends: {
    cpu: Trend;
    memory: Trend;
  };

  logs: {
    values?: string[][];
  }[];

  traces: {
    durationMs: number;
  }[];

  incidents: Incident[];
}

export function correlate(data: CorrelationInput): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];

  const cpu = Number.parseFloat(data.health.cpu);
  const memory = Number.parseFloat(data.health.memory);

  const cpuTrend = data.trends.cpu.trend;
  const memoryTrend = data.trends.memory.trend;

  const cpuAnomaly = data.trends.cpu.anomaly;
  const memoryAnomaly = data.trends.memory.anomaly;

  const traceCount = data.traces.length;

  const logCount = data.logs.reduce(
    (sum, log) => sum + (log.values?.length ?? 0),
    0,
  );

  const detailedFindings = data.health.detailedFindings ?? [];

  for (const finding of detailedFindings) {
    findings.push({
      severity: finding.severity,
      issue: finding.issue,
      evidence: finding.evidence,
      status: finding.status,
      source: finding.source,
      timestamp: finding.timestamp,
    });
  }

  if (cpu > 80 && cpuTrend === "rising") {
    findings.push({
      severity: "Critical",
      issue: "CPU Saturation",
      evidence: [`CPU usage ${cpu.toFixed(2)}%`, "CPU trend is rising"],
      status: "Active",
      source: "Metrics",
      timestamp: new Date(),
    });
  }

  if (memory > 400 && memoryTrend === "rising") {
    findings.push({
      severity: "Critical",
      issue: "Possible Memory Leak",
      evidence: [`Memory ${memory.toFixed(2)} MB`, "Memory trend is rising"],
      status: "Active",
      source: "Metrics",
      timestamp: new Date(),
    });
  }

  if (cpuAnomaly) {
    findings.push({
      severity: "Medium",
      issue: "CPU Anomaly",
      evidence: ["CPU trend contains abnormal spikes"],
      status: "Active",
      source: "Metrics",
      timestamp: new Date(),
    });
  }

  if (memoryAnomaly) {
    findings.push({
      severity: "Medium",
      issue: "Memory Anomaly",
      evidence: ["Memory trend contains abnormal spikes"],
      status: "Active",
      source: "Metrics",
      timestamp: new Date(),
    });
  }

  if (logCount > 100) {
    findings.push({
      severity: "Medium",
      issue: "Log Explosion",
      evidence: [`${logCount} recent log entries`],
      status: "Active",
      source: "Logs",
      timestamp: new Date(),
    });
  }

  const slowTraces = data.traces.filter((trace) => trace.durationMs > 1000);

  if (slowTraces.length > 0) {
    findings.push({
      severity: "High",
      issue: "Slow Requests",
      evidence: [`${slowTraces.length} traces exceeded 1 second`],
      status: "Active",
      source: "Tracing",
      timestamp: new Date(),
    });
  }

  if (traceCount === 0) {
    findings.push({
      severity: "Medium",
      issue: "Tracing unavailable",
      evidence: ["No recent traces returned by Tempo"],
      status: "Active",
      source: "Tracing",
      timestamp: new Date(),
    });
  }

  const activeIncidents = data.incidents.filter(
    (incident) => incident.status === "Active",
  );

  for (const incident of activeIncidents) {
    findings.push({
      severity: incident.severity,
      issue: incident.title,

      evidence:
        incident.evidence.length > 0
          ? incident.evidence
          : incident.symptoms.length > 0
            ? incident.symptoms
            : ["No evidence available"],

      status: "Active",
      source: "Incident",
      timestamp: new Date(),
    });
  }

  const unique = findings.filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (finding) =>
          finding.issue === item.issue &&
          finding.severity === item.severity &&
          finding.status === item.status,
      ),
  );

  if (
    unique.length === 0 &&
    data.health.healthy &&
    !cpuAnomaly &&
    !memoryAnomaly
  ) {
    unique.push({
      severity: "Low",
      issue: "System Healthy",
      evidence: [
        "CPU normal",
        "Memory normal",
        "Tracing available",
        "No abnormal trends",
        "No active incidents",
      ],
      status: "Active",
      source: "Health Analysis",
      timestamp: new Date(),
    });
  }

  return unique;
}
