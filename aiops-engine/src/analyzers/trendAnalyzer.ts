export type TrendDirection = "rising" | "falling" | "stable";

export interface TrendAnalysis {
  trend: TrendDirection;

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

interface TrendOptions {
  significantChangePercent?: number;
  spikeThresholdPercent?: number;
  minimumPoints?: number;
}

export function analyzeTrend(
  values: number[],
  options: TrendOptions = {},
): TrendAnalysis {
  const {
    significantChangePercent = 20,
    spikeThresholdPercent = 50,
    minimumPoints = 3,
  } = options;

  const cleaned = values.filter((value) => Number.isFinite(value));

  if (!cleaned.length) {
    return {
      trend: "stable",
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

  const first = cleaned[0];
  const current = cleaned[cleaned.length - 1];

  const minimum = Math.min(...cleaned);
  const maximum = Math.max(...cleaned);

  const average =
    cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length;

  const change = first === 0 ? 0 : ((current - first) / Math.abs(first)) * 100;

  let trend: TrendDirection = "stable";

  if (change > 5) {
    trend = "rising";
  } else if (change < -5) {
    trend = "falling";
  }

  const slope = calculateSlope(cleaned);

  const findings: string[] = [];

  if (Math.abs(change) >= significantChangePercent) {
    if (change > 0) {
      findings.push(
        `Metric increased by ${change.toFixed(1)}% over the selected period.`,
      );
    } else {
      findings.push(
        `Metric decreased by ${Math.abs(change).toFixed(1)}% over the selected period.`,
      );
    }
  }

  const hasSpike =
    cleaned.length >= minimumPoints &&
    average > 0 &&
    maximum > average * (1 + spikeThresholdPercent / 100);

  if (hasSpike) {
    findings.push(
      `Metric spike detected: maximum ${formatValue(
        maximum,
      )} is significantly above the average ${formatValue(average)}.`,
    );
  }

  const risingSignificantly =
    trend === "rising" && change >= significantChangePercent;

  const anomaly = hasSpike || risingSignificantly;

  return {
    trend,
    slope,
    first,
    current,
    average,
    minimum,
    maximum,
    change,
    anomaly,
    findings,
  };
}

function calculateSlope(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const n = values.length;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i];

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;

  if (denominator === 0) {
    return 0;
  }

  return (n * sumXY - sumX * sumY) / denominator;
}

function formatValue(value: number): string {
  if (Math.abs(value) < 1) {
    return value.toFixed(4);
  }

  return value.toFixed(2);
}
