import { DetailedFinding } from "../analyzers/healthAnalyzer";
import {
  Incident,
  IncidentLifecycleResult,
} from "../analyzers/incidentLifecycle";

function createIncidentId(issue: string, source: string): string {
  return `${source}-${issue}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFindingKey(finding: DetailedFinding): string {
  return `${finding.issue}::${finding.source}`;
}

function getIncidentKey(incident: Incident): string {
  return `${incident.issue}::${incident.source}`;
}

function getNow(): string {
  return new Date().toISOString();
}

function getLatestTimestamp(current: string, incoming: string): string {
  return new Date(incoming).getTime() > new Date(current).getTime()
    ? incoming
    : current;
}

export function processIncidentLifecycle(
  findings: DetailedFinding[],
  previousIncidents: Incident[] = [],
  now: string = getNow(),
): IncidentLifecycleResult {
  const incidentMap = new Map<string, Incident>();

  for (const incident of previousIncidents) {
    incidentMap.set(getIncidentKey(incident), {
      ...incident,
      evidence: [...incident.evidence],
    });
  }

  const currentKeys = new Set<string>();

  for (const finding of findings) {
    const key = getFindingKey(finding);

    currentKeys.add(key);

    const timestamp = finding.timestamp ?? now;

    const existing = incidentMap.get(key);

    if (existing) {
      existing.lastSeen = getLatestTimestamp(existing.lastSeen, timestamp);

      existing.status = "Active";

      existing.resolvedAt = undefined;

      existing.durationMs =
        new Date(existing.lastSeen).getTime() -
        new Date(existing.firstSeen).getTime();

      existing.occurrences += 1;

      existing.severity = finding.severity;

      existing.evidence = Array.from(
        new Set([...existing.evidence, ...finding.evidence]),
      );

      continue;
    }

    const incident: Incident = {
      id: createIncidentId(finding.issue, finding.source),

      issue: finding.issue,

      category:
        finding.source === "Kubernetes"
          ? "Kubernetes"
          : (finding.source as Incident["category"]),

      severity: finding.severity,

      status: "Active",

      firstSeen: timestamp,

      lastSeen: timestamp,

      occurrences: 1,

      evidence: [...finding.evidence],

      source: finding.source,
    };

    incidentMap.set(key, incident);
  }

  for (const incident of incidentMap.values()) {
    const key = getIncidentKey(incident);

    if (!currentKeys.has(key) && incident.status === "Active") {
      incident.status = "Resolved";

      incident.resolvedAt = now;

      incident.durationMs =
        new Date(now).getTime() - new Date(incident.firstSeen).getTime();
    }
  }

  const incidents = Array.from(incidentMap.values());

  return {
    incidents,

    activeIncidents: incidents.filter(
      (incident) => incident.status === "Active",
    ),

    historicalIncidents: incidents.filter(
      (incident) => incident.status === "Historical",
    ),

    resolvedIncidents: incidents.filter(
      (incident) => incident.status === "Resolved",
    ),
  };
}
