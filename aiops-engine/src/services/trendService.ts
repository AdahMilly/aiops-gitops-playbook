import { queryRange } from "./prometheusService";

export async function collectCpuTrend() {
  const end = new Date();
  const start = new Date(end.getTime() - 5 * 60 * 1000);

  return queryRange(
    `rate(container_cpu_usage_seconds_total{namespace="aiops",container="aiops-playbook"}[2m])`,
    start,
    end,
    "30s",
  );
}
