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
          operation: "rollout-status",
          deployment: request.deployment,
          namespace: request.namespace,
        },
        description:
          "Verify that the deployment rollout completed successfully after remediation.",
      };

    case "scale-deployment":
      return {
        request: {
          operation: "get-deployment",
          deployment: request.deployment,
          namespace: request.namespace,
        },
        description:
          "Verify that the deployment reports the requested replica count after scaling.",
      };

    case "get-nodes":
    case "describe-nodes":
    case "get-pods":
    case "describe-pod":
    case "get-deployment":
    case "describe-deployment":
    case "get-logs":
    case "rollout-status":
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

function extractReplicaState(output: string): {
  ready: number;
  desired: number;
} | null {
  const normalized = output.toLowerCase();

  const patterns = [
    /\b(\d+)\s*\/\s*(\d+)\b/,
    /ready:\s*(\d+)/i,
    /desired:\s*(\d+)/i,
  ];

  const replicaPattern = normalized.match(patterns[0]);

  if (replicaPattern) {
    return {
      ready: Number(replicaPattern[1]),
      desired: Number(replicaPattern[2]),
    };
  }

  return null;
}

function outputIndicatesDeploymentHealthy(output: string): boolean {
  if (!output.trim()) {
    return false;
  }

  if (outputIndicatesFailure(output)) {
    return false;
  }

  const replicaState = extractReplicaState(output);

  if (replicaState) {
    return (
      replicaState.desired > 0 && replicaState.ready === replicaState.desired
    );
  }

  return true;
}

function outputIndicatesRolloutHealthy(output: string): boolean {
  const normalized = output.toLowerCase();

  if (outputIndicatesFailure(output)) {
    return false;
  }

  return (
    normalized.includes("successfully rolled out") ||
    normalized.includes("successfully rolled out") ||
    (normalized.includes("deployment") && normalized.includes("successfully"))
  );
}

function outputMatchesRequestedReplicas(
  output: string,
  requestedReplicas: number | undefined,
): boolean {
  if (requestedReplicas === undefined) {
    return false;
  }

  const normalized = output.toLowerCase();

  if (outputIndicatesFailure(output)) {
    return false;
  }

  const readyMatch = normalized.match(/ready:\s*(\d+)/);
  const desiredMatch = normalized.match(/desired:\s*(\d+)/);
  const replicasMatch = normalized.match(
    /(\d+)\s+desired\s+replica[s]?,\s*(\d+)\s+updated/,
  );

  if (readyMatch && desiredMatch) {
    return (
      Number(readyMatch[1]) === requestedReplicas &&
      Number(desiredMatch[1]) === requestedReplicas
    );
  }

  if (replicasMatch) {
    return (
      Number(replicasMatch[1]) === requestedReplicas &&
      Number(replicasMatch[2]) === requestedReplicas
    );
  }

  const replicaState = extractReplicaState(output);

  if (replicaState) {
    return (
      replicaState.ready === requestedReplicas &&
      replicaState.desired === requestedReplicas
    );
  }

  return false;
}

export async function verifyRemediation(
  action: AIRemediationAction,
): Promise<RemediationVerificationResult> {
  const startedAt = Date.now();

  if (!action.command) {
    return {
      status: "NotApplicable",
      success: true,
      message:
        "No executable command exists for this action. Verification is not applicable.",
      verifiedAt: new Date().toISOString(),
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
      verifiedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
  }

  const execution = await executeKubernetesRemediation({
    ...verification.request,
    mode: "execute",
  });

  const verifiedAt = new Date().toISOString();

  if (!execution.success) {
    return {
      status: "VerificationFailed",
      success: false,
      message:
        execution.error ||
        "The deterministic verification command could not be executed.",
      command: execution.command,
      output: execution.output,
      error: execution.error,
      verifiedAt,
      durationMs: Date.now() - startedAt,
    };
  }

  const output = execution.output || "";

  if (verification.request.operation === "rollout-status") {
    if (!outputIndicatesRolloutHealthy(output)) {
      return {
        status: "NotVerified",
        success: false,
        message:
          "The deployment rollout completed the command, but deterministic verification did not confirm a successful rollout.",
        command: execution.command,
        output,
        verifiedAt,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  if (verification.request.operation === "get-deployment") {
    const originalRequest = mapCommandToKubernetesRequest(action.command);

    if (
      originalRequest?.operation === "scale-deployment" &&
      !outputMatchesRequestedReplicas(output, originalRequest.replicas)
    ) {
      return {
        status: "NotVerified",
        success: false,
        message: `The deployment was queried, but deterministic verification did not confirm ${originalRequest.replicas} requested replicas.`,
        command: execution.command,
        output,
        verifiedAt,
        durationMs: Date.now() - startedAt,
      };
    }

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
