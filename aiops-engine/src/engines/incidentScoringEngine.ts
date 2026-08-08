import { CorrelationFinding } from "./correlationEngine";
import { Prediction } from "./recommendationEngine";
import { RootCauseAnalysis } from "./rootCauseEngine";

export interface HealthFinding {
  issue: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status?: "Active" | "Historical";
  source?: string;
  evidence?: string[];
  timestamp?: string;
}

export interface HealthStatus {
  healthy: boolean;
  applicationHealthy?: boolean;
  kubernetesHealthy?: boolean;

  findings?: HealthFinding[];
  detailedFindings?: HealthFinding[];
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

const SCORE_LIMITS = {
  health: 30,
  rootCause: 25,
  incidents: 20,
  predictions: 15,
  trends: 10,
} as const;

export function scoreIncident(data: IncidentScoreInput): IncidentScore {
  const reasons = new Set<string>();

  const healthScore = calculateHealthScore(data.health, reasons);

  const rootCauseScore = calculateRootCauseScore(data.rootCause, reasons);

  const incidentScore = calculateIncidentScore(
    data.correlations,
    data.health,
    reasons,
  );

  const predictionScore = calculatePredictionScore(data.predictions, reasons);

  const trendScore = calculateTrendScore(data.trends, reasons);

  const score = Math.min(
    100,
    healthScore + rootCauseScore + incidentScore + predictionScore + trendScore,
  );

  const level = getIncidentLevel(score);

  return {
    score,
    level,
    reasons: Array.from(reasons),
    breakdown: {
      health: healthScore,
      rootCause: rootCauseScore,
      incidents: incidentScore,
      predictions: predictionScore,
      trends: trendScore,
    },
  };
}

function calculateHealthScore(
  health: HealthStatus,
  reasons: Set<string>,
): number {
  let score = 0;

  if (!health.healthy) {
    score += 10;
    reasons.add("Overall health degraded");
  }

  if (health.applicationHealthy === false) {
    score += 10;
    reasons.add("Application unhealthy");
  }

  if (health.kubernetesHealthy === false) {
    score += 10;
    reasons.add("Kubernetes unhealthy");
  }

  return Math.min(score, SCORE_LIMITS.health);
}

function calculateRootCauseScore(
  rootCause: RootCauseAnalysis | null,
  reasons: Set<string>,
): number {
  if (!rootCause) {
    return 0;
  }

  reasons.add(`${rootCause.category}: ${rootCause.subcategory}`);

  const categoryWeight = getRootCauseWeight(rootCause.category);

  const confidenceMultiplier = clamp(rootCause.confidence / 100, 0, 1);

  return Math.round(
    Math.min(categoryWeight * confidenceMultiplier, SCORE_LIMITS.rootCause),
  );
}

function getRootCauseWeight(category: RootCauseAnalysis["category"]): number {
  switch (category) {
    case "Infrastructure":
      return 25;

    case "Application":
      return 22;

    case "Resource":
      return 20;

    case "Performance":
      return 16;

    case "Observability":
      return 10;

    default:
      return 5;
  }
}

function calculateIncidentScore(
  correlations: CorrelationFinding[],
  health: HealthStatus,
  reasons: Set<string>,
): number {
  const findings = [
    ...(health.detailedFindings ?? []),
    ...(health.findings ?? []),
  ];

  const uniqueIssues = new Map<
    string,
    {
      severity: CorrelationFinding["severity"];
      status?: "Active" | "Historical";
    }
  >();

  for (const finding of findings) {
    const existing = uniqueIssues.get(finding.issue);

    if (
      !existing ||
      severityWeight(finding.severity) > severityWeight(existing.severity)
    ) {
      uniqueIssues.set(finding.issue, {
        severity: finding.severity,
        status: finding.status,
      });
    }
  }

  for (const correlation of correlations) {
    if (correlation.issue === "System Healthy") {
      continue;
    }

    const existing = uniqueIssues.get(correlation.issue);

    if (
      !existing ||
      severityWeight(correlation.severity) > severityWeight(existing.severity)
    ) {
      uniqueIssues.set(correlation.issue, {
        severity: correlation.severity,
      });
    }
  }

  const issueScores = Array.from(uniqueIssues.entries())
    .map(([issue, value]) => ({
      issue,
      severity: value.severity,
      status: value.status,
      score: incidentSeverityScore(value.severity),
    }))
    .sort((a, b) => b.score - a.score);

  let score = 0;

  for (const [index, incident] of issueScores.slice(0, 4).entries()) {
    let incidentScore = incident.score;

    if (incident.status === "Historical") {
      incidentScore *= 0.75;
    }

    incidentScore *= 1 - diminishingReturn(index);

    score += incidentScore;

    reasons.add(
      `${incident.issue} (${incident.severity}${
        incident.status ? `, ${incident.status}` : ""
      })`,
    );
  }

  return Math.round(Math.min(score, SCORE_LIMITS.incidents));
}

function incidentSeverityScore(
  severity: CorrelationFinding["severity"],
): number {
  switch (severity) {
    case "Critical":
      return 15;

    case "High":
      return 10;

    case "Medium":
      return 6;

    case "Low":
      return 2;

    default:
      return 0;
  }
}

function diminishingReturn(index: number): number {
  switch (index) {
    case 0:
      return 0;

    case 1:
      return 0.25;

    case 2:
      return 0.5;

    case 3:
      return 0.75;

    default:
      return 0.9;
  }
}

function calculatePredictionScore(
  predictions: Prediction[],
  reasons: Set<string>,
): number {
  if (!predictions.length) {
    return 0;
  }

  const validPredictions = predictions.filter(
    (
      prediction,
    ): prediction is Prediction & {
      metric: string;
      probability: number;
    } =>
      typeof prediction.metric === "string" &&
      prediction.metric.length > 0 &&
      typeof prediction.probability === "number" &&
      Number.isFinite(prediction.probability),
  );

  if (!validPredictions.length) {
    return 0;
  }

  const highestRiskByMetric = new Map<
    string,
    (typeof validPredictions)[number]
  >();

  for (const prediction of validPredictions) {
    const existing = highestRiskByMetric.get(prediction.metric);

    if (
      !existing ||
      predictionRiskWeight(prediction.risk) >
        predictionRiskWeight(existing.risk)
    ) {
      highestRiskByMetric.set(prediction.metric, prediction);
    }
  }

  let score = 0;

  for (const prediction of highestRiskByMetric.values()) {
    const probability = clamp(prediction.probability, 0, 1);

    const riskScore = predictionRiskWeight(prediction.risk) * probability;

    score += riskScore;

    reasons.add(`Prediction: ${prediction.message}`);
  }

  return Math.round(Math.min(score, SCORE_LIMITS.predictions));
}

function predictionRiskWeight(risk: Prediction["risk"]): number {
  switch (risk) {
    case "Critical":
      return 10;

    case "High":
      return 8;

    case "Medium":
      return 5;

    case "Low":
      return 2;

    default:
      return 0;
  }
}

function calculateTrendScore(
  trends: TrendSummary | undefined,
  reasons: Set<string>,
): number {
  if (!trends) {
    return 0;
  }

  let score = 0;

  if (trends.cpu?.anomaly) {
    score += 5;
    reasons.add("CPU anomaly detected");
  }

  if (trends.memory?.anomaly) {
    score += 5;
    reasons.add("Memory anomaly detected");
  }

  return Math.min(score, SCORE_LIMITS.trends);
}

function getIncidentLevel(score: number): IncidentScore["level"] {
  if (score >= 80) {
    return "Critical";
  }

  if (score >= 50) {
    return "Major";
  }

  if (score >= 20) {
    return "Warning";
  }

  return "Healthy";
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

    default:
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
