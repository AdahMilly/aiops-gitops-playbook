import type { AIRemediationAction } from "./aiRemediationPlanner";
import {
  evaluateRemediationAction,
  type RemediationPolicyResult,
} from "./remediationPolicy";
import {
  findApprovalRequest,
  findPendingApprovalForAction,
  loadApprovalRequests,
  saveApprovalRequest,
  clearApprovalStore,
} from "./remediationApprovalStore";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface RemediationApprovalRequest {
  id: string;
  actionId: string;
  actionTitle: string;
  description: string;
  command?: string;
  risk: AIRemediationAction["risk"];
  status: ApprovalStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  policy: RemediationPolicyResult;
}
function createApprovalId(actionId: string): string {
  return `approval-${actionId}-${Date.now()}`;
}
export function requestRemediationApproval(
  action: AIRemediationAction,
): RemediationApprovalRequest {
  const policy = evaluateRemediationAction(action);
  if (policy.decision !== "REQUIRES_APPROVAL") {
    throw new Error(
      `Action "${action.title}" does not require human approval. ` +
        `Current policy decision: ${policy.decision}.`,
    );
  }
  const existingRequest = findPendingApprovalForAction(action.id);
  if (existingRequest) {
    return existingRequest;
  }
  const request: RemediationApprovalRequest = {
    id: createApprovalId(action.id),
    actionId: action.id,
    actionTitle: action.title,
    description: action.description,
    command: action.command,
    risk: action.risk,
    status: "PENDING",
    requestedAt: new Date().toISOString(),
    policy,
  };
  saveApprovalRequest(request);
  return request;
}
export function getApprovalRequest(
  approvalId: string,
): RemediationApprovalRequest | undefined {
  return findApprovalRequest(approvalId);
}
export function listApprovalRequests(): RemediationApprovalRequest[] {
  return loadApprovalRequests();
}
export function getPendingApprovals(): RemediationApprovalRequest[] {
  return loadApprovalRequests().filter(
    (request) => request.status === "PENDING",
  );
}
export function approveRemediation(
  approvalId: string,
  reviewedBy: string,
): RemediationApprovalRequest {
  const request = findApprovalRequest(approvalId);
  if (!request) {
    throw new Error(`Approval request "${approvalId}" was not found.`);
  }
  if (request.status !== "PENDING") {
    throw new Error(
      `Approval request "${approvalId}" is already ${request.status}.`,
    );
  }
  if (!reviewedBy.trim()) {
    throw new Error("A reviewer identity is required to approve an action.");
  }
  const action: AIRemediationAction = {
    id: request.actionId,
    title: request.actionTitle,
    description: request.description,
    command: request.command,
    risk: request.risk,
    requiresApproval: true,
    reason: request.policy.reason,
  };
  const currentPolicy = evaluateRemediationAction(action);
  if (currentPolicy.decision === "BLOCKED") {
    throw new Error(
      `Approval denied by current remediation policy: ${currentPolicy.reason}`,
    );
  }
  if (currentPolicy.decision === "SAFE") {
    throw new Error(
      "This action no longer requires approval under the current remediation policy.",
    );
  }
  const updatedRequest: RemediationApprovalRequest = {
    ...request,
    status: "APPROVED",
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy.trim(),
    policy: currentPolicy,
  };
  saveApprovalRequest(updatedRequest);
  return updatedRequest;
}
export function rejectRemediation(
  approvalId: string,
  reviewedBy: string,
  reason: string,
): RemediationApprovalRequest {
  const request = findApprovalRequest(approvalId);
  if (!request) {
    throw new Error(`Approval request "${approvalId}" was not found.`);
  }
  if (request.status !== "PENDING") {
    throw new Error(
      `Approval request "${approvalId}" is already ${request.status}.`,
    );
  }
  if (!reviewedBy.trim()) {
    throw new Error("A reviewer identity is required to reject an action.");
  }
  if (!reason.trim()) {
    throw new Error("A rejection reason is required.");
  }
  const updatedRequest: RemediationApprovalRequest = {
    ...request,
    status: "REJECTED",
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy.trim(),
    rejectionReason: reason.trim(),
  };
  saveApprovalRequest(updatedRequest);
  return updatedRequest;
}
export function isApprovedForExecution(approvalId: string): boolean {
  const request = findApprovalRequest(approvalId);
  if (!request) {
    return false;
  }
  return request.status === "APPROVED";
}
export function findApprovedApprovalForAction(
  actionId: string,
): RemediationApprovalRequest | undefined {
  return loadApprovalRequests().find(
    (request) => request.actionId === actionId && request.status === "APPROVED",
  );
}
export function expireRemediationApproval(
  approvalId: string,
): RemediationApprovalRequest {
  const request = findApprovalRequest(approvalId);
  if (!request) {
    throw new Error(`Approval request "${approvalId}" was not found.`);
  }
  if (request.status !== "PENDING") {
    throw new Error(
      `Approval request "${approvalId}" is already ${request.status}.`,
    );
  }
  const updatedRequest: RemediationApprovalRequest = {
    ...request,
    status: "EXPIRED",
    reviewedAt: new Date().toISOString(),
    reviewedBy: "system",
  };
  saveApprovalRequest(updatedRequest);
  return updatedRequest;
}
export function clearApprovalRequests(): void {
  clearApprovalStore();
}
