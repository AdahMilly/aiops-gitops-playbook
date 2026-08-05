import axios from "axios";
import dotenv from "dotenv";
import { SERVICES } from "../config/services";

dotenv.config();

const PROMETHEUS_URL = process.env.PROMETHEUS_URL!;

if (!PROMETHEUS_URL) {
  throw new Error("PROMETHEUS_URL is not defined");
}

export async function query(query: string) {
  const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
    params: { query },
  });

  return response.data.data.result;
}

export async function queryRange(
  query: string,
  start: Date,
  end: Date,
  step = "30s",
) {
  const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
    params: {
      query,
      start: start.toISOString(),
      end: end.toISOString(),
      step,
    },
  });

  return response.data.data.result;
}
export async function getCPUUsage(container: string) {
  const result = await query(`
    rate(
      container_cpu_usage_seconds_total{
        namespace="aiops",
        container="${container}"
      }[2m]
    )
  `);

  return result.length ? Number(result[0].value[1]) : 0;
}

export async function getMemoryUsage(container: string) {
  const result = await query(`
    container_memory_usage_bytes{
      namespace="aiops",
      container="${container}"
    }
  `);

  return result.length ? Number(result[0].value[1]) : 0;
}

export async function getRequestRate(service: string): Promise<number> {
  const result = await query(`
    rate(
      http_requests_total{
        service="${service}"
      }[5m]
    )
  `);

  if (!result.length) return 0;

  return Number(result[0].value[1]);
}

export async function getCPUHistory(container: string, minutes = 15) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);

  return queryRange(
    `
    rate(
      container_cpu_usage_seconds_total{
        namespace="${SERVICES.APP.namespace}",
        container="${container}"
      }[2m]
    )
    `,
    start,
    end,
    "30s",
  );
}

export async function getMemoryHistory(container: string, minutes = 15) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);

  return queryRange(
    `
    container_memory_usage_bytes{
      namespace="${SERVICES.APP.namespace}",
      container="${container}"
    }
    `,
    start,
    end,
    "30s",
  );
}