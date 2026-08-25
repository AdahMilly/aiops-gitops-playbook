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
  available: boolean;
  priority: "Low" | "Medium" | "High" | "Critical";
  problem: string;
  diagnosis: string;
  actions: AIRemediationAction[];
  blockedActions: string[];
  generatedAt: string;
}
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
    normalized.includes("cordon")
  ) {
    return "high";
  }
  if (
    normalized.includes("patch") ||
    normalized.includes("update") ||
    normalized.includes("modify") ||
    normalized.includes("change") ||
    normalized.includes("apply")
  ) {
    return "medium";
  }
  return "low";
}
function requiresApprovalForRisk(risk: RemediationRisk): boolean {
  return risk === "high" || risk === "critical";
}

function extractCommand(action: string): string | undefined {
  const kubectlMatch = action.match(
    /\b(kubectl\s+(?:get|describe|logs|top|rollout|scale|cordon|uncordon|drain|patch|apply|delete|replace)\b[^\n.]*)/i,
  );
  if (kubectlMatch?.[1]) {
    return kubectlMatch[1].trim();
  }
  const journalctlMatch = action.match(/\b(journalctl\b[^\n.]*)/i);
  if (journalctlMatch?.[1]) {
    return journalctlMatch[1].trim();
  }
  return undefined;
}

function createRemediationAction(
  action: string,
  index: number,
  diagnosis: string,
): AIRemediationAction {
  const risk = determineRisk(action);
  const command = extractCommand(action);
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
  for (const action of analysis.nextActions) {
    const normalized = action.toLowerCase();
    const destructive =
      normalized.includes("delete") ||
      normalized.includes("destroy") ||
      normalized.includes("terminate") ||
      normalized.includes("remove") ||
      normalized.includes("replace --force") ||
      normalized.includes("drain --force");
    if (destructive) {
      blocked.push(
        `Potentially destructive action requires explicit human review: ${action}`,
      );
    }
  }
  return blocked;
}
export function buildAIRemediationPlan(
  analysis: AIAnalysisResult,
): AIRemediationPlan {
  const priority = determinePriority(analysis.confidence);
  const nextActions = Array.isArray(analysis.nextActions)
    ? analysis.nextActions
    : [];

  const actions = nextActions
    .filter((action) => typeof action === "string" && action.trim())
    .map((action, index) =>
      createRemediationAction(action.trim(), index, analysis.diagnosis),
    );
  const blockedActions = identifyBlockedActions(analysis);

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
