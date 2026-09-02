import { CorrelationFinding } from "./correlationEngine";

export interface RootCauseAnalysis {
  category: string;
  subcategory: string;
  confidence: number;
  evidence: string[];

  status?: "Active" | "Historical";
  source?: string;
}

export function findRootCause(
  findings: CorrelationFinding[],
): RootCauseAnalysis | null {
  if (!findings.length) {
    return null;
  }

  const actionableFindings = findings.filter(
    (finding) => finding.issue !== "System Healthy",
  );

  if (!actionableFindings.length) {
    return null;
  }

  const activeFindings = actionableFindings.filter(
    (finding) => finding.status === "Active",
  );

  const historicalFindings = actionableFindings.filter(
    (finding) => finding.status === "Historical",
  );

  const candidateFindings =
    activeFindings.length > 0 ? activeFindings : historicalFindings;

  if (!candidateFindings.length) {
    return null;
  }

  const nodeFailure = candidateFindings.find(
    (finding) =>
      finding.issue === "NodeNotReady" ||
      finding.issue === "Cluster node unavailable",
  );

  if (nodeFailure) {
    return {
      category: "Infrastructure",
      subcategory: "Node Failure",
      confidence: 98,
      evidence: nodeFailure.evidence,
      status: nodeFailure.status,
      source: nodeFailure.source,
    };
  }

  const unhealthy = candidateFindings.find(
    (finding) =>
      finding.issue === "Unhealthy" ||
      finding.issue === "ReadinessProbeFailure",
  );

  if (unhealthy) {
    return {
      category: "Application",
      subcategory:
        unhealthy.issue === "ReadinessProbeFailure"
          ? "Readiness Probe Failure"
          : "Health Check Failure",
      confidence: 95,
      evidence: unhealthy.evidence,
      status: unhealthy.status,
      source: unhealthy.source,
    };
  }

  const memory = candidateFindings.find((finding) =>
    finding.issue.toLowerCase().includes("memory"),
  );

  if (memory) {
    return {
      category: "Resource",
      subcategory: "Memory Pressure",
      confidence: 92,
      evidence: memory.evidence,
      status: memory.status,
      source: memory.source,
    };
  }

  const cpu = candidateFindings.find((finding) =>
    finding.issue.toLowerCase().includes("cpu"),
  );

  if (cpu) {
    return {
      category: "Resource",
      subcategory: "CPU Saturation",
      confidence: 92,
      evidence: cpu.evidence,
      status: cpu.status,
      source: cpu.source,
    };
  }

  const latency = candidateFindings.find((finding) => {
    const issue = finding.issue.toLowerCase();

    return issue.includes("slow") || issue.includes("latency");
  });

  if (latency) {
    return {
      category: "Performance",
      subcategory: "High Latency",
      confidence: 88,
      evidence: latency.evidence,
      status: latency.status,
      source: latency.source,
    };
  }

  const tracing = candidateFindings.find((finding) =>
    finding.issue.toLowerCase().includes("tracing"),
  );

  if (tracing) {
    return {
      category: "Observability",
      subcategory: "Tracing Missing",
      confidence: 85,
      evidence: tracing.evidence,
      status: tracing.status,
      source: tracing.source,
    };
  }

  const severityOrder: Record<CorrelationFinding["severity"], number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const highest = [...candidateFindings].sort(
    (a, b) => severityOrder[b.severity] - severityOrder[a.severity],
  )[0];

  return {
    category: "Unknown",
    subcategory: highest.issue,
    confidence: 70,
    evidence: highest.evidence,
    status: highest.status,
    source: highest.source,
  };
}
