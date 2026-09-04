import type { AIRemediationAction } from "./aiRemediationPlanner";
import {
  executeKubernetesRemediation,
  mapCommandToKubernetesRequest,
  type KubernetesRemediationRequest,
} from "./kubernetesRemediationAdapter";

export type RemediationVerificationStatus =
  | "Verified"
  | "NotVerified"
  | "VerificationFailed"
  | "NotApplicable";
export interface RemediationVerificationResult {
  status: RemediationVerificationStatus;
  success: boolean;
  message: string;
  command?: string;
  output?: string;
  error?: string;
  verifiedAt: string;
  durationMs: number;
}
interface VerificationCommand {
  request: KubernetesRemediationRequest;
  description: string;
}

function getVerificationCommand(
  action: AIRemediationAction,
): VerificationCommand | null {
  if (!action.command) {
    return null;
  }
  const request = mapCommandToKubernetesRequest(action.command);
  if (!request) {
    return null;
  }
  switch (request.operation) {
    case "restart-deployment":
      return {
        request: {
          operation: "get-deployment",
          deployment: request.deployment,
          namespace: request.namespace,
        },
        description:
          "Verify that the restarted deployment is available after remediation.",
      };
    case "scale-deployment":
      return {
        request: {
          operation: "get-deployment",
          deployment: request.deployment,
          namespace: request.namespace,
        },
        description:
          "Verify that the scaled deployment exists and reports its current replica state.",
      };
    case "get-nodes":
    case "describe-nodes":
    case "get-pods":
    case "describe-pod":
    case "get-deployment":
    case "describe-deployment":
    case "get-logs":
      return null;

    default:
      return null;
  }
}

function outputIndicatesFailure(output: string): boolean {
  const normalized = output.toLowerCase();
  const failureIndicators = [
    "error",
    "failed",
    "failure",
    "crashloopbackoff",
    "imagepullbackoff",
    "errimagepull",
    "pending",
    "unavailable",
    "notready",
  ];
  return failureIndicators.some((indicator) => normalized.includes(indicator));
}

function outputIndicatesDeploymentHealthy(output: string): boolean {
  const normalized = output.toLowerCase();
  if (outputIndicatesFailure(output)) {
    return false;
  }
  const replicaPattern = /\b(\d+)\/(\d+)\b/;
  const replicaMatch = normalized.match(replicaPattern);
  if (replicaMatch) {
    const ready = Number(replicaMatch[1]);
    const desired = Number(replicaMatch[2]);
    return desired > 0 && ready === desired;
  }
  return normalized.trim().length > 0;
}

export async function verifyRemediation(
  action: AIRemediationAction,
): Promise<RemediationVerificationResult> {
  const startedAt = Date.now();
  const verifiedAt = new Date().toISOString();

  if (!action.command) {
    return {
      status: "NotApplicable",
      success: true,
      message:
        "No executable command exists for this action. Verification is not applicable.",
      verifiedAt,
      durationMs: Date.now() - startedAt,
    };
  }
  const verification = getVerificationCommand(action);
  if (!verification) {
    return {
      status: "NotApplicable",
      success: true,
      message:
        "No deterministic verification procedure is defined for this remediation action.",
      verifiedAt,
      durationMs: Date.now() - startedAt,
    };
  }
  const execution = await executeKubernetesRemediation({
    ...verification.request,
    mode: "execute",
  });
  if (!execution.success) {
    return {
      status: "VerificationFailed",
      success: false,
      message:
        execution.error || "The verification command could not be executed.",
      command: execution.command,
      output: execution.output,
      error: execution.error,
      verifiedAt,
      durationMs: Date.now() - startedAt,
    };
  }
  const output = execution.output || "";
  if (verification.request.operation === "get-deployment") {
    if (!outputIndicatesDeploymentHealthy(output)) {
      return {
        status: "NotVerified",
        success: false,
        message:
          "The deployment exists, but deterministic health verification did not confirm a healthy replica state.",
        command: execution.command,
        output,
        verifiedAt,
        durationMs: Date.now() - startedAt,
      };
    }
  }
  return {
    status: "Verified",
    success: true,
    message: verification.description,
    command: execution.command,
    output,
    verifiedAt,
    durationMs: Date.now() - startedAt,
  };
}
