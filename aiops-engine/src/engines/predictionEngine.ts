import { CorrelationFinding } from "./correlationEngine";
import { RootCauseAnalysis } from "./rootCauseEngine";

export interface TrendSummary {
  cpu: {
    trend: string;
    anomaly: boolean;
  };
  memory: {
    trend: string;
    anomaly: boolean;
  };
}

export interface HealthStatus {
  cpu: string;
  memory: string;
  healthy: boolean;
  applicationHealthy?: boolean;
  kubernetesHealthy?: boolean;
}

export interface Prediction {
  metric: string;
  risk: "Low" | "Medium" | "High" | "Critical";
  probability: number;
  message: string;
  horizon: string;
}

interface PredictionInput {
  health: HealthStatus;
  trends: TrendSummary;
  correlations: CorrelationFinding[];
  rootCause: RootCauseAnalysis | null;
}

export function predict(data: PredictionInput): Prediction[] {
  const predictions: Prediction[] = [];

  const cpu = Number.parseFloat(data.health.cpu);
  const memory = Number.parseFloat(data.health.memory);

  const activeNodeFailure =
    data.rootCause?.subcategory === "Node Failure" &&
    data.rootCause?.status !== "Historical";

  if (activeNodeFailure) {
    predictions.push({
      metric: "Cluster Availability",
      risk: "Critical",
      probability: 0.98,
      horizon: "5-15 minutes",
      message:
        "Additional workloads may become unavailable while the affected Kubernetes node remains unhealthy.",
    });
  }

  const applicationCurrentlyUnhealthy =
    data.health.applicationHealthy === false;

  if (applicationCurrentlyUnhealthy) {
    predictions.push({
      metric: "Application Availability",
      risk: "Critical",
      probability: 0.96,
      horizon: "10 minutes",
      message:
        "Readiness and liveness failures are likely to continue until the application or its dependencies recover.",
    });
  }

  if (data.trends.cpu.trend.toLowerCase() === "rising" && cpu > 60) {
    predictions.push({
      metric: "CPU",
      risk: "High",
      probability: 0.91,
      horizon: "30 minutes",
      message:
        "CPU utilization is increasing and may reach saturation if the trend continues.",
    });
  }

  if (data.trends.memory.trend.toLowerCase() === "rising" && memory > 250) {
    predictions.push({
      metric: "Memory",
      risk: "High",
      probability: 0.89,
      horizon: "45 minutes",
      message:
        "Memory growth indicates a possible memory leak if left unresolved.",
    });
  }

  const hasSlowApplicationRequests = data.correlations.some(
    (finding) => finding.issue === "Slow application requests",
  );

  if (hasSlowApplicationRequests) {
    predictions.push({
      metric: "Latency",
      risk: "Medium",
      probability: 0.75,
      horizon: "20 minutes",
      message:
        "Increasing request latency may degrade user experience if traffic increases.",
    });
  }

  const tracingUnavailable = data.correlations.some(
    (finding) => finding.issue === "Tracing unavailable",
  );

  if (tracingUnavailable) {
    predictions.push({
      metric: "Observability",
      risk: "Medium",
      probability: 0.82,
      horizon: "Immediate",
      message:
        "Future incidents may become harder to diagnose while distributed tracing remains unavailable.",
    });
  }

  if (predictions.length === 0) {
    predictions.push({
      metric: "System",
      risk: "Low",
      probability: 0.97,
      horizon: "1 hour",
      message:
        "No immediate operational risks predicted. Historical incidents were detected but no active risk currently requires intervention.",
    });
  }

  return predictions.sort((a, b) => riskWeight(b.risk) - riskWeight(a.risk));
}

function riskWeight(risk: Prediction["risk"]): number {
  switch (risk) {
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
