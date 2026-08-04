export interface MetricResult {
  metric: Record<string, string>;
  value: [number, string];
}

export interface TraceSummary {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  durationMs: number;
}

export interface LogEntry {
  timestamp: string;
  line: string;
}

export interface IncidentContext {
  service: string;
  timestamp: string;

  metrics: {
    cpu: MetricResult[];
    memory: MetricResult[];
    requests: MetricResult[];
  };

  traces: TraceSummary[];

  logs: LogEntry[];

  kubernetes: {
    podName?: string;
    restartCount?: number;
    events?: string[];
  };
}
export interface Metrics {
  cpu: number;
  memory: number;
}

export interface Telemetry {
  service: string;
  timestamp: string;
  metrics: Metrics;
  logs: unknown[];
  traces: unknown[];
}

export interface HealthReport {
  cpu: string;
  memory: string;
  healthy: boolean;
  findings: string[];
}