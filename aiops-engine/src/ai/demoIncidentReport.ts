import type { IncidentReport } from "../engines/generateIncidentReport";

export function createDemoIncidentReport(): IncidentReport {
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    summary: {
      score: 90,
      level: "Critical",
      healthy: false,
    },
    health: {
      healthy: false,
      applicationHealthy: false,
      kubernetesHealthy: false,
      status: "Critical",
      activeIncidentCount: 2,
      detailedFindings: [
        {
          issue: "NodeNotReady",
          severity: "High",
          status: "Active",
          source: "Kubernetes",
          evidence: [
            "Node worker-node-01 is reporting NotReady.",
            "Kubernetes node readiness condition is false.",
          ],
          timestamp: generatedAt,
        },
        {
          issue: "ReadinessProbeFailure",
          severity: "High",
          status: "Active",
          source: "Application",
          evidence: [
            "Readiness probe failed.",
            "context deadline exceeded.",
            "Application is not reporting ready.",
            "Affected deployment target: aiops-engine.",
          ],
          timestamp: generatedAt,
        },
        {
          issue: "LivenessProbeFailure",
          severity: "Medium",
          status: "Historical",
          source: "Application",
          evidence: [
            "Liveness probe previously failed.",
            "Finding has been resolved.",
          ],
          timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    trends: {
      direction: "degrading",
      summary:
        "Application and Kubernetes health are showing a degrading trend.",
    },
    rootCause: {
      category: "Infrastructure",
      subcategory: "Node Failure",
      confidence: 98,
      evidence: [
        "Node worker-node-01 is reporting NotReady.",
        "Kubernetes node readiness condition is false.",
      ],
      status: "Active",
      source: "Kubernetes",
    },
    incidentGroups: [
      {
        id: "incident-infrastructure-node",
        title: "Kubernetes Node Failure",
        category: "Infrastructure",
        severity: "High",
        findings: [
          {
            issue: "NodeNotReady",
            severity: "High",
            status: "Active",
            source: "Kubernetes",
            evidence: ["Node worker-node-01 is reporting NotReady."],
            timestamp: generatedAt,
          },
        ],
        evidence: [
          "Node worker-node-01 is reporting NotReady.",
          "Kubernetes node readiness condition is false.",
        ],
        affectedPods: [],
      },
      {
        id: "incident-application-readiness",
        title: "Application Readiness Failure",
        category: "Application",
        severity: "High",
        findings: [
          {
            issue: "ReadinessProbeFailure",
            severity: "High",
            status: "Active",
            source: "Application",
            evidence: ["Readiness probe failed.", "context deadline exceeded."],
            timestamp: generatedAt,
          },
        ],
        evidence: ["Readiness probe failed.", "context deadline exceeded."],
        affectedPods: [],
      },
    ],
    correlations: [],
    predictions: [
      {
        issue: "Availability degradation",
        probability: 0.8,
        horizon: "near-term",
        confidence: 0.8,
        evidence: [
          "Active NodeNotReady finding.",
          "Active ReadinessProbeFailure finding.",
        ],
      } as any,
    ],
    recommendations: [
      {
        title: "Inspect Kubernetes node health",
        priority: "High",
        reason: "An active Kubernetes node failure was detected.",
      },
    ] as any,
    timeline: [
      {
        timestamp: generatedAt,
        type: "Incident",
        message:
          "Critical infrastructure and application health findings detected.",
      },
    ] as any,
    incidentLifecycle: {
      incidents: [
        {
          issue: "NodeNotReady",
          severity: "High",
          status: "Active",
          source: "Kubernetes",
        } as any,
        {
          issue: "ReadinessProbeFailure",
          severity: "High",
          status: "Active",
          source: "Application",
        } as any,
        {
          issue: "LivenessProbeFailure",
          severity: "Medium",
          status: "Historical",
          source: "Application",
        } as any,
      ],
      activeIncidents: [
        {
          issue: "NodeNotReady",
          severity: "High",
          status: "Active",
          source: "Kubernetes",
        } as any,
        {
          issue: "ReadinessProbeFailure",
          severity: "High",
          status: "Active",
          source: "Application",
        } as any,
      ],
      resolvedIncidents: [],
      newIncidents: [
        {
          issue: "NodeNotReady",
          severity: "High",
          status: "Active",
          source: "Kubernetes",
        } as any,
        {
          issue: "ReadinessProbeFailure",
          severity: "High",
          status: "Active",
          source: "Application",
        } as any,
      ],
      historicalIncidents: [
        {
          issue: "LivenessProbeFailure",
          severity: "Medium",
          status: "Historical",
          source: "Application",
        } as any,
      ],
    },
  } as IncidentReport;
}
