import { SERVICES } from "../config/services";
import { collectMetrics } from "../services/incidentService";
import { getLogs } from "../services/lokiService";
import { getRecentTraces } from "../services/tempoService";
import { collectEvents } from "./eventCollector";
import { collectTrends } from "./trendCollector";

export async function collectTelemetry() {
  const [metrics, logs, traces, trends, events] = await Promise.all([
    collectMetrics(SERVICES.APP.container),
    getLogs(SERVICES.APP.container),
    getRecentTraces(SERVICES.APP.otel),
    collectTrends(),
    collectEvents(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    service: SERVICES.APP.otel,
    metrics,
    logs,
    traces,
    trends,
    events,
  };
}
