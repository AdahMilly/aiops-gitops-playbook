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
import {
  createRemediationAuditEntry,
  saveRemediationAudit,
} from "./remediationAuditStore";
import type {
  RemediationExecutionMode,
  RemediationActionStatus,
} from "./remediationTypes";
export type {
  RemediationExecutionMode,
  RemediationActionStatus,
} from "./remediationTypes";
export interface RemediationExecutionOptions {
  approvalIds?: string[];
}
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
  output?: string;
  error?: string;
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
    const result = await processAction(action, plan, mode, options);
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
    const result: RemediationExecutionResult = {
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
    writeAudit(action, "BLOCKED", result);
    return result;
  }
  const initialPolicy = evaluateRemediationAction(action);
  if (initialPolicy.decision === "BLOCKED") {
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: initialPolicy.requiresApproval,
      message: initialPolicy.reason,
      command: action.command,
      executedAt,
    };
    writeAudit(action, initialPolicy.decision, result);
    return result;
  }
  let approvalId: string | undefined;
  if (initialPolicy.decision === "REQUIRES_APPROVAL") {
    const approval = requestRemediationApproval(action);
    approvalId = approval.id;
    const approvedForExecution = (options.approvalIds ?? []).some(
      (id) => id === approval.id && isApprovedForExecution(id),
    );
    if (!approvedForExecution) {
      const result: RemediationExecutionResult = {
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
        approvalId,
        executedAt,
      };
      writeAudit(action, initialPolicy.decision, result);
      return result;
    }
  }
  const finalPolicy = evaluateRemediationAction(action);
  if (finalPolicy.decision === "BLOCKED") {
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: finalPolicy.requiresApproval,
      message: `Execution blocked by current remediation policy: ${finalPolicy.reason}`,
      command: action.command,
      approvalId,
      executedAt,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  }
  if (mode === "observe") {
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Skipped",
      mode,
      risk: action.risk,
      requiresApproval: finalPolicy.requiresApproval,
      message: "Action observed only. No infrastructure changes were made.",
      command: action.command,
      approvalId,
      executedAt,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  }
  if (mode === "dry-run") {
    const kubernetesRequest = mapCommandToKubernetesRequest(action.command);
    if (!kubernetesRequest) {
      const result: RemediationExecutionResult = {
        actionId: action.id,
        title: action.title,
        description: action.description,
        status: "Blocked",
        mode,
        risk: action.risk,
        requiresApproval: finalPolicy.requiresApproval,
        message:
          "Command is not supported by the Kubernetes remediation adapter.",
        command: action.command,
        approvalId,
        executedAt,
      };
      writeAudit(action, finalPolicy.decision, result);
      return result;
    }
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Validated",
      mode,
      risk: action.risk,
      requiresApproval: finalPolicy.requiresApproval,
      message:
        "Remediation command passed policy and Kubernetes adapter validation in dry-run mode. No infrastructure changes were made.",
      command: action.command,
      approvalId,
      executedAt,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  }
  const kubernetesRequest = mapCommandToKubernetesRequest(action.command);
  if (!kubernetesRequest) {
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Blocked",
      mode,
      risk: action.risk,
      requiresApproval: finalPolicy.requiresApproval,
      message:
        "Command is not supported by the Kubernetes remediation adapter.",
      command: action.command,
      approvalId,
      executedAt,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  }
  try {
    const execution = await executeKubernetesRemediation(kubernetesRequest);
    if (!execution.success) {
      const result: RemediationExecutionResult = {
        actionId: action.id,
        title: action.title,
        description: action.description,
        status: "Failed",
        mode,
        risk: action.risk,
        requiresApproval: finalPolicy.requiresApproval,
        message: execution.error || "Kubernetes remediation failed.",
        command: action.command,
        approvalId,
        executedAt,
        output: execution.output,
        error: execution.error,
      };
      writeAudit(action, finalPolicy.decision, result);
      return result;
    }
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Executed",
      mode,
      risk: action.risk,
      requiresApproval: finalPolicy.requiresApproval,
      message: "Kubernetes remediation executed successfully.",
      command: action.command,
      approvalId,
      executedAt,
      output: execution.output,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  } catch (error: any) {
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Failed",
      mode,
      risk: action.risk,
      requiresApproval: finalPolicy.requiresApproval,
      message: error?.message || "Unexpected Kubernetes remediation error.",
      command: action.command,
      approvalId,
      executedAt,
      error: error?.message,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  }
}
function writeAudit(
  action: AIRemediationAction,
  policyDecision: "SAFE" | "DRY_RUN_ONLY" | "REQUIRES_APPROVAL" | "BLOCKED",
  result: RemediationExecutionResult,
): void {
  const auditEntry = createRemediationAuditEntry(action, {
    policyDecision,
    mode: result.mode,
    status: result.status,
    message: result.message,
    approvalId: result.approvalId,
    output: result.output,
    error: result.error,
  });
  saveRemediationAudit(auditEntry);
}
export function getPendingApprovals() {
  return listApprovalRequests().filter(
    (request) => request.status === "PENDING",
  );
}
