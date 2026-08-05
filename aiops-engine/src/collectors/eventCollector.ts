import { getEvents } from "../services/kubernetesService";

export async function collectEvents() {
  const events = await getEvents();

  return events
    .sort(
      (a, b) =>
        new Date(b.lastTimestamp ?? 0).getTime() -
        new Date(a.lastTimestamp ?? 0).getTime(),
    )
    .slice(0, 30);
}