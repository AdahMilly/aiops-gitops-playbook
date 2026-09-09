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

  return Math.min(
    Math.max(Math.floor(value as number), 1),
    DEFAULT_MAX_ACTIONS,
  );
}

function selectBoundedActions(
  actions: AIRemediationAction[],
  maxActions: number,
): AIRemediationAction[] {
  if (actions.length <= maxActions) {
    return actions;
  }

  const bounded = actions.slice(0, maxActions);
  const highestRiskAction = actions[actions.length - 1];

  const alreadyIncluded = bounded.some(
    (action) => action.id === highestRiskAction.id,
  );

  if (alreadyIncluded) {
    return bounded;
  }
  bounded[bounded.length - 1] = highestRiskAction;

  return bounded;
}

function determineFinalState(
  execution: RemediationExecutionReport,
  mode: RemediationExecutionMode,
  verificationRequested: boolean,
): {
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
    execution.failedCount === 0 &&
    execution.awaitingApprovalCount === 0
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

  if (mode === "observe") {
    return {
      state: "PLANNED",
      resolved: false,
      reason:
        "Observe mode completed. Remediation was evaluated without infrastructure changes.",
    };
  }

  if (mode === "dry-run") {
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
      reason: "Dry-run completed without validating any remediation action.",
    };
  }

  if (mode === "execute" && execution.executedCount > 0) {
    if (
      verificationRequested &&
      execution.verifiedCount === execution.executedCount
    ) {
      return {
        state: "RESOLVED",
        resolved: true,
        reason:
          "Remediation executed successfully and deterministic verification confirmed recovery.",
      };
    }

    if (!verificationRequested) {
      return {
        state: "FAILED",
        resolved: false,
        reason:
          "Remediation executed, but verification was disabled. The incident cannot be marked resolved without verification.",
      };
    }

    return {
      state: "FAILED",
      resolved: false,
      reason:
        "Remediation executed, but deterministic verification did not confirm recovery.",
    };
  }

  return {
    state: "FAILED",
    resolved: false,
    reason: "No remediation action reached a successful terminal state.",
  };
}

export async function runAgenticRemediationLoop(
  incidentReport: IncidentReport,
  options: AgenticRemediationOptions = {},
): Promise<AgenticRemediationResult> {
  const startedAt = new Date().toISOString();

  const mode = options.mode ?? "observe";

  const maxActions = getSafeMaxActions(options.maxActions);

  const verificationRequested = options.verify ?? true;

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

  const orderedActions = sortActionsDeterministically(plan.actions);

  const boundedActions = selectBoundedActions(orderedActions, maxActions);

  addStep(
    steps,
    "PLANNED",
    `Deterministic remediation planner evaluated ${plan.actions.length} executable candidate(s), accepted ${boundedActions.length} into the bounded execution set, and blocked ${plan.blockedActions?.length ?? 0} candidate(s).`,
  );

  const boundedPlan: AIRemediationPlan = {
    ...plan,
    actions: boundedActions,
  };

  if (boundedPlan.actions.length === 0) {
    addStep(
      steps,
      "POLICY_BLOCKED",
      "No executable remediation actions survived deterministic planning and safety checks.",
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
      "PLANNED",
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
    verify: verificationRequested,
  });

  const attemptedActions = execution.results.length;

  if (mode === "execute" && execution.executedCount > 0) {
    addStep(
      steps,
      "VERIFYING",
      "Remediation execution completed; deterministic verification was evaluated by the executor.",
    );
  }

  const final = determineFinalState(execution, mode, verificationRequested);

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
