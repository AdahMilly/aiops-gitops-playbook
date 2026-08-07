import { CorrelationFinding } from "./correlationEngine";

export interface RootCauseAnalysis {
  category: string;
  subcategory: string;
  confidence: number;
  evidence: string[];
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

  if (actionableFindings.length === 0) {
    return null;
  }

  const nodeFailure = actionableFindings.find(
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
    };
  }

  const unhealthy = actionableFindings.find(
    (finding) =>
      finding.issue === "Unhealthy" ||
      finding.issue.toLowerCase().includes("health check") ||
      finding.issue.toLowerCase().includes("probe") ||
      finding.issue.toLowerCase().includes("crashloop"),
  );

  if (unhealthy) {
    return {
      category: "Application",
      subcategory: "Health Check Failure",
      confidence: 95,
      evidence: unhealthy.evidence,
    };
  }

  const memory = actionableFindings.find(
    (finding) =>
      finding.issue.toLowerCase().includes("memory") ||
      finding.issue.toLowerCase().includes("oom"),
  );

  if (memory) {
    return {
      category: "Resource",
      subcategory: "Memory Pressure",
      confidence: 92,
      evidence: memory.evidence,
    };
  }

  const cpu = actionableFindings.find((finding) =>
    finding.issue.toLowerCase().includes("cpu"),
  );

  if (cpu) {
    return {
      category: "Resource",
      subcategory: "CPU Saturation",
      confidence: 92,
      evidence: cpu.evidence,
    };
  }

  const latency = actionableFindings.find((finding) => {
    const issue = finding.issue.toLowerCase();

    return issue.includes("slow") || issue.includes("latency");
  });

  if (latency) {
    return {
      category: "Performance",
      subcategory: "High Latency",
      confidence: 88,
      evidence: latency.evidence,
    };
  }

  const tracing = actionableFindings.find((finding) => {
    const issue = finding.issue.toLowerCase();

    return issue.includes("tracing") || issue.includes("trace");
  });

  if (tracing) {
    return {
      category: "Observability",
      subcategory: "Tracing Missing",
      confidence: 85,
      evidence: tracing.evidence,
    };
  }

  const severityOrder: Record<CorrelationFinding["severity"], number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const highest = [...actionableFindings].sort(
    (a, b) => severityOrder[b.severity] - severityOrder[a.severity],
  )[0];

  return {
    category: "Unknown",
    subcategory: highest.issue,
    confidence: 70,
    evidence: highest.evidence,
  };
}
