import axios from "axios";

const LOKI_URL = process.env.LOKI_URL!;

export async function getLogs(service: string) {
  try {
    const response = await axios.get(`${LOKI_URL}/loki/api/v1/query_range`, {
      params: {
        query: `{namespace="aiops"}`,
        limit: 20,
      },
    });

    return response.data.data.result;
  } catch (err) {
    console.error("Failed to query Loki");

    return [];
  }
}
