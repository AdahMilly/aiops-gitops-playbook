import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type KubernetesRemediationOperation =
  | "get-nodes"
  | "describe-nodes"
  | "get-pods"
  | "describe-pod"
  | "get-deployment"
  | "describe-deployment"
  | "get-logs"
  | "rollout-status"
  | "restart-deployment"
  | "scale-deployment";

export type RemediationExecutionMode = "observe" | "dry-run" | "execute";
export interface KubernetesRemediationRequest {
  operation: KubernetesRemediationOperation;
  namespace?: string;
  resource?: string;
  deployment?: string;
  replicas?: number;
  container?: string;
  tailLines?: number;
}
export interface KubernetesRemediationExecutionRequest extends KubernetesRemediationRequest {
  mode?: RemediationExecutionMode;
}

export interface KubernetesRemediationResult {
  success: boolean;
  operation: KubernetesRemediationOperation;
  mode: RemediationExecutionMode;
  command: string;
  output: string;
  error?: string;
  executedAt: string;
  durationMs: number;
  executed: boolean;
}
const ALLOWED_OPERATIONS: KubernetesRemediationOperation[] = [
  "get-nodes",
  "describe-nodes",
  "get-pods",
  "describe-pod",
  "get-deployment",
  "describe-deployment",
  "get-logs",
  "rollout-status",
  "restart-deployment",
  "scale-deployment",
];
const COMMAND_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_SIZE = 1024 * 1024;
const SAFE_NAME_PATTERN = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const MAX_NAME_LENGTH = 253;

function validateKubernetesName(value: string, fieldName: string): void {
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }
  if (value.length > MAX_NAME_LENGTH) {
    throw new Error(`${fieldName} is too long.`);
  }
  if (!SAFE_NAME_PATTERN.test(value)) {
    throw new Error(
      `${fieldName} contains invalid Kubernetes resource characters.`,
    );
  }
}
function validateNamespace(namespace?: string): void {
  if (!namespace) {
    return;
  }
  validateKubernetesName(namespace, "namespace");
}
function validateReplicas(replicas?: number): void {
  if (replicas === undefined) {
    return;
  }
  if (!Number.isInteger(replicas)) {
    throw new Error("replicas must be an integer.");
  }
  if (replicas < 0 || replicas > 100) {
    throw new Error("replicas must be between 0 and 100.");
  }
}
function validateTailLines(tailLines?: number): void {
  if (tailLines === undefined) {
    return;
  }
  if (!Number.isInteger(tailLines)) {
    throw new Error("tailLines must be an integer.");
  }
  if (tailLines < 1 || tailLines > 10_000) {
    throw new Error("tailLines must be between 1 and 10000.");
  }
}
function buildKubectlArguments(
  request: KubernetesRemediationRequest,
): string[] {
  validateNamespace(request.namespace);
  switch (request.operation) {
    case "get-nodes":
      return ["get", "nodes"];
    case "describe-nodes":
      return ["describe", "nodes"];
    case "get-pods": {
      const args = ["get", "pods"];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    case "describe-pod": {
      if (!request.resource) {
        throw new Error("describe-pod requires a pod name.");
      }
      validateKubernetesName(request.resource, "pod name");
      const args = ["describe", "pod", request.resource];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    case "get-deployment": {
      if (!request.deployment) {
        throw new Error("get-deployment requires a deployment name.");
      }
      validateKubernetesName(request.deployment, "deployment name");
      const args = ["get", "deployment", request.deployment];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    case "describe-deployment": {
      if (!request.deployment) {
        throw new Error("describe-deployment requires a deployment name.");
      }
      validateKubernetesName(request.deployment, "deployment name");
      const args = ["describe", "deployment", request.deployment];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    case "get-logs": {
      if (!request.resource) {
        throw new Error("get-logs requires a pod name.");
      }
      validateKubernetesName(request.resource, "pod name");
      const args = ["logs", request.resource];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      if (request.container) {
        validateKubernetesName(request.container, "container name");
        args.push("-c", request.container);
      }
      if (request.tailLines !== undefined) {
        validateTailLines(request.tailLines);
        args.push("--tail", String(request.tailLines));
      }
      return args;
    }
    case "rollout-status": {
      if (!request.deployment) {
        throw new Error("rollout-status requires a deployment name.");
      }
      validateKubernetesName(request.deployment, "deployment name");
      const args = [
        "rollout",
        "status",
        `deployment/${request.deployment}`,
        "--timeout=10s",
      ];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    case "restart-deployment": {
      if (!request.deployment) {
        throw new Error("restart-deployment requires a deployment name.");
      }
      validateKubernetesName(request.deployment, "deployment name");
      const args = ["rollout", "restart", `deployment/${request.deployment}`];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    case "scale-deployment": {
      if (!request.deployment) {
        throw new Error("scale-deployment requires a deployment name.");
      }
      validateKubernetesName(request.deployment, "deployment name");
      validateReplicas(request.replicas);
      if (request.replicas === undefined) {
        throw new Error("scale-deployment requires replicas.");
      }
      const args = [
        "scale",
        "deployment",
        request.deployment,
        `--replicas=${request.replicas}`,
      ];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    default:
      throw new Error(
        `Unsupported Kubernetes remediation operation: ${request.operation}`,
      );
  }
}
function buildKubectlCommand(args: string[]): string {
  return ["kubectl", ...args]
    .map((value) => {
      if (/^[a-zA-Z0-9._=/:+-]+$/.test(value)) {
        return value;
      }

      return `"${value.replace(/"/g, '\\"')}"`;
    })
    .join(" ");
}
function getDefaultExecutionMode(): RemediationExecutionMode {
  const configuredMode =
    process.env.AIOPS_REMEDIATION_MODE?.trim().toLowerCase();
  if (
    configuredMode === "observe" ||
    configuredMode === "dry-run" ||
    configuredMode === "execute"
  ) {
    return configuredMode;
  }
  return "observe";
}
function isReadOnlyOperation(
  operation: KubernetesRemediationOperation,
): boolean {
  return (
    operation === "get-nodes" ||
    operation === "describe-nodes" ||
    operation === "get-pods" ||
    operation === "describe-pod" ||
    operation === "get-deployment" ||
    operation === "describe-deployment" ||
    operation === "get-logs" ||
    operation === "rollout-status"
  );
}
function isExecutionEnabled(): boolean {
  return process.env.AIOPS_REMEDIATION_ENABLED === "true";
}
export function previewKubernetesRemediation(
  request: KubernetesRemediationRequest,
): {
  operation: KubernetesRemediationOperation;
  command: string;
  args: string[];
} {
  if (!ALLOWED_OPERATIONS.includes(request.operation)) {
    throw new Error("Kubernetes remediation operation is not allowlisted.");
  }
  const args = buildKubectlArguments(request);
  return {
    operation: request.operation,
    command: buildKubectlCommand(args),
    args,
  };
}
export async function executeKubernetesRemediation(
  request: KubernetesRemediationExecutionRequest,
): Promise<KubernetesRemediationResult> {
  const startedAt = Date.now();
  const executedAt = new Date().toISOString();
  const mode = request.mode ?? getDefaultExecutionMode();
  if (!ALLOWED_OPERATIONS.includes(request.operation)) {
    return {
      success: false,
      operation: request.operation,
      mode,
      command: "",
      output: "",
      error: "Kubernetes remediation operation is not allowlisted.",
      executedAt,
      durationMs: Date.now() - startedAt,
      executed: false,
    };
  }
  let args: string[];
  try {
    args = buildKubectlArguments(request);
  } catch (error: unknown) {
    return {
      success: false,
      operation: request.operation,
      mode,
      command: "",
      output: "",
      error:
        error instanceof Error
          ? error.message
          : "Invalid Kubernetes remediation request.",
      executedAt,
      durationMs: Date.now() - startedAt,
      executed: false,
    };
  }
  const command = buildKubectlCommand(args);
  const readOnly = isReadOnlyOperation(request.operation);
  if (mode === "observe") {
    return {
      success: true,
      operation: request.operation,
      mode,
      command,
      output: "",
      executedAt,
      durationMs: Date.now() - startedAt,
      executed: false,
    };
  }
  if (mode === "dry-run") {
    return {
      success: true,
      operation: request.operation,
      mode,
      command,
      output: `DRY RUN: ${command}`,
      executedAt,
      durationMs: Date.now() - startedAt,
      executed: false,
    };
  }
  if (mode === "execute") {
    if (!readOnly && !isExecutionEnabled()) {
      return {
        success: false,
        operation: request.operation,
        mode,
        command,
        output: "",
        error:
          "Infrastructure remediation execution is disabled. Set AIOPS_REMEDIATION_ENABLED=true before executing mutating Kubernetes operations.",
        executedAt,
        durationMs: Date.now() - startedAt,
        executed: false,
      };
    }
    try {
      const { stdout, stderr } = await execFileAsync("kubectl", args, {
        windowsHide: true,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_SIZE,
      });
      return {
        success: true,
        operation: request.operation,
        mode,
        command,
        output: stdout || stderr || "",
        executedAt,
        durationMs: Date.now() - startedAt,
        executed: true,
      };
    } catch (error: any) {
      return {
        success: false,
        operation: request.operation,
        mode,
        command,
        output: error?.stdout || "",
        error: error?.stderr || error?.message || "Kubernetes command failed.",
        executedAt,
        durationMs: Date.now() - startedAt,
        executed: true,
      };
    }
  }
  return {
    success: false,
    operation: request.operation,
    mode,
    command,
    output: "",
    error: `Unsupported remediation execution mode: ${mode}`,
    executedAt,
    durationMs: Date.now() - startedAt,
    executed: false,
  };
}
export async function observeKubernetesRemediation(
  request: KubernetesRemediationRequest,
): Promise<KubernetesRemediationResult> {
  return executeKubernetesRemediation({
    ...request,
    mode: "observe",
  });
}
export async function dryRunKubernetesRemediation(
  request: KubernetesRemediationRequest,
): Promise<KubernetesRemediationResult> {
  return executeKubernetesRemediation({
    ...request,
    mode: "dry-run",
  });
}
export async function runKubernetesRemediation(
  request: KubernetesRemediationRequest,
): Promise<KubernetesRemediationResult> {
  return executeKubernetesRemediation({
    ...request,
    mode: "execute",
  });
}
export function mapCommandToKubernetesRequest(
  command: string,
): KubernetesRemediationRequest | null {
  if (!command?.trim()) {
    return null;
  }
  const normalized = command.trim().replace(/\s+/g, " ");
  const namePattern = "([a-z0-9](?:[-a-z0-9]*[a-z0-9])?)";
  if (/^kubectl\s+get\s+nodes$/i.test(normalized)) {
    return {
      operation: "get-nodes",
    };
  }
  if (/^kubectl\s+describe\s+nodes$/i.test(normalized)) {
    return {
      operation: "describe-nodes",
    };
  }
  const getPodsMatch = normalized.match(
    new RegExp(`^kubectl\\s+get\\s+pods(?:\\s+-n\\s+${namePattern})?$`, "i"),
  );
  if (getPodsMatch) {
    return {
      operation: "get-pods",
      namespace: getPodsMatch[1],
    };
  }
  const describePodMatch = normalized.match(
    new RegExp(
      `^kubectl\\s+describe\\s+pod\\s+${namePattern}(?:\\s+-n\\s+${namePattern})?$`,
      "i",
    ),
  );
  if (describePodMatch) {
    return {
      operation: "describe-pod",
      resource: describePodMatch[1],
      namespace: describePodMatch[2],
    };
  }
  const getDeploymentMatch = normalized.match(
    new RegExp(
      `^kubectl\\s+get\\s+deployment\\s+${namePattern}(?:\\s+-n\\s+${namePattern})?$`,
      "i",
    ),
  );
  if (getDeploymentMatch) {
    return {
      operation: "get-deployment",
      deployment: getDeploymentMatch[1],
      namespace: getDeploymentMatch[2],
    };
  }
  const describeDeploymentMatch = normalized.match(
    new RegExp(
      `^kubectl\\s+describe\\s+deployment\\s+${namePattern}(?:\\s+-n\\s+${namePattern})?$`,
      "i",
    ),
  );
  if (describeDeploymentMatch) {
    return {
      operation: "describe-deployment",
      deployment: describeDeploymentMatch[1],
      namespace: describeDeploymentMatch[2],
    };
  }
  const logsMatch = normalized.match(
    new RegExp(
      `^kubectl\\s+logs\\s+${namePattern}` +
        `(?:\\s+-n\\s+${namePattern})?` +
        `(?:\\s+-c\\s+${namePattern})?` +
        `(?:\\s+--tail\\s+(\\d+))?$`,
      "i",
    ),
  );
  if (logsMatch) {
    return {
      operation: "get-logs",
      resource: logsMatch[1],
      namespace: logsMatch[2],
      container: logsMatch[3],
      tailLines: logsMatch[4] ? Number(logsMatch[4]) : undefined,
    };
  }
  const rolloutStatusMatch = normalized.match(
    new RegExp(
      `^kubectl\\s+rollout\\s+status\\s+deployment\\/${namePattern}` +
        `(?:\\s+-n\\s+${namePattern})?$`,
      "i",
    ),
  );

  if (rolloutStatusMatch) {
    return {
      operation: "rollout-status",
      deployment: rolloutStatusMatch[1],
      namespace: rolloutStatusMatch[2],
    };
  }
  const restartDeploymentMatch = normalized.match(
    new RegExp(
      `^kubectl\\s+rollout\\s+restart\\s+deployment\\/${namePattern}(?:\\s+-n\\s+${namePattern})?$`,
      "i",
    ),
  );
  if (restartDeploymentMatch) {
    return {
      operation: "restart-deployment",
      deployment: restartDeploymentMatch[1],
      namespace: restartDeploymentMatch[2],
    };
  }
  const scaleDeploymentMatch = normalized.match(
    new RegExp(
      `^kubectl\\s+scale\\s+deployment\\s+${namePattern}` +
        `\\s+--replicas=(\\d+)` +
        `(?:\\s+-n\\s+${namePattern})?$`,
      "i",
    ),
  );
  if (scaleDeploymentMatch) {
    return {
      operation: "scale-deployment",
      deployment: scaleDeploymentMatch[1],
      replicas: Number(scaleDeploymentMatch[2]),
      namespace: scaleDeploymentMatch[3],
    };
  }
  return null;
}
