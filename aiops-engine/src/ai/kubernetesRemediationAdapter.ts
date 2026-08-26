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
  | "restart-deployment"
  | "scale-deployment";

export interface KubernetesRemediationRequest {
  operation: KubernetesRemediationOperation;
  namespace?: string;
  resource?: string;
  deployment?: string;
  replicas?: number;
  container?: string;
  tailLines?: number;
}
export interface KubernetesRemediationResult {
  success: boolean;
  operation: KubernetesRemediationOperation;
  output: string;
  error?: string;
  executedAt: string;
  durationMs: number;
}
const ALLOWED_OPERATIONS: KubernetesRemediationOperation[] = [
  "get-nodes",
  "describe-nodes",
  "get-pods",
  "describe-pod",
  "get-deployment",
  "describe-deployment",
  "get-logs",
  "restart-deployment",
  "scale-deployment",
];
const COMMAND_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_SIZE = 1024 * 1024;
const SAFE_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
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
export async function executeKubernetesRemediation(
  request: KubernetesRemediationRequest,
): Promise<KubernetesRemediationResult> {
  const startedAt = Date.now();
  const executedAt = new Date().toISOString();
  if (!ALLOWED_OPERATIONS.includes(request.operation)) {
    return {
      success: false,
      operation: request.operation,
      output: "",
      error: "Kubernetes remediation operation is not allowlisted.",
      executedAt,
      durationMs: Date.now() - startedAt,
    };
  }
  try {
    const args = buildKubectlArguments(request);
    const { stdout, stderr } = await execFileAsync("kubectl", args, {
      windowsHide: true,
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_SIZE,
    });
    return {
      success: true,
      operation: request.operation,
      output: stdout || stderr || "",
      executedAt,
      durationMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      success: false,
      operation: request.operation,
      output: error?.stdout || "",
      error: error?.stderr || error?.message || "Kubernetes command failed.",
      executedAt,
      durationMs: Date.now() - startedAt,
    };
  }
}
export function mapCommandToKubernetesRequest(
  command: string,
): KubernetesRemediationRequest | null {
  if (!command?.trim()) {
    return null;
  }
  const normalized = command.trim().replace(/\s+/g, " ");
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
    /^kubectl\s+get\s+pods(?:\s+-n\s+([a-z0-9][-a-z0-9]*))?$/i,
  );
  if (getPodsMatch) {
    return {
      operation: "get-pods",
      namespace: getPodsMatch[1],
    };
  }
  const describePodMatch = normalized.match(
    /^kubectl\s+describe\s+pod\s+([a-z0-9][-a-z0-9]*)(?:\s+-n\s+([a-z0-9][-a-z0-9]*))?$/i,
  );
  if (describePodMatch) {
    return {
      operation: "describe-pod",
      resource: describePodMatch[1],
      namespace: describePodMatch[2],
    };
  }
  const getDeploymentMatch = normalized.match(
    /^kubectl\s+get\s+deployment\s+([a-z0-9][-a-z0-9]*)(?:\s+-n\s+([a-z0-9][-a-z0-9]*))?$/i,
  );
  if (getDeploymentMatch) {
    return {
      operation: "get-deployment",
      deployment: getDeploymentMatch[1],
      namespace: getDeploymentMatch[2],
    };
  }
  const describeDeploymentMatch = normalized.match(
    /^kubectl\s+describe\s+deployment\s+([a-z0-9][-a-z0-9]*)(?:\s+-n\s+([a-z0-9][-a-z0-9]*))?$/i,
  );
  if (describeDeploymentMatch) {
    return {
      operation: "describe-deployment",
      deployment: describeDeploymentMatch[1],
      namespace: describeDeploymentMatch[2],
    };
  }
  const logsMatch = normalized.match(
    /^kubectl\s+logs\s+([a-z0-9][-a-z0-9]*)(?:\s+-n\s+([a-z0-9][-a-z0-9]*))?(?:\s+-c\s+([a-z0-9][-a-z0-9]*))?(?:\s+--tail\s+(\d+))?$/i,
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
  const restartDeploymentMatch = normalized.match(
    /^kubectl\s+rollout\s+restart\s+deployment\/([a-z0-9][-a-z0-9]*)(?:\s+-n\s+([a-z0-9][-a-z0-9]*))?$/i,
  );
  if (restartDeploymentMatch) {
    return {
      operation: "restart-deployment",
      deployment: restartDeploymentMatch[1],
      namespace: restartDeploymentMatch[2],
    };
  }
  const scaleDeploymentMatch = normalized.match(
    /^kubectl\s+scale\s+deployment\s+([a-z0-9][-a-z0-9]*)\s+--replicas=(\d+)(?:\s+-n\s+([a-z0-9][-a-z0-9]*))?$/i,
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
