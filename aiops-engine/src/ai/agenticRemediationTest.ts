import type { IncidentReport } from "../engines/generateIncidentReport";

import type { AIAnalysisResult } from "./aiTypes";

import {
  buildAIRemediationPlan,
  type AIRemediationPlan,
} from "./aiRemediationPlanner";
import { logger } from "../utils/logger";


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

    impact:
      "Application availability may be affected by the unhealthy node.",

    riskExplanation:
      "Restarting infrastructure components without further validation could increase impact.",

    nextActions: [
      "Inspect Kubernetes nodes",
      "Inspect Kubernetes pods",
      "Restart the affected deployment",
      "Delete the affected node",
    ],

    confidence: 0.98,

    evidenceUsed: [
      "Node is not ready",
      "Readiness probe failed",
    ],

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
  logger.section("Agentic Remediation Test");

  logger.item(`Priority: ${plan.priority}`);
  logger.item(`Problem: ${plan.problem}`);
  logger.item(`Diagnosis: ${plan.diagnosis}`);

  logger.blank();

  logger.info("Actions:");

  for (const action of plan.actions) {
    logger.item(
      `${action.id} | ${action.risk} | approval=${action.requiresApproval}`,
    );

    logger.step(action.title);
    logger.step(action.command ?? "NO EXECUTABLE COMMAND");
  }

  if (plan.blockedActions?.length) {
    logger.blank();

    logger.warn("Blocked:");

    for (const action of plan.blockedActions) {
      logger.item(action);
    }
  }

  logger.blank();
}

function runTest(): void {
  logger.section("Starting Agentic Remediation Tests");

  const incidentReport = createIncidentReport();
  logger.success("Incident report created.");

  const aiAnalysis = createAIAnalysis();
  logger.success("AI analysis created.");

  const plan = buildAIRemediationPlan(
    incidentReport,
    aiAnalysis,
  );

  logger.success("Remediation plan generated.");

  printPlan(plan);

  logger.info("Validating deterministic authority...");

  assert(
    plan.priority === "Critical",
    "Planner must use deterministic incident severity.",
  );

  logger.success("Deterministic authority validation passed.");

  const executableCommands = plan.actions
    .map((action) => action.command)
    .filter(Boolean);

  logger.info("Validating destructive command filtering...");

  assert(
    !executableCommands.some((command) =>
      /\bkubectl\s+delete\b/i.test(command!),
    ),
    "kubectl delete must never become an executable action.",
  );

  logger.success("Destructive command filtering passed.");

  logger.info("Validating unsupported command filtering...");

  assert(
    !executableCommands.some((command) =>
      /\bkubectl\s+(exec|cp|create|run|edit|patch|apply|drain|cordon|uncordon)\b/i.test(
        command!,
      ),
    ),
    "Unsupported or destructive kubectl commands must not be executable.",
  );

  logger.success("Unsupported command filtering passed.");

  logger.info("Validating remediation target grounding...");

  for (const action of plan.actions) {
    if (!action.command) {
      continue;
    }

    assert(
      action.command.startsWith("kubectl "),
      "Executable remediation commands must use kubectl.",
    );
  }

  logger.success("Remediation target grounding passed.");

  logger.info("Validating executable actions...");

  assert(
    plan.actions.every((action) => action.command),
    "Executable remediation actions must contain commands.",
  );

  logger.success("Executable action validation passed.");

  logger.blank();

  logger.success("AGENTIC REMEDIATION TEST PASSED.");

  logger.blank();
}

try {
  runTest();
} catch (error: unknown) {
  logger.error("AGENTIC REMEDIATION TEST FAILED.");

  if (error instanceof Error) {
    logger.error(error.message);

    if (error.stack) {
      logger.debug(error.stack);
    }
  } else {
    logger.error("Unknown test failure.", error);
  }

  process.exitCode = 1;
}