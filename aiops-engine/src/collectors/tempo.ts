import axios from "axios";
import { config } from "../config/config";

export async function getRecentTraces(service: string) {
  const response = await axios.get(
    `${config.tempo}/api/search`,
    {
      params: {
        service,
        limit: 20,
      },
    }
  );

  return response.data.traces;
}