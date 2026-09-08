import type { IncidentReport } from "../engines/generateIncidentReport";
import {
  orchestrateAILayer,
  type AIOrchestrationResult,
} from "./aiOrchestrator";
import {
  buildAIRemediationPlan,
  type AIRemediationAction,
  type AIRemediationPlan,
} from "./aiRemediationPlanner";
import {
  executeRemediationPlan,
  type RemediationExecutionReport,
  type RemediationExecutionMode,
} from "./remediationExecutor";

export type AgenticRemediationState =
  | "DETECTED"
  | "DIAGNOSED"
  | "PLANNED"
  | "POLICY_BLOCKED"
  | "AWAITING_APPROVAL"
  | "EXECUTING"
  | "VERIFYING"
  | "RESOLVED"
  | "FAILED";
export interface AgenticRemediationOptions {
  mode?: RemediationExecutionMode;
  maxActions?: number;
  approvalIds?: string[];
  verify?: boolean;
}
export interface AgenticRemediationStep {
  state: AgenticRemediationState;
  message: string;
  timestamp: string;
}
export interface AgenticRemediationResult {
  incidentGeneratedAt: string;
  state: AgenticRemediationState;
  resolved: boolean;
  stopped: boolean;
  score?: number;
  level?: string;
  ai: AIOrchestrationResult;
  plan: AIRemediationPlan | null;
  execution: RemediationExecutionReport | null;
  steps: AgenticRemediationStep[];
  attemptedActions: number;
  maxActions: number;
  reason: string;
  startedAt: string;
  completedAt: string;
}

const DEFAULT_MAX_ACTIONS = 3;

function addStep(
  steps: AgenticRemediationStep[],
  state: AgenticRemediationState,
  message: string,
): void {
  steps.push({
    state,
    message,
    timestamp: new Date().toISOString(),
  });
}

function getScore(report: IncidentReport): number | undefined {
  return typeof report.summary?.score === "number"
    ? report.summary.score
    : undefined;
}

function getLevel(report: IncidentReport): string | undefined {
  return typeof report.summary?.level === "string"
    ? report.summary.level
    : undefined;
}

function hasActiveIncident(report: IncidentReport): boolean {
  if (report.health?.healthy === false) {
    return true;
  }
  const findings = report.health?.detailedFindings ?? [];
  return findings.some(
    (finding: { status?: string }) =>
      finding.status?.toLowerCase() === "active",
  );
}

function sortActionsDeterministically(
  actions: AIRemediationAction[],
): AIRemediationAction[] {
  const riskWeight: Record<AIRemediationAction["risk"], number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return [...actions].sort((a, b) => {
    const riskDifference = riskWeight[a.risk] - riskWeight[b.risk];
    if (riskDifference !== 0) {
      return riskDifference;
    }
    return a.id.localeCompare(b.id);
  });
}

function getSafeMaxActions(value?: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_ACTIONS;
  }
  return Math.min(Math.max(Math.floor(value as number), 1), 3);
}

function determineFinalState(execution: RemediationExecutionReport): {
  state: AgenticRemediationState;
  resolved: boolean;
  reason: string;
} {
  if (execution.awaitingApprovalCount > 0) {
    return {
      state: "AWAITING_APPROVAL",
      resolved: false,
      reason: "Remediation requires explicit human approval before execution.",
    };
  }
  if (
    execution.blockedCount > 0 &&
    execution.executedCount === 0 &&
    execution.failedCount === 0
  ) {
    return {
      state: "POLICY_BLOCKED",
      resolved: false,
      reason:
        "All executable remediation paths were blocked by deterministic policy.",
    };
  }
  if (execution.failedCount > 0) {
    return {
      state: "FAILED",
      resolved: false,
      reason:
        "One or more remediation actions failed during execution or verification.",
    };
  }
  if (execution.verificationFailedCount > 0) {
    return {
      state: "FAILED",
      resolved: false,
      reason:
        "Remediation executed, but deterministic verification did not confirm recovery.",
    };
  }
  if (execution.executedCount > 0) {
    return {
      state: "RESOLVED",
      resolved: true,
      reason:
        "Remediation executed and deterministic verification confirmed the resulting state.",
    };
  }
  if (execution.validatedCount > 0) {
    return {
      state: "PLANNED",
      resolved: false,
      reason:
        "Remediation was validated in dry-run mode; no infrastructure changes were made.",
    };
  }
  return {
    state: "FAILED",
    resolved: false,
    reason: "No remediation action was executed.",
  };
}

export async function runAgenticRemediationLoop(
  incidentReport: IncidentReport,
  options: AgenticRemediationOptions = {},
): Promise<AgenticRemediationResult> {
  const startedAt = new Date().toISOString();

  const mode = options.mode ?? "observe";
  const maxActions = getSafeMaxActions(options.maxActions);

  const steps: AgenticRemediationStep[] = [];

  addStep(steps, "DETECTED", "Deterministic incident report received.");

  if (!hasActiveIncident(incidentReport)) {
    addStep(
      steps,
      "RESOLVED",
      "No active deterministic incident requires remediation.",
    );
    return {
      incidentGeneratedAt: incidentReport.generatedAt,
      state: "RESOLVED",
      resolved: true,
      stopped: true,
      score: getScore(incidentReport),
      level: getLevel(incidentReport),
      ai: {
        available: false,
        mode: "unavailable",
        provider: "not-required",
        analysis: null,
        error: null,
      },
      plan: null,
      execution: null,
      steps,
      attemptedActions: 0,
      maxActions,
      reason: "No active incident detected.",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  addStep(
    steps,
    "DIAGNOSED",
    "Active incident confirmed from deterministic health findings.",
  );

  const ai = await orchestrateAILayer(incidentReport);

  if (!ai.analysis) {
    addStep(
      steps,
      "FAILED",
      "AI analysis and deterministic fallback were unavailable. Remediation stopped safely.",
    );

    return {
      incidentGeneratedAt: incidentReport.generatedAt,
      state: "FAILED",
      resolved: false,
      stopped: true,
      score: getScore(incidentReport),
      level: getLevel(incidentReport),
      ai,
      plan: null,
      execution: null,
      steps,
      attemptedActions: 0,
      maxActions,
      reason: ai.error ?? "No AI analysis was available.",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  const plan = buildAIRemediationPlan(incidentReport, ai.analysis);

  addStep(
    steps,
    "PLANNED",
    `Deterministic remediation pipeline received ${plan.actions.length} candidate action(s).`,
  );
  const orderedActions = sortActionsDeterministically(plan.actions);

  const boundedActions = orderedActions.slice(0, maxActions);

  const boundedPlan: AIRemediationPlan = {
    ...plan,
    actions: boundedActions,
  };

  if (boundedPlan.actions.length === 0) {
    addStep(
      steps,
      "POLICY_BLOCKED",
      "No executable remediation actions were produced.",
    );
    return {
      incidentGeneratedAt: incidentReport.generatedAt,
      state: "POLICY_BLOCKED",
      resolved: false,
      stopped: true,
      score: getScore(incidentReport),
      level: getLevel(incidentReport),
      ai,
      plan: boundedPlan,
      execution: null,
      steps,
      attemptedActions: 0,
      maxActions,
      reason: "No executable remediation actions were available.",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
  if (mode === "observe") {
    addStep(
      steps,
      "VERIFYING",
      "Observe mode selected; remediation will be evaluated without infrastructure changes.",
    );
  } else if (mode === "dry-run") {
    addStep(
      steps,
      "EXECUTING",
      "Dry-run mode selected; remediation will be validated without infrastructure changes.",
    );
  } else {
    addStep(
      steps,
      "EXECUTING",
      "Execute mode selected; executor will perform final policy and approval checks before infrastructure changes.",
    );
  }

  const execution = await executeRemediationPlan(boundedPlan, mode, {
    approvalIds: options.approvalIds,
    verify: options.verify ?? true,
  });

  const attemptedActions = execution.results.length;

  if (execution.awaitingApprovalCount > 0) {
    addStep(
      steps,
      "AWAITING_APPROVAL",
      "Execution stopped because one or more remediation actions require explicit approval.",
    );
  } else if (mode === "execute" && execution.executedCount > 0) {
    addStep(
      steps,
      "VERIFYING",
      "Remediation execution completed; deterministic verification was evaluated by the executor.",
    );
  }

  const final = determineFinalState(execution);

  addStep(steps, final.state, final.reason);

  return {
    incidentGeneratedAt: incidentReport.generatedAt,
    state: final.state,
    resolved: final.resolved,
    stopped: true,
    score: getScore(incidentReport),
    level: getLevel(incidentReport),
    ai,
    plan: boundedPlan,
    execution,
    steps,
    attemptedActions,
    maxActions,
    reason: final.reason,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
