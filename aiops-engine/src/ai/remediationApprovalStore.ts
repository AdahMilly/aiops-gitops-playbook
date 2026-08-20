import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import type { RemediationApprovalRequest } from "./remediationApproval";

const STORE_PATH = resolve(
  process.env.REMEDIATION_APPROVAL_STORE || "./data/remediation-approvals.json",
);
function ensureStoreDirectory(): void {
  const directory = dirname(STORE_PATH);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}
function readStore(): RemediationApprovalRequest[] {
  ensureStoreDirectory();
  if (!existsSync(STORE_PATH)) {
    return [];
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    if (!raw.trim()) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Approval store must contain an array.");
    }
    return parsed as RemediationApprovalRequest[];
  } catch (error) {
    throw new Error(
      `Failed to read remediation approval store: ${STORE_PATH}`,
      {
        cause: error,
      },
    );
  }
}
function writeStore(approvals: RemediationApprovalRequest[]): void {
  ensureStoreDirectory();
  try {
    writeFileSync(STORE_PATH, JSON.stringify(approvals, null, 2), "utf8");
  } catch (error) {
    throw new Error(
      `Failed to write remediation approval store: ${STORE_PATH}`,
      {
        cause: error,
      },
    );
  }
}
export function loadApprovalRequests(): RemediationApprovalRequest[] {
  return readStore();
}
export function saveApprovalRequest(request: RemediationApprovalRequest): void {
  const approvals = readStore();
  const existingIndex = approvals.findIndex(
    (approval) => approval.id === request.id,
  );
  if (existingIndex >= 0) {
    approvals[existingIndex] = request;
  } else {
    approvals.push(request);
  }
  writeStore(approvals);
}
export function findApprovalRequest(
  approvalId: string,
): RemediationApprovalRequest | undefined {
  return readStore().find((approval) => approval.id === approvalId);
}
export function findPendingApprovalForAction(
  actionId: string,
): RemediationApprovalRequest | undefined {
  return readStore().find(
    (approval) =>
      approval.actionId === actionId && approval.status === "PENDING",
  );
}
export function clearApprovalStore(): void {
  writeStore([]);
}
