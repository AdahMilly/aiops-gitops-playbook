import axios from "axios";
import { config } from "../config/config";

async function query(query: string) {
  const response = await axios.get(
    `${config.prometheus}/api/v1/query`,
    {
      params: { query },
    }
  );

  return response.data.data.result;
}

export async function getCPUUsage(namespace: string) {
  return query(`
sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}"}[5m]))
by (pod)
`);
}

export async function getMemoryUsage(namespace: string) {
  return query(`
container_memory_usage_bytes{namespace="${namespace}"}
`);
}

export async function getRequestRate(service: string) {
  return query(`
rate(http_server_duration_count{service_name="${service}"}[5m])
`);
}