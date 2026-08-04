export function analyzeTrend(series: any[]) {
  if (!series.length) {
    return {
      trend: "unknown",
      slope: 0,
    };
  }

  const values = series.map((v) => Number(v[1]));

  const first = values[0];
  const last = values[values.length - 1];

  const slope = last - first;

  let trend = "stable";

  if (slope > 0.02) trend = "rising";
  if (slope < -0.02) trend = "falling";

  return {
    trend,
    slope,
    current: last,
    first,
  };
}
