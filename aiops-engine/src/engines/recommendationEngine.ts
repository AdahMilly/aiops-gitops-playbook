import { RootCauseAnalysis } from "./rootCauseEngine";
import { IncidentGroup } from "./incidentDeduplicationEngine";

export type RecommendationPriority =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export interface Prediction {
  metric?: string;
  risk: RecommendationPriority;
  message: string;
  probability?: number;
  horizon?: string;
}

export interface Recommendation {
  key: string;
  priority: RecommendationPriority;
  issue: string;
  actions: string[];
  automation?: string;
}

export function recommend(
  rootCause: RootCauseAnalysis | null,
  incidentGroups: IncidentGroup[],
  predictions: Prediction[],
): Recommendation[] {
  const recommendations = new Map<string, Recommendation>();

  const isSystemHealthy =
    rootCause?.subcategory === "System Healthy" &&
    incidentGroups.length === 0;

  if (isSystemHealthy) {
    return [];
  }

  const addRecommendation = (
    recommendation: Recommendation,
  ): void => {
    const normalized =
      normalizeRecommendation(recommendation);

    const existing = recommendations.get(
      normalized.key,
    );

    if (!existing) {
      recommendations.set(normalized.key, {
        ...normalized,
        actions: [...new Set(normalized.actions)],
      });

      return;
    }

    for (const action of normalized.actions) {
      if (!existing.actions.includes(action)) {
        existing.actions.push(action);
      }
    }

    if (
      priorityWeight(normalized.priority) >
      priorityWeight(existing.priority)
    ) {
      existing.priority = normalized.priority;
    }

    if (
      !existing.automation &&
      normalized.automation
    ) {
      existing.automation =
        normalized.automation;
    }
  };

  if (rootCause) {
    switch (rootCause.subcategory) {
      case "Node Failure":
        addRecommendation({
          key: "node-failure",
          priority: "Critical",
          issue: "Cluster node unavailable",
          actions: [
            "Inspect kubelet status.",
            "Check node CPU, memory and disk pressure.",
            "Verify node network connectivity.",
            "Review node conditions and taints.",
            "Drain and recover the affected node.",
            "Reschedule workloads if the node remains unavailable.",
          ],
          automation:
            "kubectl get nodes && kubectl describe nodes",
        });
        break;

      case "Health Check Failure":
        addRecommendation({
          key: "application-health-check",
          priority: "Critical",
          issue: "Application Unhealthy",
          actions: [
            "Inspect application logs.",
            "Review readiness and liveness probe configuration.",
            "Verify the application is responding on the configured port.",
            "Validate application startup dependencies.",
            "Review recent application deployments.",
            "Restart the deployment if the application remains unhealthy.",
          ],
          automation:
            "kubectl rollout restart deployment aiops-playbook",
        });
        break;

      case "Memory Pressure":
        addRecommendation({
          key: "memory-pressure",
          priority: "Critical",
          issue: "Memory Pressure",
          actions: [
            "Inspect memory utilization and container limits.",
            "Identify memory-intensive workloads.",
            "Capture a heap dump if applicable.",
            "Inspect object retention and potential memory leaks.",
            "Review cache configuration.",
            "Restart unhealthy pods if necessary.",
          ],
          automation:
            "kubectl top pods && kubectl top nodes",
        });
        break;

      case "CPU Saturation":
        addRecommendation({
          key: "cpu-saturation",
          priority: "Critical",
          issue: "CPU Saturation",
          actions: [
            "Inspect CPU-intensive workloads.",
            "Review recent deployments and configuration changes.",
            "Check container CPU requests and limits.",
            "Scale the deployment if resource pressure persists.",
            "Profile application performance.",
          ],
          automation:
            "kubectl top pods && kubectl top nodes",
        });
        break;

      case "High Latency":
        addRecommendation({
          key: "high-latency",
          priority: "High",
          issue: "High Latency",
          actions: [
            "Inspect slow traces in Tempo.",
            "Identify slow endpoints.",
            "Review database queries.",
            "Check upstream service dependencies.",
            "Review recent application or infrastructure changes.",
          ],
        });
        break;

      case "Tracing Missing":
        addRecommendation({
          key: "tracing-missing",
          priority: "High",
          issue: "Tracing Missing",
          actions: [
            "Verify OpenTelemetry SDK initialization.",
            "Verify OpenTelemetry Collector connectivity.",
            "Confirm Tempo is receiving traces.",
            "Review application telemetry configuration.",
          ],
          automation:
            "kubectl logs deployment/aiops-playbook | grep OpenTelemetry",
        });
        break;

      case "System Healthy":
        break;

      default:
        break;
    }
  }

  for (const group of incidentGroups) {
    const recommendation =
      buildIncidentGroupRecommendation(
        group,
        rootCause,
      );

    if (!recommendation) {
      continue;
    }

    addRecommendation(recommendation);
  }

  for (const prediction of predictions) {
    if (
      prediction.risk !== "High" &&
      prediction.risk !== "Critical"
    ) {
      continue;
    }

    const metric =
      prediction.metric ?? "System";

    const key = `forecast-${normalizeKey(metric)}`;

    addRecommendation({
      key,
      priority: prediction.risk,
      issue: `${metric} Forecast`,
      actions: [
        prediction.message,

        prediction.risk === "Critical"
          ? "Take preventative action immediately."
          : "Monitor this trend closely.",

        "Review capacity planning.",
      ],
    });
  }

  return Array.from(
    recommendations.values(),
  ).sort(
    (a, b) =>
      priorityWeight(b.priority) -
      priorityWeight(a.priority),
  );
}

function buildIncidentGroupRecommendation(
  group: IncidentGroup,
  rootCause: RootCauseAnalysis | null,
): Recommendation | null {

  if (
    group.findings.some(
      (finding) =>
        finding.issue === "System Healthy",
    )
  ) {
    return null;
  }

  if (
    group.category === "Infrastructure" &&
    rootCause?.subcategory === "Node Failure"
  ) {
    return null;
  }

  if (
    group.category === "Application" &&
    rootCause?.subcategory ===
      "Health Check Failure"
  ) {
    return null;
  }

  const actions = uniqueStrings(
    group.findings.flatMap(
      (finding) => finding.evidence,
    ),
  );

  if (actions.length === 0) {
    return null;
  }

  return {
    key: `incident-${normalizeKey(
      group.category,
    )}`,

    priority: group.severity,

    issue: group.title,

    actions,
  };
}

function normalizeRecommendation(
  recommendation: Recommendation,
): Recommendation {
  return {
    ...recommendation,

    key: normalizeKey(
      recommendation.key,
    ),

    actions: uniqueStrings(
      recommendation.actions,
    ),
  };
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function priorityWeight(
  priority: RecommendationPriority,
): number {
  switch (priority) {
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