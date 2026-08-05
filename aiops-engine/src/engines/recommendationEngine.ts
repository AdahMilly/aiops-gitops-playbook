export interface Recommendation {
  priority: "Low" | "Medium" | "High" | "Critical";
  issue: string;
  action: string;
  automation?: string;
}

export function recommend(
  causes: any[],
  correlations: any[],
  predictions: any[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const cause of causes) {
    switch (cause.title) {
      case "High CPU Usage":
        recommendations.push({
          priority: "Critical",
          issue: cause.title,
          action:
            "Identify CPU-intensive requests, inspect recent deployments, and consider scaling the deployment.",
          automation: "kubectl scale deployment aiops-playbook --replicas=3",
        });
        break;

      case "Memory Leak":
        recommendations.push({
          priority: "Critical",
          issue: cause.title,
          action:
            "Capture heap profile, inspect allocations, and restart affected pods if necessary.",
          automation: "kubectl rollout restart deployment aiops-playbook",
        });
        break;

      case "Tracing Missing":
        recommendations.push({
          priority: "High",
          issue: cause.title,
          action:
            "Verify OpenTelemetry SDK initialization and ensure traces are exported to Tempo.",
          automation:
            "kubectl logs deployment/aiops-playbook | grep OpenTelemetry",
        });
        break;

      case "Log Explosion":
        recommendations.push({
          priority: "Medium",
          issue: cause.title,
          action:
            "Inspect repetitive errors in Loki and reduce unnecessary log verbosity.",
          automation: "logcli query '{app=\"aiops-playbook\"}' --limit=100",
        });
        break;

      default:
        recommendations.push({
          priority: "Low",
          issue: cause.title,
          action: cause.recommendation,
        });
    }
  }

  for (const correlation of correlations) {
    recommendations.push({
      priority: correlation.severity,
      issue: correlation.issue,
      action: correlation.evidence.join(". "),
    });
  }

  for (const prediction of predictions) {
    if (prediction.risk === "High") {
      recommendations.push({
        priority: "High",
        issue: `${prediction.metric} forecast`,
        action: prediction.message,
      });
    }

    if (prediction.risk === "Critical") {
      recommendations.push({
        priority: "Critical",
        issue: `${prediction.metric} forecast`,
        action: prediction.message,
      });
    }
  }

  return recommendations.filter(
    (item, index, self) =>
      index === self.findIndex((r) => r.issue === item.issue),
  );
}
