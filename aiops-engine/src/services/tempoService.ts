import axios from "axios";

const TEMPO_URL = process.env.TEMPO_URL!;

export async function getRecentTraces(service: string) {
  try {
    const response = await axios.get(`${TEMPO_URL}/api/search`);

    const traces = response.data.traces ?? [];

    return traces.filter((trace: any) => trace.rootServiceName === service);
  } catch (error) {
    console.error("Failed to query Tempo:", error);

    return [];
  }
}
