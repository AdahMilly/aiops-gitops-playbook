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
import {
  verifyRemediation,
  type RemediationVerificationResult,
} from "./remediationVerifier";
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
  verify?: boolean;
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
  verification?: RemediationVerificationResult;
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
  verifiedCount: number;
  verificationFailedCount: number;
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
      verifiedCount: 0,
      verificationFailedCount: 0,
    };
  }
  const results: RemediationExecutionResult[] = [];
  for (const action of plan.actions) {
    const result = await processAction(action, mode, options);
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
    executedCount: results.filter(
      (result) => result.status === "Executed",
    ).length,
    validatedCount: results.filter(
      (result) => result.status === "Validated",
    ).length,
    skippedCount: results.filter(
      (result) => result.status === "Skipped",
    ).length,
    blockedCount: results.filter(
      (result) => result.status === "Blocked",
    ).length,
    failedCount: results.filter(
      (result) => result.status === "Failed",
    ).length,
    awaitingApprovalCount: results.filter(
      (result) => result.status === "AwaitingApproval",
    ).length,
    verifiedCount: results.filter(
      (result) =>
        result.verification?.status === "Verified",
    ).length,
    verificationFailedCount: results.filter(
      (result) =>
        result.verification?.status === "NotVerified" ||
        result.verification?.status === "VerificationFailed",
    ).length,
  };
}
async function processAction(
  action: AIRemediationAction,
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
  const policy = evaluateRemediationAction(action);
  if (policy.decision === "BLOCKED") {
    const result: RemediationExecutionResult = {
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
    writeAudit(action, policy.decision, result);
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
      requiresApproval: policy.requiresApproval,
      message:
        "Action observed only. No infrastructure changes were made.",
      command: action.command,
      executedAt,
    };
    writeAudit(action, policy.decision, result);
    return result;
  }
  if (mode === "dry-run") {
    const kubernetesRequest =
      mapCommandToKubernetesRequest(action.command);
    if (!kubernetesRequest) {
      const result: RemediationExecutionResult = {
        actionId: action.id,
        title: action.title,
        description: action.description,
        status: "Blocked",
        mode,
        risk: action.risk,
        requiresApproval: policy.requiresApproval,
        message:
          "Command is not supported by the Kubernetes remediation adapter.",
        command: action.command,
        executedAt,
      };
      writeAudit(action, policy.decision, result);
      return result;
    }
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Validated",
      mode,
      risk: action.risk,
      requiresApproval: policy.requiresApproval,
      message:
        "Remediation command passed policy and Kubernetes adapter validation in dry-run mode. No infrastructure changes were made.",
      command: action.command,
      executedAt,
    };
    writeAudit(action, policy.decision, result);
    return result;
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
      message:
        `Execution blocked by current remediation policy: ${finalPolicy.reason}`,
      command: action.command,
      executedAt,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  }
  let approvalId: string | undefined;
  if (finalPolicy.decision === "REQUIRES_APPROVAL") {
    const approval = requestRemediationApproval(action);
    approvalId = approval.id;
    const suppliedApproval = (options.approvalIds ?? []).some(
      (id) => id === approval.id,
    );
    if (
      !suppliedApproval ||
      !isApprovedForExecution(approval.id)
    ) {
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
      writeAudit(action, finalPolicy.decision, result);
      return result;
    }
  }

  const kubernetesRequest =
    mapCommandToKubernetesRequest(action.command);
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
    const execution =
      await executeKubernetesRemediation({
        ...kubernetesRequest,
        mode: "execute",
      });
    if (!execution.success) {
      const result: RemediationExecutionResult = {
        actionId: action.id,
        title: action.title,
        description: action.description,
        status: "Failed",
        mode,
        risk: action.risk,
        requiresApproval: finalPolicy.requiresApproval,
        message:
          execution.error ||
          "Kubernetes remediation failed.",
        command: action.command,
        approvalId,
        executedAt,
        output: execution.output,
        error: execution.error,
      };
      writeAudit(action, finalPolicy.decision, result);
      return result;
    }
    let verification: RemediationVerificationResult | undefined;
    if (options.verify !== false) {
      verification = await verifyRemediation(action);
    }
    if (
      verification &&
      (
        verification.status === "NotVerified" ||
        verification.status === "VerificationFailed"
      )
    ) {
      const result: RemediationExecutionResult = {
        actionId: action.id,
        title: action.title,
        description: action.description,
        status: "Failed",
        mode,
        risk: action.risk,
        requiresApproval: finalPolicy.requiresApproval,
        message:
          "Remediation executed, but deterministic verification did not confirm recovery.",
        command: action.command,
        approvalId,
        executedAt,
        output: execution.output,
        error: verification.error,
        verification,
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
      message:
        verification?.status === "Verified"
          ? "Kubernetes remediation executed and deterministic verification confirmed the resulting state."
          : "Kubernetes remediation executed successfully.",
      command: action.command,
      approvalId,
      executedAt,
      output: execution.output,
      verification,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);
    const result: RemediationExecutionResult = {
      actionId: action.id,
      title: action.title,
      description: action.description,
      status: "Failed",
      mode,
      risk: action.risk,
      requiresApproval: finalPolicy.requiresApproval,
      message,
      command: action.command,
      approvalId,
      executedAt,
      error: message,
    };
    writeAudit(action, finalPolicy.decision, result);
    return result;
  }
}

function writeAudit(
  action: AIRemediationAction,
  policyDecision:
    | "SAFE"
    | "DRY_RUN_ONLY"
    | "REQUIRES_APPROVAL"
    | "BLOCKED",
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