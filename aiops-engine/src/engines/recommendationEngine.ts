import { RootCauseAnalysis } from "./rootCauseEngine";
import { CorrelationFinding } from "./correlationEngine";

export interface Prediction {
  metric?: string;
  risk: "Low" | "Medium" | "High" | "Critical";
  message: string;
}

export interface Recommendation {
  priority: "Low" | "Medium" | "High" | "Critical";
  issue: string;
  actions: string[];
  automation?: string;
}

export function recommend(
  rootCause: RootCauseAnalysis | null,
  correlations: CorrelationFinding[],
  predictions: Prediction[],
): Recommendation[] {
  const recommendations = new Map<string, Recommendation>();

  const addRecommendation = (recommendation: Recommendation) => {
    const existing = recommendations.get(recommendation.issue);

    if (!existing) {
      recommendations.set(recommendation.issue, recommendation);
      return;
    }

    existing.actions = existing.actions.filter(
      (action, index, self) => self.indexOf(action) === index,
    );

    recommendation.actions.forEach((action) => {
      if (!existing.actions.includes(action)) {
        existing.actions.push(action);
      }
    });

    if (
      priorityWeight(recommendation.priority) >
      priorityWeight(existing.priority)
    ) {
      existing.priority = recommendation.priority;
    }

    if (!existing.automation && recommendation.automation) {
      existing.automation = recommendation.automation;
    }
  };

  if (rootCause) {
    switch (rootCause.subcategory) {
      case "Node Failure":
        addRecommendation({
          priority: "Critical",
          issue: "Cluster node unavailable",
          actions: [
            "Inspect kubelet status.",
            "Check node CPU, memory and disk pressure.",
            "Verify node network connectivity.",
            "Drain and recover the affected node.",
            "Reschedule workloads if the node remains unavailable.",
          ],
          automation: "kubectl describe node <node-name>",
        });
        break;

      case "Health Check Failure":
        addRecommendation({
          priority: "Critical",
          issue: "Application Unhealthy",
          actions: [
            "Inspect application logs.",
            "Verify the application is listening on the configured port.",
            "Review readiness and liveness probes.",
            "Validate startup dependencies.",
            "Restart the deployment if required.",
          ],
          automation: "kubectl rollout restart deployment aiops-playbook",
        });
        break;

      case "Memory Pressure":
        addRecommendation({
          priority: "Critical",
          issue: "Memory Pressure",
          actions: [
            "Capture a heap dump.",
            "Inspect object retention.",
            "Review cache configuration.",
            "Restart unhealthy pods.",
          ],
          automation: "kubectl rollout restart deployment aiops-playbook",
        });
        break;

      case "CPU Saturation":
        addRecommendation({
          priority: "Critical",
          issue: "CPU Saturation",
          actions: [
            "Inspect CPU-intensive requests.",
            "Review recent deployments.",
            "Scale the deployment if necessary.",
            "Profile application performance.",
          ],
          automation: "kubectl scale deployment aiops-playbook --replicas=3",
        });
        break;

      case "High Latency":
        addRecommendation({
          priority: "High",
          issue: "High Latency",
          actions: [
            "Inspect slow traces in Tempo.",
            "Identify slow endpoints.",
            "Review database queries.",
            "Check upstream service dependencies.",
          ],
        });
        break;

      case "Tracing Missing":
        addRecommendation({
          priority: "High",
          issue: "Tracing Missing",
          actions: [
            "Verify OpenTelemetry SDK initialization.",
            "Verify Collector connectivity.",
            "Confirm Tempo is receiving traces.",
          ],
          automation:
            "kubectl logs deployment/aiops-playbook | grep OpenTelemetry",
        });
        break;
    }
  }

  for (const correlation of correlations) {
    addRecommendation({
      priority: correlation.severity,
      issue: correlation.issue,
      actions: correlation.evidence,
    });
  }

  for (const prediction of predictions) {
    if (
      prediction.risk === "High" ||
      prediction.risk === "Critical"
    ) {
      addRecommendation({
        priority: prediction.risk,
        issue: `${prediction.metric ?? "System"} Forecast`,
        actions: [
          prediction.message,
          prediction.risk === "Critical"
            ? "Take preventative action immediately."
            : "Monitor this trend closely.",
          "Review capacity planning.",
        ],
      });
    }
  }

  return Array.from(recommendations.values()).sort(
    (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority),
  );
}

function priorityWeight(priority: Recommendation["priority"]): number {
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