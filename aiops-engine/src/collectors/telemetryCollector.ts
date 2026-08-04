import { SERVICES } from "../config/services";
import { collectMetrics } from "../services/incidentService";
import { getLogs } from "../services/lokiService";
import { getRecentTraces } from "../services/tempoService";

export async function collectTelemetry() {
  const [metrics, logs, traces] = await Promise.all([
    collectMetrics(SERVICES.APP.container),
    getLogs(SERVICES.APP.container),
    getRecentTraces(SERVICES.APP.otel),
  ]);

  return {
    timestamp: new Date().toISOString(),
    service: SERVICES.APP.otel,
    metrics,
    logs,
    traces,
  };
}
