import type { AIRemediationAction } from "./aiRemediationPlanner";

export type RemediationPolicyDecision =
  | "SAFE"
  | "DRY_RUN_ONLY"
  | "REQUIRES_APPROVAL"
  | "BLOCKED";
export interface RemediationPolicyResult {
  actionId: string;
  decision: RemediationPolicyDecision;
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  command?: string;
  evaluatedAt: string;
}
export interface RemediationPolicyConfig {
  executionEnabled?: boolean;
  safeCommands?: string[];
  approvalCommands?: string[];
  blockedCommands?: string[];
}
const DEFAULT_POLICY: Required<RemediationPolicyConfig> = {
  executionEnabled: false,
  safeCommands: ["kubectl get", "kubectl describe", "kubectl logs"],
  approvalCommands: ["kubectl rollout restart", "kubectl scale"],
  blockedCommands: [
    "kubectl delete",
    "kubectl apply",
    "kubectl replace",
    "kubectl patch",
    "kubectl edit",
    "kubectl create",
    "kubectl run",
    "kubectl exec",
    "kubectl cp",
    "kubectl drain",
    "kubectl cordon",
    "kubectl uncordon",
    "kubectl set",
    "kubectl label",
    "kubectl annotate",
    "kubectl delete --all",
    "kubectl delete namespace",
    "kubectl delete node",
    "kubectl delete deployment",
    "kubectl delete statefulset",
    "kubectl delete daemonset",
    "kubectl delete pod",
    "rm ",
    "rm -rf",
    "shutdown",
    "reboot",
    "format",
  ],
};

export function evaluateRemediationAction(
  action: AIRemediationAction,
  config: RemediationPolicyConfig = {},
): RemediationPolicyResult {
  const policy = mergePolicy(config);
  const evaluatedAt = new Date().toISOString();
  if (!action.command?.trim()) {
    return {
      actionId: action.id,
      decision: "DRY_RUN_ONLY",
      allowed: false,
      requiresApproval: false,
      reason: "The remediation action does not contain an executable command.",
      evaluatedAt,
    };
  }
  const command = normalizeCommand(action.command);
  const blockedCommand = findMatchingCommand(command, policy.blockedCommands);
  if (blockedCommand) {
    return {
      actionId: action.id,
      decision: "BLOCKED",
      allowed: false,
      requiresApproval: false,
      reason:
        `Command is explicitly blocked by remediation policy: ` +
        `${blockedCommand}`,
      command: action.command,
      evaluatedAt,
    };
  }
  if (action.risk === "critical") {
    return {
      actionId: action.id,
      decision: "BLOCKED",
      allowed: false,
      requiresApproval: true,
      reason:
        "Critical-risk remediation actions are blocked in Phase 1 and require explicit human review.",
      command: action.command,
      evaluatedAt,
    };
  }
  if (action.risk === "high" || action.requiresApproval) {
    return {
      actionId: action.id,
      decision: "REQUIRES_APPROVAL",
      allowed: false,
      requiresApproval: true,
      reason:
        "This remediation action requires explicit human approval before execution.",
      command: action.command,
      evaluatedAt,
    };
  }
  const approvalCommand = findMatchingCommand(command, policy.approvalCommands);
  if (approvalCommand) {
    return {
      actionId: action.id,
      decision: "REQUIRES_APPROVAL",
      allowed: false,
      requiresApproval: true,
      reason:
        `Command is classified as an approval-required operation: ` +
        `${approvalCommand}`,
      command: action.command,
      evaluatedAt,
    };
  }
  const safeCommand = findMatchingCommand(command, policy.safeCommands);
  if (safeCommand) {
    if (!policy.executionEnabled) {
      return {
        actionId: action.id,
        decision: "DRY_RUN_ONLY",
        allowed: false,
        requiresApproval: false,
        reason:
          "Command is classified as safe, but infrastructure execution is disabled by policy.",
        command: action.command,
        evaluatedAt,
      };
    }
    return {
      actionId: action.id,
      decision: "SAFE",
      allowed: true,
      requiresApproval: false,
      reason: `Command is explicitly allowlisted as safe: ${safeCommand}`,
      command: action.command,
      evaluatedAt,
    };
  }
  return {
    actionId: action.id,
    decision: "BLOCKED",
    allowed: false,
    requiresApproval: false,
    reason:
      "Command is not present in the Phase 1 remediation allowlist. Unknown commands are blocked by default.",
    command: action.command,
    evaluatedAt,
  };
}
export function evaluateRemediationActions(
  actions: AIRemediationAction[],
  config: RemediationPolicyConfig = {},
): RemediationPolicyResult[] {
  return actions.map((action) => evaluateRemediationAction(action, config));
}
export function isRemediationAllowed(
  action: AIRemediationAction,
  config: RemediationPolicyConfig = {},
): boolean {
  return evaluateRemediationAction(action, config).allowed;
}
function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}
function findMatchingCommand(
  command: string,
  commands: string[],
): string | undefined {
  return commands.find((allowedCommand) => {
    const normalizedAllowed = normalizeCommand(allowedCommand);
    return (
      command === normalizedAllowed ||
      command.startsWith(`${normalizedAllowed} `)
    );
  });
}
function mergePolicy(
  config: RemediationPolicyConfig,
): Required<RemediationPolicyConfig> {
  const environmentExecutionEnabled =
    process.env.AIOPS_REMEDIATION_ENABLED === "true";
  return {
    executionEnabled: config.executionEnabled ?? environmentExecutionEnabled,
    safeCommands: config.safeCommands ?? DEFAULT_POLICY.safeCommands,
    approvalCommands:
      config.approvalCommands ?? DEFAULT_POLICY.approvalCommands,
    blockedCommands: config.blockedCommands ?? DEFAULT_POLICY.blockedCommands,
  };
}
