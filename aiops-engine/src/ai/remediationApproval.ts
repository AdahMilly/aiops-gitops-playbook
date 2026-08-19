import type { AIRemediationAction } from "./aiRemediationPlanner";
import {
  evaluateRemediationAction,
  type RemediationPolicyResult,
} from "./remediationPolicy";

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

const approvalRequests = new Map<string, RemediationApprovalRequest>();
function createApprovalId(actionId: string): string {
  return `approval-${actionId}-${Date.now()}`;
}

export function requestRemediationApproval(
  action: AIRemediationAction,
): RemediationApprovalRequest {
  const policy = evaluateRemediationAction(action);
  if (policy.decision !== "REQUIRES_APPROVAL") {
    throw new Error(
      `Action "${action.title}" does not require human approval.`,
    );
  }

  const existingRequest = Array.from(approvalRequests.values()).find(
    (request) => request.actionId === action.id && request.status === "PENDING",
  );
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
  approvalRequests.set(request.id, request);
  return request;
}

export function getApprovalRequest(
  approvalId: string,
): RemediationApprovalRequest | undefined {
  return approvalRequests.get(approvalId);
}

export function listApprovalRequests(): RemediationApprovalRequest[] {
  return Array.from(approvalRequests.values());
}

export function approveRemediation(
  approvalId: string,
  reviewedBy: string,
): RemediationApprovalRequest {
  const request = approvalRequests.get(approvalId);
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
    status: "APPROVED",
    reviewedAt: new Date().toISOString(),
    reviewedBy,
  };
  approvalRequests.set(approvalId, updatedRequest);
  return updatedRequest;
}

export function rejectRemediation(
  approvalId: string,
  reviewedBy: string,
  reason: string,
): RemediationApprovalRequest {
  const request = approvalRequests.get(approvalId);
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
    status: "REJECTED",
    reviewedAt: new Date().toISOString(),
    reviewedBy,
    rejectionReason: reason,
  };
  approvalRequests.set(approvalId, updatedRequest);
  return updatedRequest;
}
export function isApprovedForExecution(approvalId: string): boolean {
  const request = approvalRequests.get(approvalId);
  if (!request) {
    return false;
  }
  if (request.status !== "APPROVED") {
    return false;
  }
  return true;
}

export function clearApprovalRequests(): void {
  approvalRequests.clear();
}
