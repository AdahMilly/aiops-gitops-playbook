import { CorrelationFinding } from "./correlationEngine";
import { Prediction } from "./recommendationEngine";
import { RootCauseAnalysis } from "./rootCauseEngine";

export interface HealthStatus {
  healthy: boolean;
  applicationHealthy?: boolean;
  kubernetesHealthy?: boolean;
}

export interface TrendSummary {
  cpu?: {
    anomaly: boolean;
  };
  memory?: {
    anomaly: boolean;
  };
}

export interface IncidentScore {
  score: number;
  level: "Healthy" | "Warning" | "Major" | "Critical";
  reasons: string[];
  breakdown: {
    health: number;
    rootCause: number;
    incidents: number;
    predictions: number;
    trends: number;
  };
}

interface IncidentScoreInput {
  health: HealthStatus;
  rootCause: RootCauseAnalysis | null;
  correlations: CorrelationFinding[];
  predictions: Prediction[];
  trends?: TrendSummary;
}

export function scoreIncident(data: IncidentScoreInput): IncidentScore {
  let healthScore = 0;
  let rootCauseScore = 0;
  let incidentScore = 0;
  let predictionScore = 0;
  let trendScore = 0;

  const reasons: string[] = [];

  if (!data.health.healthy) {
    healthScore += 20;
    reasons.push("Overall health degraded");
  }

  if (data.health.applicationHealthy === false) {
    healthScore += 15;
    reasons.push("Application unhealthy");
  }

  if (data.health.kubernetesHealthy === false) {
    healthScore += 15;
    reasons.push("Kubernetes unhealthy");
  }

  if (data.rootCause) {
    reasons.push(data.rootCause.subcategory);

    switch (data.rootCause.category) {
      case "Infrastructure":
        rootCauseScore += 30;
        break;

      case "Application":
        rootCauseScore += 25;
        break;

      case "Resource":
        rootCauseScore += 20;
        break;

      case "Performance":
        rootCauseScore += 15;
        break;

      case "Observability":
        rootCauseScore += 10;
        break;

      default:
        rootCauseScore += 5;
    }

    if (data.rootCause.confidence >= 95) {
      rootCauseScore += 5;
    }
  }

  const uniqueIssues = new Map<string, CorrelationFinding["severity"]>();

  data.correlations.forEach((correlation) => {
    const current = uniqueIssues.get(correlation.issue);

    if (
      !current ||
      severityWeight(correlation.severity) > severityWeight(current)
    ) {
      uniqueIssues.set(correlation.issue, correlation.severity);
    }
  });

  uniqueIssues.forEach((severity, issue) => {
    switch (severity) {
      case "Critical":
        incidentScore += 20;
        break;

      case "High":
        incidentScore += 12;
        break;

      case "Medium":
        incidentScore += 6;
        break;

      case "Low":
        incidentScore += 2;
        break;
    }

    reasons.push(issue);
  });

  data.predictions.forEach((prediction) => {
    switch (prediction.risk) {
      case "Critical":
        predictionScore += 20;
        reasons.push(prediction.message);
        break;

      case "High":
        predictionScore += 12;
        reasons.push(prediction.message);
        break;

      case "Medium":
        predictionScore += 6;
        reasons.push(prediction.message);
        break;

      case "Low":
        predictionScore += 1;
        break;
    }
  });

  if (data.trends?.cpu?.anomaly) {
    trendScore += 5;
    reasons.push("CPU anomaly detected");
  }

  if (data.trends?.memory?.anomaly) {
    trendScore += 5;
    reasons.push("Memory anomaly detected");
  }

  let score =
    healthScore + rootCauseScore + incidentScore + predictionScore + trendScore;

  score = Math.min(score, 100);

  let level: IncidentScore["level"] = "Healthy";

  if (score >= 80) {
    level = "Critical";
  } else if (score >= 50) {
    level = "Major";
  } else if (score >= 20) {
    level = "Warning";
  }

  return {
    score,
    level,
    reasons: reasons.filter(
      (reason, index, self) => self.indexOf(reason) === index,
    ),
    breakdown: {
      health: healthScore,
      rootCause: rootCauseScore,
      incidents: incidentScore,
      predictions: predictionScore,
      trends: trendScore,
    },
  };
}

function severityWeight(severity: CorrelationFinding["severity"]): number {
  switch (severity) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    case "Low":
      return 1;
  }
}
