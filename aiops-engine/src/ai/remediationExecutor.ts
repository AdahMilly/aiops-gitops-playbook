import type {
  AIRemediationAction,
  AIRemediationPlan,
} from "./aiRemediationPlanner";

export type RemediationExecutionMode = "observe" | "dry-run" | "execute";

export type RemediationActionStatus =
  | "Skipped"
  | "Validated"
  | "Executed"
  | "Failed"
  | "Blocked";

export interface RemediationExecutionResult {
  actionId: string;
  title: string;
  description: string;
  status: RemediationActionStatus;
  mode: RemediationExecutionMode;
  risk: AIRemediationAction["risk"];
  requiresApproval: boolean;
  message: string;
  command?: string;
  executedAt: string;
}

export interface RemediationExecutionReport {
  available: boolean;
  mode: RemediationExecutionMode;
  startedAt: string;
  completedAt: string;
  priority: AIRemediationPlan["priority"];
  results: RemediationExecutionResult[];
  executedCount: number;
  validatedCount: number;
  skippedCount: number;
  blockedCount: number;
  failedCount: number;
}

export async function executeRemediationPlan(
  plan: AIRemediationPlan,
  mode: RemediationExecutionMode = "observe",
): Promise<RemediationExecutionReport> {
  const startedAt = new Date().toISOString();

  if (!plan.available) {
    return {
      available: false,
      mode,
      startedAt,
      completedAt: new Date().toISOString(),
      priority: plan.priority,
      results: [],
      executedCount: 0,
      validatedCount: 0,
      skippedCount: 0,
      blockedCount: 0,
      failedCount: 0,
    };
  }

  const results: RemediationExecutionResult[] = [];

  for (const action of plan.actions) {
    const result = await processAction(action, plan, mode);
    results.push(result);
  }

  const completedAt = new Date().toISOString();
  return {
    available: true,
    mode,
    startedAt,
    completedAt,
    priority: plan.priority,
    results,
    executedCount: results.filter((result) => result.status === "Executed")
      .length,
    validatedCount: results.filter((result) => result.status === "Validated")
      .length,
    skippedCount: results.filter((result) => result.status === "Skipped")
      .length,
    blockedCount: results.filter((result) => result.status === "Blocked")
      .length,
    failedCount: results.filter((result) => result.status === "Failed").length,
  };
}

async function processAction(
  action: AIRemediationAction,
  plan: AIRemediationPlan,
  mode: RemediationExecutionMode,
): Promise<RemediationExecutionResult> {
  const executedAt = new Date().toISOString();

  if (!action.command) {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Skipped",
      mode,
      risk: action.risk,
      requiresApproval: action.requiresApproval,
      message:
        "No executable command was identified. Action remains informational.",
      executedAt,
    };
  }

  if (isBlockedAction(action, plan)) {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: true,
      message: "Action is blocked because it requires explicit human review.",
      command: action.command,
      executedAt,
    };
  }

  if (action.requiresApproval) {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: true,
      message:
        "Action requires human approval before execution. Approval workflow is not enabled yet.",
      command: action.command,
      executedAt,
    };
  }

  if (mode === "observe") {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Skipped",
      mode,
      risk: action.risk,
      requiresApproval: action.requiresApproval,
      message: "Action observed only. No infrastructure changes were made.",
      command: action.command,
      executedAt,
    };
  }

  if (mode === "dry-run") {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Validated",
      mode,
      risk: action.risk,
      requiresApproval: action.requiresApproval,
      message:
        "Action validated successfully in dry-run mode. No infrastructure changes were made.",
      command: action.command,
      executedAt,
    };
  }

  return {
    actionId: action.id,
    title: action.title,
    description: action.description,
    status: "Blocked",
    mode,
    risk: action.risk,
    requiresApproval: action.requiresApproval,
    message:
      "Infrastructure execution is currently disabled. Action requires the remediation policy and approval layer.",
    command: action.command,
    executedAt,
  };
}

function isBlockedAction(
  action: AIRemediationAction,
  plan: AIRemediationPlan,
): boolean {
  return plan.blockedActions.some(
    (blockedAction) =>
      blockedAction.toLowerCase().includes(action.title.toLowerCase()) ||
      action.title.toLowerCase().includes(blockedAction.toLowerCase()),
  );
}
