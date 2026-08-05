export interface IncidentScore {
  score: number;
  level: "Healthy" | "Warning" | "Major" | "Critical";
  reasons: string[];
}

export function scoreIncident(data: {
  health: any;
  correlations: any[];
  predictions: any[];
}): IncidentScore {
  let score = 0;
  const reasons: string[] = [];

  if (!data.health.healthy) {
    score += 20;
    reasons.push("Application health degraded");
  }

  for (const finding of data.correlations) {
    switch (finding.severity) {
      case "Critical":
        score += 30;
        reasons.push(finding.issue);
        break;

      case "High":
        score += 20;
        reasons.push(finding.issue);
        break;

      case "Medium":
        score += 10;
        reasons.push(finding.issue);
        break;

      case "Low":
        score += 0;
        break;
    }
  }

  for (const prediction of data.predictions) {
    switch (prediction.risk) {
      case "Critical":
        score += 25;
        reasons.push(prediction.message);
        break;

      case "High":
        score += 15;
        reasons.push(prediction.message);
        break;

      case "Medium":
        score += 8;
        reasons.push(prediction.message);
        break;

      case "Low":
        score += 0;
        break;
    }
  }

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
    reasons: Array.from(new Set(reasons)),
  };
}