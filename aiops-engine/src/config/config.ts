import dotenv from "dotenv";

dotenv.config();

export const config = {
  prometheus:
    process.env.PROMETHEUS_URL ??
    "http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090",

  loki:
    process.env.LOKI_URL ??
    "http://loki.monitoring.svc.cluster.local:3100",

  tempo:
    process.env.TEMPO_URL ??
    "http://tempo.monitoring.svc.cluster.local:3200",
};