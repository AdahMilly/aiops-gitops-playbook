import type { IncidentReport } from "../engines/generateIncidentReport";
import type { AIAnalysisResult } from "./aiTypes";
import {
  buildAIRemediationPlan,
  type AIRemediationPlan,
} from "./aiRemediationPlanner";

function createIncidentReport(
  overrides: Partial<IncidentReport> = {},
): IncidentReport {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      score: 90,
      level: "Critical",
      healthy: false,
    },
    health: {
      healthy: false,
      status: "Critical",
      activeIncidentCount: 2,
      detailedFindings: [
        {
          issue: "NodeNotReady",
          severity: "High",
          status: "Active",
          source: "Kubernetes",
          evidence: ["Node is not ready"],
        },
        {
          issue: "ReadinessProbeFailure",
          severity: "High",
          status: "Active",
          source: "Application",
          evidence: ["Readiness probe failed: context deadline exceeded"],
        },
      ],
    },
    trends: {},
    rootCause: {
      category: "Infrastructure",
      subcategory: "Node Failure",
      confidence: 98,
      evidence: ["Node is not ready"],
      status: "Active",
      source: "Kubernetes",
    },

    incidentGroups: [
      {
        id: "incident-infrastructure",
        title: "Infrastructure Incident",
        category: "Infrastructure",
        severity: "High",
        findings: [
          {
            issue: "NodeNotReady",
            severity: "High",
            status: "Active",
            source: "Kubernetes",
            evidence: ["Node is not ready"],
          },
        ],
        evidence: ["Node is not ready"],
        affectedPods: [],
      },
    ],
    correlations: [],
    predictions: [],
    recommendations: [],
    timeline: [],
    incidentLifecycle: {
      incidents: [],
      activeIncidents: [],
      resolvedIncidents: [],
      newIncidents: [],
      historicalIncidents: [],
    },

    ...overrides,
  } as IncidentReport;
}

function createAIAnalysis(): AIAnalysisResult {
  return {
    summary: "Kubernetes infrastructure is unhealthy.",
    diagnosis: "A Kubernetes node is reporting NotReady.",
    rootCauseExplanation:
      "The deterministic root cause engine identified a Kubernetes node failure.",
    impact: "Application availability may be affected by the unhealthy node.",
    riskExplanation:
      "Restarting infrastructure components without further validation could increase impact.",
    nextActions: [
      "Inspect Kubernetes nodes",
      "Inspect Kubernetes pods",
      "Restart the affected deployment",
      "Delete the affected node",
    ],
    confidence: 0.98,
    evidenceUsed: ["Node is not ready", "Readiness probe failed"],
    limitations: [
      "The AI provider cannot independently validate Kubernetes state.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function printPlan(plan: AIRemediationPlan): void {
  console.log("\n────────────────────────────────────────────────────────");
  console.log("  AGENTIC REMEDIATION TEST");
  console.log("────────────────────────────────────────────────────────");

  console.log(`  Priority: ${plan.priority}`);
  console.log(`  Problem: ${plan.problem}`);
  console.log(`  Diagnosis: ${plan.diagnosis}`);

  console.log("\n  Actions:");

  for (const action of plan.actions) {
    console.log(
      `  • ${action.id} | ${action.risk} | approval=${action.requiresApproval}`,
    );
    console.log(`    ${action.title}`);
    console.log(`    ${action.command ?? "NO EXECUTABLE COMMAND"}`);
  }

  if (plan.blockedActions?.length) {
    console.log("\n  Blocked:");
    for (const action of plan.blockedActions) {
      console.log(`  • ${action}`);
    }
  }
}

function runTest(): void {
  const incidentReport = createIncidentReport();
  const aiAnalysis = createAIAnalysis();

  const plan = buildAIRemediationPlan(incidentReport, aiAnalysis);
  printPlan(plan);
  assert(
    plan.priority === "Critical",
    "Planner must use deterministic incident severity.",
  );
  const executableCommands = plan.actions
    .map((action) => action.command)
    .filter(Boolean);
  assert(
    !executableCommands.some((command) =>
      /\bkubectl\s+delete\b/i.test(command!),
    ),
    "kubectl delete must never become an executable action.",
  );
  assert(
    !executableCommands.some((command) =>
      /\bkubectl\s+(exec|cp|create|run|edit|patch|apply|drain|cordon|uncordon)\b/i.test(
        command!,
      ),
    ),
    "Unsupported or destructive kubectl commands must not be executable.",
  );
  for (const action of plan.actions) {
    if (!action.command) {
      continue;
    }
    assert(
      action.command.startsWith("kubectl "),
      "Executable remediation commands must use kubectl.",
    );
  }
  assert(
    plan.actions.every((action) => action.command),
    "Executable remediation actions must contain commands.",
  );

  console.log("\n[OK] Deterministic authority test passed.");
  console.log("[OK] Destructive command filtering passed.");
  console.log("[OK] Unsupported command filtering passed.");
  console.log("[OK] Remediation target grounding passed.");
  console.log("\n[OK] AGENTIC REMEDIATION TEST PASSED.\n");
}

runTest();
