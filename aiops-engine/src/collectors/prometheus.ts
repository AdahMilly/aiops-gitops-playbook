import axios from "axios";
import { config } from "../config/config";

export async function queryPrometheus(query: string) {
  const response = await axios.get(`${config.prometheus}/api/v1/query`, {
    params: {
      query,
    },
  });

  return response.data.data.result;
}
