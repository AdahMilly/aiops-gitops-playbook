import type {
  AIRemediationAction,
  AIRemediationPlan,
} from "./aiRemediationPlanner";
import { evaluateRemediationAction } from "./remediationPolicy";
import {
  requestRemediationApproval,
  isApprovedForExecution,
  listApprovalRequests,
} from "./remediationApproval";
import {
  executeKubernetesRemediation,
  mapCommandToKubernetesRequest,
} from "./kubernetesRemediationAdapter";

export interface RemediationExecutionOptions {
  approvalIds?: string[];
}
export type RemediationExecutionMode = "observe" | "dry-run" | "execute";
export type RemediationActionStatus =
  | "Skipped"
  | "Validated"
  | "Executed"
  | "Failed"
  | "Blocked"
  | "AwaitingApproval";

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
  approvalId?: string;
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
  awaitingApprovalCount: number;
}
export async function executeRemediationPlan(
  plan: AIRemediationPlan,
  mode: RemediationExecutionMode = "observe",
  options: RemediationExecutionOptions = {},
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
      awaitingApprovalCount: 0,
    };
  }
  const results: RemediationExecutionResult[] = [];
  for (const action of plan.actions) {
    try {
      const result = await processAction(action, plan, mode, options);
      results.push(result);
    } catch (error) {
      results.push({
        actionId: action.id,
        title: action.title,
        description: action.description,
        status: "Failed",
        mode,
        risk: action.risk,
        requiresApproval: action.requiresApproval,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected remediation execution error.",
        command: action.command,
        executedAt: new Date().toISOString(),
      });
    }
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
    awaitingApprovalCount: results.filter(
      (result) => result.status === "AwaitingApproval",
    ).length,
  };
}
async function processAction(
  action: AIRemediationAction,
  plan: AIRemediationPlan,
  mode: RemediationExecutionMode,
  options: RemediationExecutionOptions,
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
  const policy = evaluateRemediationAction(action);
  if (policy.decision === "BLOCKED") {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: policy.requiresApproval,
      message: policy.reason,
      command: action.command,
      executedAt,
    };
  }
  let approvalId: string | undefined;
  if (policy.decision === "REQUIRES_APPROVAL") {
    const suppliedApprovalIds = options.approvalIds ?? [];
    const approvedRequest = findApprovedRequestForAction(
      action,
      suppliedApprovalIds,
    );
    if (approvedRequest) {
      approvalId = approvedRequest.id;
    } else {
      const approvalRequest = requestRemediationApproval(action);
      return {
        actionId: action.id,
        title: action.title,
        description: action.description,
        status: "AwaitingApproval",
        mode,
        risk: action.risk,
        requiresApproval: true,
        message:
          "Remediation requires explicit human approval before execution.",
        command: action.command,
        approvalId: approvalRequest.id,
        executedAt,
      };
    }
  }
  if (policy.decision === "DRY_RUN_ONLY") {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: mode === "dry-run" ? "Validated" : "Skipped",
      mode,
      risk: action.risk,
      requiresApproval: false,
      message: policy.reason,
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
      requiresApproval: Boolean(approvalId),
      message: "Action observed only. No infrastructure changes were made.",
      command: action.command,
      approvalId,
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
      requiresApproval: Boolean(approvalId),
      message:
        "Action validated successfully in dry-run mode. No infrastructure changes were made.",
      command: action.command,
      approvalId,
      executedAt,
    };
  }
  if (mode !== "execute") {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: action.requiresApproval,
      message:
        "Unknown remediation execution mode. Infrastructure execution was blocked.",
      command: action.command,
      approvalId,
      executedAt,
    };
  }
  const kubernetesRequest = mapCommandToKubernetesRequest(action.command);
  if (!kubernetesRequest) {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: Boolean(approvalId),
      message:
        "Command is not supported by the Kubernetes remediation adapter.",
      command: action.command,
      approvalId,
      executedAt,
    };
  }
  const execution = await executeKubernetesRemediation(kubernetesRequest);
  if (!execution.success) {
    return {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Failed",
      mode,
      risk: action.risk,
      requiresApproval: Boolean(approvalId),
      message: execution.error || "Kubernetes remediation failed.",
      command: action.command,
      approvalId,
      executedAt,
    };
  }
  return {
    actionId: action.id,
    title: action.title,
    description: action.description,
    status: "Executed",
    mode,
    risk: action.risk,
    requiresApproval: Boolean(approvalId),
    message: "Kubernetes remediation executed successfully.",
    command: action.command,
    approvalId,
    executedAt,
  };
}
function findApprovedRequestForAction(
  action: AIRemediationAction,
  approvalIds: string[],
) {
  if (approvalIds.length === 0) {
    return undefined;
  }
  const approvalRequests = listApprovalRequests();
  return approvalRequests.find(
    (request) =>
      request.actionId === action.id &&
      request.status === "APPROVED" &&
      approvalIds.includes(request.id) &&
      isApprovedForExecution(request.id),
  );
}
export function getPendingApprovals() {
  return listApprovalRequests().filter(
    (request) => request.status === "PENDING",
  );
}
