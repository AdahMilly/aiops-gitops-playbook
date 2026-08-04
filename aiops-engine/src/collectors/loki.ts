import axios from "axios";
import { config } from "../config/config";

export async function queryLogs(service: string) {
  const response = await axios.get(`${config.loki}/loki/api/v1/query_range`, {
    params: {
      query: `{app="${service}"}`,
      limit: 20,
    },
  });

  return response.data.data.result;
}
