import { Incident } from "../models/Incident";
import { normalizeIssue } from "../utils/normalizationIssue";

export function mergeIncidents(incidents: Incident[]): Incident[] {
  const merged = new Map<string, Incident>();

  for (const incident of incidents) {
    const key = normalizeIssue(incident.title);

    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...incident,
        title: key,
      });

      continue;
    }

    existing.severity =
      severityWeight(incident.severity) > severityWeight(existing.severity)
        ? incident.severity
        : existing.severity;

    existing.confidence = Math.max(existing.confidence, incident.confidence);

    existing.evidence = unique([...existing.evidence, ...incident.evidence]);

    existing.symptoms = unique([...existing.symptoms, ...incident.symptoms]);

    existing.recommendations = unique([
      ...existing.recommendations,
      ...incident.recommendations,
    ]);

    existing.affectedPods = unique([
      ...existing.affectedPods,
      ...incident.affectedPods,
    ]);

    existing.affectedServices = unique([
      ...existing.affectedServices,
      ...incident.affectedServices,
    ]);

    existing.source = unique([...existing.source, ...incident.source]);
  }

  return Array.from(merged.values());
}

function severityWeight(level: Incident["severity"]) {
  switch (level) {
    case "Critical":
      return 4;

    case "High":
      return 3;

    case "Medium":
      return 2;

    default:
      return 1;
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
