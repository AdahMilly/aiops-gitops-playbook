export interface Prediction {
  risk: "Low" | "Medium" | "High";
  probability: number;
  message: string;
}

export function predict(data: {
  health: any;
  trends: any;
  correlations: any[];
}): Prediction[] {
  const predictions: Prediction[] = [];

  const cpu = Number.parseFloat(data.health.cpu);
  const memory = Number.parseFloat(data.health.memory);

  if (data.trends.cpu.trend === "rising" && cpu > 60) {
    predictions.push({
      risk: "High",
      probability: 0.91,
      message:
        "CPU is trending upward. Service may become saturated within the next 30 minutes.",
    });
  }

  if (data.trends.memory.trend === "rising" && memory > 250) {
    predictions.push({
      risk: "High",
      probability: 0.89,
      message: "Memory usage suggests a potential leak if the trend continues.",
    });
  }

  if (data.correlations.some((c) => c.issue === "Slow application requests")) {
    predictions.push({
      risk: "Medium",
      probability: 0.74,
      message: "Latency is increasing. User response times may degrade soon.",
    });
  }

  if (predictions.length === 0) {
    predictions.push({
      risk: "Low",
      probability: 0.97,
      message: "No immediate operational risks predicted.",
    });
  }

  return predictions;
}
