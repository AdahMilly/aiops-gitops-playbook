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
  confidence: number,
): "Low" | "Medium" | "High" | "Critical" {
  if (confidence >= 0.9) {
    return "Critical";
  }
  if (confidence >= 0.75) {
    return "High";
  }
  if (confidence >= 0.5) {
    return "Medium";
  }
  return "Low";
}
function determineRisk(action: string): RemediationRisk {
  const normalized = action.toLowerCase();

  if (
    normalized.includes("delete") ||
    normalized.includes("destroy") ||
    normalized.includes("terminate") ||
    normalized.includes("remove") ||
    normalized.includes("force")
  ) {
    return "critical";
  }
  if (
    normalized.includes("drain") ||
    normalized.includes("restart") ||
    normalized.includes("rollout") ||
    normalized.includes("scale") ||
    normalized.includes("cordon") ||
    normalized.includes("uncordon")
  ) {
    return "high";
  }
  if (
    normalized.includes("patch") ||
    normalized.includes("update") ||
    normalized.includes("modify") ||
    normalized.includes("change") ||
    normalized.includes("apply") ||
    normalized.includes("edit") ||
    normalized.includes("set ")
  ) {
    return "medium";
  }
  return "low";
}
function requiresApprovalForRisk(risk: RemediationRisk): boolean {
  return risk === "high" || risk === "critical";
}
function isAllowedKubectlCommand(command: string): boolean {
  const normalized = command.trim();
  if (!/^kubectl\s+/i.test(normalized)) {
    return false;
  }
  if (BLOCKED_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return ALLOWED_KUBECTL_OPERATIONS.some((operation) => {
    const pattern = new RegExp(
      `^kubectl\\s+${operation.replace(" ", "\\s+")}(?:\\s|$)`,
      "i",
    );
    return pattern.test(normalized);
  });
}
function extractExecutableCommand(action: string): string | undefined {
  const kubectlMatch = action.match(
    /\b(kubectl\s+(?:get|describe|logs|rollout\s+restart|scale)\b[^\n.]*)/i,
  );
  if (!kubectlMatch?.[1]) {
    return undefined;
  }
  const command = kubectlMatch[1].trim();
  if (!isAllowedKubectlCommand(command)) {
    return undefined;
  }
  return command;
}
function containsBlockedCommand(action: string): boolean {
  return BLOCKED_COMMAND_PATTERNS.some((pattern) => pattern.test(action));
}
function containsUnsupportedKubectlCommand(action: string): boolean {
  if (!/\bkubectl\b/i.test(action)) {
    return false;
  }
  if (containsBlockedCommand(action)) {
    return false;
  }
  return !extractExecutableCommand(action);
}
function createRemediationAction(
  action: string,
  index: number,
  diagnosis: string,
): AIRemediationAction {
  const risk = determineRisk(action);
  const command = extractExecutableCommand(action);
  return {
    id: createActionId(action, index),
    title: action,
    description: action,
    command,
    risk,
    requiresApproval: requiresApprovalForRisk(risk),
    reason: diagnosis,
  };
}
function identifyBlockedActions(analysis: AIAnalysisResult): string[] {
  const blocked: string[] = [];
  const nextActions = Array.isArray(analysis.nextActions)
    ? analysis.nextActions
    : [];
  for (const action of nextActions) {
    if (typeof action !== "string" || !action.trim()) {
      continue;
    }
    const normalized = action.trim();
    if (containsBlockedCommand(normalized)) {
      blocked.push(
        `Blocked potentially destructive or infrastructure-changing command: ${normalized}`,
      );
      continue;
    }
    if (containsUnsupportedKubectlCommand(normalized)) {
      blocked.push(
        `Blocked unsupported Kubernetes command: ${normalized}`,
      );
    }
  }
  return blocked;
}
function sortActions(
  actions: AIRemediationAction[],
): AIRemediationAction[] {
  const riskWeight: Record<RemediationRisk, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return [...actions].sort(
    (a, b) => riskWeight[a.risk] - riskWeight[b.risk],
  );
}
export function buildAIRemediationPlan(
  analysis: AIAnalysisResult,
): AIRemediationPlan {
  const priority = determinePriority(analysis.confidence);
  const nextActions = Array.isArray(analysis.nextActions)
    ? analysis.nextActions
    : [];
  const blockedActions = identifyBlockedActions(analysis);
  const executableActions = nextActions
    .filter(
      (action): action is string =>
        typeof action === "string" && action.trim().length > 0,
    )
    .filter((action) => !containsBlockedCommand(action))
    .map((action, index) =>
      createRemediationAction(
        action.trim(),
        index,
        analysis.diagnosis,
      ),
    )
    .filter((action) => {
      if (!action.command) {
        return true;
      }

      return isAllowedKubectlCommand(action.command);
    });
  const actions = sortActions(executableActions);
  return {
    available: true,
    priority,
    problem: analysis.summary,
    diagnosis: analysis.diagnosis,
    actions,
    blockedActions,
    generatedAt: new Date().toISOString(),
  };
}