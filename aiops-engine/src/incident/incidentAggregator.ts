import { Incident } from "../models/Incident";
import { mergeIncidents } from "./mergeIncidents";

interface AggregatorInput {
  incidents: Incident[];
}

export function aggregateIncidents({ incidents }: AggregatorInput): Incident[] {
  return mergeIncidents(incidents).sort((a, b) => b.confidence - a.confidence);
}
