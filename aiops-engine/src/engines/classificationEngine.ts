export interface IncidentClassification {
  category:
    | "Infrastructure"
    | "Application"
    | "Network"
    | "Database"
    | "Deployment"
    | "Observability"
    | "Performance"
    | "Unknown";

  subcategory: string;

  confidence: number;

  evidence: string[];
}
export function classifyIncident(data: {
  causes: any[];
  correlations: any[];
  events: any[];
}): IncidentClassification {
  const evidence: string[] = [];

  if (
    data.correlations.some((c) => c.issue === "NodeNotReady") ||
    data.events.some((e) => e.reason === "NodeNotReady")
  ) {
    evidence.push("Kubernetes reported NodeNotReady");

    return {
      category: "Infrastructure",
      subcategory: "Node Failure",
      confidence: 98,
      evidence,
    };
  }

  if (
    data.events.some(
      (e) =>
        e.reason === "Unhealthy" && e.message.includes("Liveness probe failed"),
    )
  ) {
    evidence.push("Liveness probe failures detected");

    return {
      category: "Application",
      subcategory: "Application Unhealthy",
      confidence: 95,
      evidence,
    };
  }

  if (data.causes.some((c) => c.title === "Memory Leak")) {
    evidence.push("Memory continuously increasing");

    return {
      category: "Performance",
      subcategory: "Memory Leak",
      confidence: 94,
      evidence,
    };
  }

  if (data.causes.some((c) => c.title === "High CPU Usage")) {
    evidence.push("CPU above threshold");

    return {
      category: "Performance",
      subcategory: "CPU Saturation",
      confidence: 92,
      evidence,
    };
  }

  if (data.causes.some((c) => c.title === "Tracing Missing")) {
    evidence.push("No traces available");

    return {
      category: "Observability",
      subcategory: "Tracing Failure",
      confidence: 96,
      evidence,
    };
  }

  return {
    category: "Unknown",
    subcategory: "Healthy",
    confidence: 100,
    evidence: ["No incident detected"],
  };
}