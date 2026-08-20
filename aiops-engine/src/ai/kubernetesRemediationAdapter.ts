import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type KubernetesRemediationOperation =
  | "get-nodes"
  | "describe-nodes"
  | "get-pods"
  | "describe-pod"
  | "restart-deployment";

export interface KubernetesRemediationRequest {
  operation: KubernetesRemediationOperation;
  namespace?: string;
  resource?: string;
  deployment?: string;
}

export interface KubernetesRemediationResult {
  success: boolean;
  operation: KubernetesRemediationOperation;
  output: string;
  error?: string;
  executedAt: string;
}

const ALLOWED_OPERATIONS: KubernetesRemediationOperation[] = [
  "get-nodes",
  "describe-nodes",
  "get-pods",
  "describe-pod",
  "restart-deployment",
];

function buildKubectlArguments(
  request: KubernetesRemediationRequest,
): string[] {
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
      const args = ["describe", "pod", request.resource];
      if (request.namespace) {
        args.push("-n", request.namespace);
      }
      return args;
    }
    case "restart-deployment": {
      if (!request.deployment) {
        throw new Error("restart-deployment requires a deployment name.");
      }
      const args = ["rollout", "restart", `deployment/${request.deployment}`];
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
  const executedAt = new Date().toISOString();
  if (!ALLOWED_OPERATIONS.includes(request.operation)) {
    return {
      success: false,
      operation: request.operation,
      output: "",
      error: "Kubernetes remediation operation is not allowlisted.",
      executedAt,
    };
  }

  try {
    const args = buildKubectlArguments(request);
    const { stdout, stderr } = await execFileAsync("kubectl", args, {
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      success: true,
      operation: request.operation,
      output: stdout || stderr || "",
      executedAt,
    };
  } catch (error: any) {
    return {
      success: false,
      operation: request.operation,
      output: error?.stdout || "",
      error: error?.stderr || error?.message || "Kubernetes command failed.",
      executedAt,
    };
  }
}
export function mapCommandToKubernetesRequest(
  command: string,
): KubernetesRemediationRequest | null {
  const normalized = command
    .trim()
    .replace(/\s+/g, " ");

  if (/^kubectl\s+get\s+nodes$/i.test(normalized)) {
    return {
      operation: "get-nodes",
    };
  }
  if (
    /^kubectl\s+describe\s+nodes$/i.test(
      normalized,
    )
  ) {
    return {
      operation: "describe-nodes",
    };
  }
  if (
    /^kubectl\s+get\s+pods(?:\s+-n\s+[\w-]+)?$/i.test(
      normalized,
    )
  ) {
    const namespaceMatch = normalized.match(
      /-n\s+([\w-]+)/i,
    );
    return {
      operation: "get-pods",
      namespace: namespaceMatch?.[1],
    };
  }
  const describePodMatch = normalized.match(
    /^kubectl\s+describe\s+pod\s+([\w.-]+)(?:\s+-n\s+([\w-]+))?$/i,
  );
  if (describePodMatch) {
    return {
      operation: "describe-pod",
      resource: describePodMatch[1],
      namespace: describePodMatch[2],
    };
  }
  const restartDeploymentMatch = normalized.match(
    /^kubectl\s+rollout\s+restart\s+deployment\/([\w.-]+)(?:\s+-n\s+([\w-]+))?$/i,
  );
  if (restartDeploymentMatch) {
    return {
      operation: "restart-deployment",
      deployment: restartDeploymentMatch[1],
      namespace: restartDeploymentMatch[2],
    };
  }
  return null;
}
