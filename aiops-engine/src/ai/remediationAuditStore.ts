import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import type {
  AIRemediationAction,
  RemediationRisk,
} from "./aiRemediationPlanner";
import type { RemediationPolicyDecision } from "./remediationPolicy";
import type {
  RemediationExecutionMode,
  RemediationActionStatus,
} from "./remediationTypes";

export interface RemediationAuditEntry {
  id: string;
  actionId: string;
  actionTitle: string;
  description: string;
  command?: string;
  risk: RemediationRisk;
  policyDecision: RemediationPolicyDecision;
  approvalId?: string;
  mode: RemediationExecutionMode;
  status: RemediationActionStatus;
  message: string;
  requestedAt: string;
  executedAt: string;
  output?: string;
  error?: string;
  verificationStatus?: string;
  verificationMessage?: string;
  verificationCommand?: string;
  verifiedAt?: string;
}

const DEFAULT_AUDIT_FILE = resolve(
  process.env.AIOPS_REMEDIATION_AUDIT_FILE || "./data/remediation-audit.json",
);
function getAuditFilePath(): string {
  return DEFAULT_AUDIT_FILE;
}
function ensureAuditDirectory(): void {
  const filePath = getAuditFilePath();
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, {
      recursive: true,
    });
  }
}
export function loadRemediationAudit(): RemediationAuditEntry[] {
  const filePath = getAuditFilePath();
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const content = readFileSync(filePath, "utf8");
    if (!content.trim()) {
      return [];
    }
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as RemediationAuditEntry[];
  } catch (error) {
    console.error("Failed to load remediation audit store:", error);
    return [];
  }
}
export function saveRemediationAudit(entry: RemediationAuditEntry): void {
  ensureAuditDirectory();
  const entries = loadRemediationAudit();
  entries.push(entry);
  writeFileSync(getAuditFilePath(), JSON.stringify(entries, null, 2), "utf8");
}
export function getRemediationAuditEntry(
  id: string,
): RemediationAuditEntry | undefined {
  return loadRemediationAudit().find((entry) => entry.id === id);
}
export function getRemediationAuditForAction(
  actionId: string,
): RemediationAuditEntry[] {
  return loadRemediationAudit().filter((entry) => entry.actionId === actionId);
}
export function clearRemediationAudit(): void {
  ensureAuditDirectory();
  writeFileSync(getAuditFilePath(), JSON.stringify([], null, 2), "utf8");
}
export function createRemediationAuditEntry(
  action: AIRemediationAction,
  values: {
    policyDecision: RemediationPolicyDecision;
    mode: RemediationExecutionMode;
    status: RemediationActionStatus;
    message: string;
    approvalId?: string;
    output?: string;
    error?: string;
    verificationStatus?: string;
    verificationMessage?: string;
    verificationCommand?: string;
    verifiedAt?: string;
  },
): RemediationAuditEntry {
  const now = new Date().toISOString();
  return {
    id: `remediation-audit-${action.id}-${Date.now()}`,
    actionId: action.id,
    actionTitle: action.title,
    description: action.description,
    command: action.command,
    risk: action.risk,
    policyDecision: values.policyDecision,
    approvalId: values.approvalId,
    mode: values.mode,
    status: values.status,
    message: values.message,
    requestedAt: now,
    executedAt: now,
    output: values.output,
    error: values.error,
    verificationStatus: values.verificationStatus,
    verificationMessage: values.verificationMessage,
    verificationCommand: values.verificationCommand,
    verifiedAt: values.verifiedAt,
  };
}
