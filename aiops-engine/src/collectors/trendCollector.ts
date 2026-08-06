import { getCPUHistory, getMemoryHistory } from "../services/prometheusService";

import { SERVICES } from "../config/services";
import { analyzeTrend } from "../analyzers/trendAnalyzer";

export async function collectTrends() {
  const [cpuHistory, memoryHistory] = await Promise.all([
    getCPUHistory(SERVICES.APP.container),
    getMemoryHistory(SERVICES.APP.container),
  ]);

  return {
    cpu: analyzeTrend(cpuHistory[0]?.values ?? []),
    memory: analyzeTrend(memoryHistory[0]?.values ?? []),
  };
}
