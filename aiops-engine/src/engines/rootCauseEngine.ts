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

  const nodeFailure = findings.find(
    (f) => f.issue === "NodeNotReady" || f.issue === "Cluster node unavailable",
  );

  if (nodeFailure) {
    return {
      category: "Infrastructure",
      subcategory: "Node Failure",
      confidence: 98,
      evidence: nodeFailure.evidence,
    };
  }

  const unhealthy = findings.find((f) => f.issue === "Unhealthy");

  if (unhealthy) {
    return {
      category: "Application",
      subcategory: "Health Check Failure",
      confidence: 95,
      evidence: unhealthy.evidence,
    };
  }

  const memory = findings.find((f) => f.issue.toLowerCase().includes("memory"));

  if (memory) {
    return {
      category: "Resource",
      subcategory: "Memory Pressure",
      confidence: 92,
      evidence: memory.evidence,
    };
  }

  const cpu = findings.find((f) => f.issue.toLowerCase().includes("cpu"));

  if (cpu) {
    return {
      category: "Resource",
      subcategory: "CPU Saturation",
      confidence: 92,
      evidence: cpu.evidence,
    };
  }
  const latency = findings.find((f) => f.issue.toLowerCase().includes("slow"));

  if (latency) {
    return {
      category: "Performance",
      subcategory: "High Latency",
      confidence: 88,
      evidence: latency.evidence,
    };
  }
  const tracing = findings.find((f) =>
    f.issue.toLowerCase().includes("tracing"),
  );

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

  const highest = [...findings].sort(
    (a, b) => severityOrder[b.severity] - severityOrder[a.severity],
  )[0];

  return {
    category: "Unknown",
    subcategory: highest.issue,
    confidence: 70,
    evidence: highest.evidence,
  };
}
