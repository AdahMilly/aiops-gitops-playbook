type TimeSeriesPoint = [number, string];

export interface TrendAnalysis {
  trend: "rising" | "falling" | "stable" | "unknown";
  slope: number;
  first: number;
  current: number;
  average: number;
  minimum: number;
  maximum: number;
  change: number;
  anomaly: boolean;
  findings: string[];
}

export function analyzeTrend(series: TimeSeriesPoint[]): TrendAnalysis {
  if (!series.length) {
    return {
      trend: "unknown",
      slope: 0,
      first: 0,
      current: 0,
      average: 0,
      minimum: 0,
      maximum: 0,
      change: 0,
      anomaly: false,
      findings: [],
    };
  }

  const values = series.map(([, value]) => Number(value));

  const first = values[0];
  const current = values.at(-1)!;

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  const slope = current - first;

  const change = first === 0 ? 0 : ((current - first) / first) * 100;

  let trend: TrendAnalysis["trend"] = "stable";

  if (slope > 0.02) trend = "rising";
  else if (slope < -0.02) trend = "falling";

  const findings: string[] = [];

  if (change > 50) {
    findings.push(
      `Metric increased by ${change.toFixed(1)}% over the selected period.`,
    );
  }

  if (change < -50) {
    findings.push(
      `Metric decreased by ${Math.abs(change).toFixed(1)}% over the selected period.`,
    );
  }

  if (maximum > average * 2) {
    findings.push("Significant spike detected.");
  }

  if (minimum < average * 0.5) {
    findings.push("Significant drop detected.");
  }

  return {
    trend,
    slope,
    first,
    current,
    average,
    minimum,
    maximum,
    change,
    anomaly: findings.length > 0,
    findings,
  };
}
