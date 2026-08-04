import { getCPUUsage, getMemoryUsage } from "./prometheusService";

export async function collectMetrics(container: string) {
  const [cpu, memory] = await Promise.all([
    getCPUUsage(container),
    getMemoryUsage(container),
  ]);

  return {
    cpu,
    memory,
  };
}

export async function buildIncident(service: string, container: string) {
  const metrics = await collectMetrics(container);

  return {
    service,
    timestamp: new Date().toISOString(),
    metrics,
  };
}
