import fs from "node:fs";
import path from "node:path";

import { Incident } from "../models/Incident";

const STATE_DIR = path.resolve(process.cwd(), "data");
const STATE_FILE = path.join(STATE_DIR, "incident-state.json");

interface IncidentState {
  incidents: Incident[];
  updatedAt: string;
}

export function loadIncidentState(): Incident[] {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(STATE_FILE, "utf-8");

    if (!raw.trim()) {
      return [];
    }

    const state = JSON.parse(raw) as IncidentState;

    if (!Array.isArray(state.incidents)) {
      return [];
    }

    return state.incidents;
  } catch (error) {
    console.error("Failed to load incident state.");

    console.error(error);

    return [];
  }
}

export function saveIncidentState(incidents: Incident[]): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });

    const state: IncidentState = {
      incidents,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save incident state.");

    console.error(error);
  }
}
