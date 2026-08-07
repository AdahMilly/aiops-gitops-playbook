import { CorrelationFinding } from "./correlationEngine";

export interface IncidentGroup {
  id: string;

  title: string;

  severity: "Low" | "Medium" | "High" | "Critical";

  category:
    | "Infrastructure"
    | "Application"
    | "Performance"
    | "Networking"
    | "Observability"
    | "Unknown";

  findings: CorrelationFinding[];

  evidence: string[];

  affectedPods: string[];
}

export function deduplicateIncidents(
  findings: CorrelationFinding[],
): IncidentGroup[] {

  const actionableFindings = findings.filter(
    (finding) => finding.issue !== "System Healthy",
  );

  if (actionableFindings.length === 0) {
    return [];
  }

  const groups = new Map<
    IncidentGroup["category"],
    IncidentGroup
  >();

  for (const finding of actionableFindings) {
    const category = determineCategory(finding);

    if (!groups.has(category)) {
      groups.set(category, {
        id: crypto.randomUUID(),

        title: `${category} Incident`,

        category,

        severity: finding.severity,

        findings: [],

        evidence: [],

        affectedPods: [],
      });
    }

    const group = groups.get(category)!;

    group.findings.push(finding);

    if (
      severityWeight(finding.severity) >
      severityWeight(group.severity)
    ) {
      group.severity = finding.severity;
    }

    for (const evidence of finding.evidence) {
      if (!group.evidence.includes(evidence)) {
        group.evidence.push(evidence);
      }

      if (evidence.startsWith("Pod:")) {
        const pod = evidence
          .replace("Pod:", "")
          .trim();

        if (
          pod &&
          !group.affectedPods.includes(pod)
        ) {
          group.affectedPods.push(pod);
        }
      }
    }
  }

  for (const group of groups.values()) {
    group.findings.sort(
      (a, b) =>
        severityWeight(b.severity) -
        severityWeight(a.severity),
    );
  }

  return [...groups.values()].sort(
    (a, b) =>
      severityWeight(b.severity) -
      severityWeight(a.severity),
  );
}

function determineCategory(
  finding: CorrelationFinding,
): IncidentGroup["category"] {
  const issue = finding.issue.toLowerCase();

  if (
    issue.includes("node") ||
    issue.includes("taint") ||
    issue.includes("scheduling")
  ) {
    return "Infrastructure";
  }

  if (
    issue.includes("unhealthy") ||
    issue.includes("probe") ||
    issue.includes("crash") ||
    issue.includes("oom") ||
    issue.includes("imagepull")
  ) {
    return "Application";
  }

  if (
    issue.includes("cpu") ||
    issue.includes("memory") ||
    issue.includes("latency") ||
    issue.includes("slow") ||
    issue.includes("request")
  ) {
    return "Performance";
  }

  if (
    issue.includes("network") ||
    issue.includes("connection") ||
    issue.includes("timeout")
  ) {
    return "Networking";
  }

  if (
    issue.includes("trace") ||
    issue.includes("telemetry") ||
    issue.includes("observability") ||
    issue.includes("log")
  ) {
    return "Observability";
  }

  return "Unknown";
}

function severityWeight(
  severity: IncidentGroup["severity"],
): number {
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