import { executeRemediationPlan } from "./remediationExecutor";
import type {
  AIRemediationAction,
  AIRemediationPlan,
} from "./aiRemediationPlanner";
import type { RemediationExecutionMode } from "./remediationTypes";
interface RunnerOptions {
  mode: RemediationExecutionMode;
  command: string;
  title: string;
  description: string;
  risk: AIRemediationAction["risk"];
  requiresApproval: boolean;
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  let mode: RemediationExecutionMode = "observe";
  let command = "kubectl get pods";
  let title = "Inspect Kubernetes pods";
  let description =
    "Retrieve the current Kubernetes pods for infrastructure inspection.";
  let risk: AIRemediationAction["risk"] = "low";
  let requiresApproval = false;

  for (const arg of args) {
    if (arg.startsWith("--remediation-mode=")) {
      const value = arg.split("=").slice(1).join("=").trim().toLowerCase();
      if (value !== "observe" && value !== "dry-run" && value !== "execute") {
        throw new Error(
          `Invalid remediation mode: ${value}. ` +
            "Expected observe, dry-run, or execute.",
        );
      }
      mode = value;
      continue;
    }
    if (arg.startsWith("--command=")) {
      command = arg.split("=").slice(1).join("=").trim();
      if (!command) {
        throw new Error("--command cannot be empty.");
      }
      continue;
    }
    if (arg.startsWith("--title=")) {
      title = arg.split("=").slice(1).join("=").trim();

      continue;
    }
    if (arg.startsWith("--description=")) {
      description = arg.split("=").slice(1).join("=").trim();

      continue;
    }
    if (arg.startsWith("--risk=")) {
      const value = arg.split("=").slice(1).join("=").trim().toLowerCase();
      if (
        value !== "low" &&
        value !== "medium" &&
        value !== "high" &&
        value !== "critical"
      ) {
        throw new Error(
          `Invalid risk level: ${value}. ` +
            "Expected low, medium, high, or critical.",
        );
      }
      risk = value;
      continue;
    }
    if (arg === "--requires-approval") {
      requiresApproval = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return {
    mode,
    command,
    title,
    description,
    risk,
    requiresApproval,
  };
}
function buildRemediationPlan(options: RunnerOptions): AIRemediationPlan {
  const action: AIRemediationAction = {
    id: "remediation-test",
    title: "Restart unhealthy deployment",
    description: "Restart the deployment to recover unhealthy pods.",
    reason:
      "The deployment has unhealthy pods and restarting it may restore service availability.",
    risk: "medium",
    requiresApproval: true,
    command: "kubectl rollout restart deployment/my-app",
  };
  return {
    available: true,
    priority: "Medium",
    actions: [action],
  };
}
function printUsage(): void {
  console.log(`
AIOps Remediation Runner
Usage:
  npm run remediation -- [options]
Options:
  --remediation-mode=<mode>
      observe | dry-run | execute
      Default:
      observe
  --command="<kubectl command>"
      Kubernetes command to validate/execute.
      Default:
      kubectl get pods
  --title="<title>"
      Remediation action title.
  --description="<description>"
      Remediation action description.
  --risk=<risk>
      low | medium | high | critical
      Default:
      low
  --requires-approval
      Mark the remediation action as requiring approval.
  --help
      Show this help message.

Examples:
  npm run remediation -- --remediation-mode=observe
  npm run remediation -- --remediation-mode=dry-run
  npm run remediation -- --remediation-mode=dry-run --command="kubectl get pods -n default"
  npm run remediation -- --remediation-mode=dry-run --command="kubectl get deployment api -n default"
  npm run remediation -- --remediation-mode=observe --command="kubectl logs api-pod -n default --tail 100"
  npm run remediation -- --remediation-mode=dry-run --command="kubectl rollout restart deployment/api -n default"
  npm run remediation -- --remediation-mode=execute --command="kubectl get pods -n default"
`);
}
function printReport(
  report: Awaited<ReturnType<typeof executeRemediationPlan>>,
): void {
  console.log("");
  console.log("========================================");
  console.log("AIOps Remediation Report");
  console.log("========================================");
  console.log(`Available:           ${report.available}`);
  console.log(`Mode:                ${report.mode}`);
  console.log(`Priority:            ${report.priority}`);
  console.log(`Started:             ${report.startedAt}`);
  console.log(`Completed:           ${report.completedAt}`);
  console.log("");
  console.log("Summary");
  console.log("----------------------------------------");
  console.log(`Executed:            ${report.executedCount}`);
  console.log(`Validated:           ${report.validatedCount}`);
  console.log(`Skipped:             ${report.skippedCount}`);
  console.log(`Blocked:             ${report.blockedCount}`);
  console.log(`Failed:              ${report.failedCount}`);
  console.log(`Awaiting approval:   ${report.awaitingApprovalCount}`);
  console.log("");
  for (const result of report.results) {
    console.log("========================================");
    console.log("Action");
    console.log("========================================");
    console.log(`ID:                  ${result.actionId}`);
    console.log(`Title:               ${result.title}`);
    console.log(`Status:              ${result.status}`);
    console.log(`Risk:                ${result.risk}`);
    console.log(`Requires approval:   ${result.requiresApproval}`);
    if (result.command) {
      console.log(`Command:             ${result.command}`);
    }
    if (result.approvalId) {
      console.log(`Approval ID:         ${result.approvalId}`);
    }
    console.log(`Message:             ${result.message}`);
    if (result.output) {
      console.log("");
      console.log("Output:");
      console.log("----------------------------------------");
      console.log(result.output);
    }
    if (result.error) {
      console.log("");
      console.log("Error:");
      console.log("----------------------------------------");
      console.error(result.error);
    }
  }
  console.log("");
  console.log("========================================");
}
async function main(): Promise<void> {
  try {
    const options = parseArgs();
    console.log("");
    console.log("Starting AIOps remediation runner...");
    console.log(`Mode: ${options.mode}`);
    console.log(`Command: ${options.command}`);
    const plan = buildRemediationPlan(options);
    const report = await executeRemediationPlan(plan, options.mode);
    printReport(report);
    const hasFailure = report.failedCount > 0 || report.blockedCount > 0;
    if (hasFailure) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("");
    console.error("Remediation runner failed:");
    console.error(message);
    console.error("");
    process.exitCode = 1;
  }
}
void main();
