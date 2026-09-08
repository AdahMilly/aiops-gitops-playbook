import type { IncidentReport } from "../engines/generateIncidentReport";
import type { AIAnalysisResult } from "./aiTypes";

export type RemediationRisk = "low" | "medium" | "high" | "critical";
export interface AIRemediationAction {
  id: string;
  title: string;
  description: string;
  command?: string;
  risk: RemediationRisk;
  requiresApproval: boolean;
  reason: string;
}
export interface AIRemediationPlan {
  available?: boolean;
  priority?: "Low" | "Medium" | "High" | "Critical";
  problem?: string;
  diagnosis?: string;
  actions: AIRemediationAction[];
  blockedActions?: string[];
  generatedAt?: string;
}

const ALLOWED_KUBECTL_OPERATIONS = [
  "get",
  "describe",
  "logs",
  "rollout restart",
  "scale",
] as const;

const BLOCKED_COMMAND_PATTERNS = [
  /\bkubectl\s+delete\b/i,
  /\bkubectl\s+apply\b/i,
  /\bkubectl\s+replace\b/i,
  /\bkubectl\s+patch\b/i,
  /\bkubectl\s+edit\b/i,
  /\bkubectl\s+drain\b/i,
  /\bkubectl\s+cordon\b/i,
  /\bkubectl\s+uncordon\b/i,
  /\bkubectl\s+exec\b/i,
  /\bkubectl\s+cp\b/i,
  /\bkubectl\s+run\b/i,
  /\bkubectl\s+create\b/i,
  /\bkubectl\s+set\b/i,
  /\bkubectl\s+label\b/i,
  /\bkubectl\s+annotate\b/i,
  /\bjournalctl\b/i,
  /\brm\s+-rf\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
];

function createActionId(title: string, index: number): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized || "remediation-action"}-${index + 1}`;
}

function determinePriority(
  report: IncidentReport,
): "Low" | "Medium" | "High" | "Critical" {
  switch (report.summary.level) {
    case "Critical":
      return "Critical";
    case "Major":
      return "High";
    case "Warning":
      return "Medium";
    case "Healthy":
    default:
      return "Low";
  }
}

function determineRisk(action: string): RemediationRisk {
  const normalized = action.toLowerCase();
  if (
    normalized.includes("delete") ||
    normalized.includes("drain") ||
    normalized.includes("shutdown") ||
    normalized.includes("reboot") ||
    normalized.includes("replace")
  ) {
    return "critical";
  }
  if (
    normalized.includes("restart") ||
    normalized.includes("scale") ||
    normalized.includes("patch") ||
    normalized.includes("cordon") ||
    normalized.includes("uncordon")
  ) {
    return "high";
  }

  if (normalized.includes("logs") || normalized.includes("describe")) {
    return "low";
  }
  return "medium";
}

function requiresApprovalForRisk(risk: RemediationRisk): boolean {
  return risk === "high" || risk === "critical";
}

function isAllowedKubectlCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();
  if (!normalized.startsWith("kubectl ")) {
    return false;
  }
  return ALLOWED_KUBECTL_OPERATIONS.some(
    (operation) =>
      normalized === `kubectl ${operation}` ||
      normalized.startsWith(`kubectl ${operation} `),
  );
}

function extractExecutableCommand(action: string): string | undefined {
  const match = action.match(
    /\bkubectl\s+(get|describe|logs|rollout\s+restart|scale)\b[^\n]*/i,
  );
  if (!match) {
    return undefined;
  }

  return match[0].replace(/\s+/g, " ").trim();
}

function containsBlockedCommand(action: string): boolean {
  return BLOCKED_COMMAND_PATTERNS.some((pattern) => pattern.test(action));
}

function containsUnsupportedKubectlCommand(action: string): boolean {
  const kubectlMatch = action.match(/\bkubectl\s+([a-z-]+)/i);
  if (!kubectlMatch) {
    return false;
  }
  return !isAllowedKubectlCommand(action.trim());
}

function commandIsGrounded(command: string, report: IncidentReport): boolean {
  const normalizedCommand = command.replace(/\s+/g, " ").trim();

  const match = normalizedCommand.match(
    /^kubectl\s+(?:rollout\s+restart|scale)\s+\S+\s+(\S+)/i,
  );
  if (!match) {
    return true;
  }
  const target = match[1];
  const deterministicEvidence = JSON.stringify(report).toLowerCase();
  return deterministicEvidence.includes(target.toLowerCase());
}

function createRemediationAction(
  action: string,
  index: number,
  diagnosis: string,
  report: IncidentReport,
): AIRemediationAction | null {
  const command = extractExecutableCommand(action);
  if (!command) {
    return null;
  }
  if (
    containsBlockedCommand(action) ||
    containsUnsupportedKubectlCommand(action)
  ) {
    return null;
  }
  if (!isAllowedKubectlCommand(command)) {
    return null;
  }
  if (!commandIsGrounded(command, report)) {
    return null;
  }

  const risk = determineRisk(action);
  return {
    id: createActionId(action, index),
    title: action,
    description: `AI-proposed remediation based on deterministic incident evidence: ${diagnosis}`,
    command,
    risk,
    requiresApproval: requiresApprovalForRisk(risk),
    reason:
      "Action is derived from AI interpretation but remains subject to deterministic policy and approval controls.",
  };
}

function identifyBlockedActions(analysis: AIAnalysisResult): string[] {
  const blocked: string[] = [];

  for (const action of analysis.nextActions) {
    if (
      containsBlockedCommand(action) ||
      containsUnsupportedKubectlCommand(action)
    ) {
      blocked.push(action);
      continue;
    }
    if (!extractExecutableCommand(action)) {
      blocked.push(action);
    }
  }
  return blocked;
}

function sortActions(actions: AIRemediationAction[]): AIRemediationAction[] {
  const order: Record<RemediationRisk, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return [...actions].sort((a, b) => order[a.risk] - order[b.risk]);
}

export function buildAIRemediationPlan(
  report: IncidentReport,
  analysis: AIAnalysisResult,
): AIRemediationPlan {
  const priority = determinePriority(report);

  const actions: AIRemediationAction[] = [];

  for (let index = 0; index < analysis.nextActions.length; index += 1) {
    const action = createRemediationAction(
      analysis.nextActions[index],
      index,
      analysis.diagnosis,
      report,
    );
    if (action) {
      actions.push(action);
    }
  }

  const blockedActions = identifyBlockedActions(analysis);

  return {
    available: actions.length > 0,
    priority,
    problem: analysis.summary,
    diagnosis: analysis.diagnosis,
    actions: sortActions(actions),
    blockedActions,
    generatedAt: new Date().toISOString(),
  };
}
