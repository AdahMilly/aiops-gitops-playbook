import { executeRemediationPlan } from "./remediationExecutor";
import type {
  AIRemediationAction,
  AIRemediationPlan,
} from "./aiRemediationPlanner";
import type { RemediationExecutionMode } from "./remediationTypes";
import { logger } from "../utils/logger";
interface RunnerOptions {
  mode: RemediationExecutionMode;
  command: string;
  title: string;
  description: string;
  risk: AIRemediationAction["risk"];
  requiresApproval: boolean;
  approvalIds: string[];
  verify: boolean;
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
  let approvalIds: string[] = [];
  let verify = true;

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
    if (arg.startsWith("--approval-id=")) {
      const approvalId = arg.split("=").slice(1).join("=").trim();

      if (!approvalId) {
        throw new Error("--approval-id cannot be empty.");
      }
      approvalIds.push(approvalId);
      continue;
    }
    if (arg === "--no-verify") {
      verify = false;
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
    approvalIds,
    verify,
  };
}

function buildRemediationPlan(options: RunnerOptions): AIRemediationPlan {
  const action: AIRemediationAction = {
    id: "remediation-test",
    title: options.title,
    description: options.description,
    reason:
      "Deterministic remediation action generated for Phase 1 agentic execution testing.",
    risk: options.risk,
    requiresApproval: options.requiresApproval,
    command: options.command,
  };

  return {
    available: true,
    priority: "Medium",
    problem: "Phase 1 deterministic remediation execution test.",
    diagnosis:
      "The remediation runner is testing the detect-to-verify execution path.",
    actions: [action],
    blockedActions: [],
    generatedAt: new Date().toISOString(),
  };
}

function printUsage(): void {
  logger.section("AIOps Remediation Runner");
  logger.subsection("Usage");
  logger.item("npm run remediation -- [options]");
  logger.subsection("Execution Modes");
  logger.item("--remediation-mode=observe");
  logger.item("--remediation-mode=dry-run");
  logger.item("--remediation-mode=execute");
  logger.blank();
  logger.item('--command="<kubectl command>"');
  logger.item("Default: kubectl get pods");
  logger.blank();
  logger.item('--title="<title>"');
  logger.item('--description="<description>"');
  logger.blank();
  logger.item("--risk=<risk>");
  logger.item("low | medium | high | critical");
  logger.blank();
  logger.item("--requires-approval");
  logger.item("--approval-id=<approval-id>");
  logger.item("Supply an approved remediation request ID.");
  logger.blank();
  logger.item("--no-verify");
  logger.item("Disable deterministic post-execution verification.");
  logger.blank();
  logger.item("--help");
  logger.subsection("Examples");
  logger.item("npx tsx src/ai/remediationRunner.ts --remediation-mode=observe");
  logger.item("npx tsx src/ai/remediationRunner.ts --remediation-mode=dry-run");
  logger.item(
    'npx tsx src/ai/remediationRunner.ts --remediation-mode=execute --command="kubectl get pods"',
  );
  logger.item(
    'npx tsx src/ai/remediationRunner.ts --remediation-mode=dry-run --command="kubectl rollout restart deployment/aiops-engine -n default"',
  );
  logger.item(
    'npx tsx src/ai/remediationRunner.ts --remediation-mode=execute --requires-approval --risk=high --command="kubectl rollout restart deployment/aiops-engine -n default"',
  );
  logger.item(
    'npx tsx src/ai/remediationRunner.ts --remediation-mode=execute --requires-approval --risk=high --approval-id=<APPROVAL_ID> --command="kubectl rollout restart deployment/aiops-engine -n default"',
  );
  logger.blank();
}

function printReport(
  report: Awaited<ReturnType<typeof executeRemediationPlan>>,
): void {
  logger.section("AIOps Remediation Report");
  logger.subsection("Execution");
  logger.item(`Available: ${report.available}`);
  logger.item(`Mode: ${report.mode}`);
  logger.item(`Priority: ${report.priority}`);
  logger.item(`Started: ${report.startedAt}`);
  logger.item(`Completed: ${report.completedAt}`);
  logger.subsection("Summary");
  logger.item(`Executed: ${report.executedCount}`);
  logger.item(`Validated: ${report.validatedCount}`);
  logger.item(`Skipped: ${report.skippedCount}`);
  logger.item(`Blocked: ${report.blockedCount}`);
  logger.item(`Failed: ${report.failedCount}`);
  logger.item(`Awaiting approval: ${report.awaitingApprovalCount}`);
  logger.item(`Verified: ${report.verifiedCount}`);
  logger.item(`Verification failed: ${report.verificationFailedCount}`);
  for (const result of report.results) {
    logger.subsection("Action");
    logger.item(`ID: ${result.actionId}`);
    logger.item(`Title: ${result.title}`);
    logger.item(`Status: ${result.status}`);
    logger.item(`Risk: ${result.risk}`);
    logger.item(`Requires approval: ${result.requiresApproval}`);
    if (result.command) {
      logger.item(`Command: ${result.command}`);
    }
    if (result.approvalId) {
      logger.item(`Approval ID: ${result.approvalId}`);
    }
    logger.item(`Message: ${result.message}`);
    if (result.output) {
      logger.blank();
      logger.step("Execution output:");
      logger.data(result.output);
    }
    if (result.verification) {
      logger.blank();
      logger.step("Verification");
      logger.item(`Status: ${result.verification.status}`);
      logger.item(`Success: ${result.verification.success}`);
      logger.item(`Message: ${result.verification.message}`);
      if (result.verification.command) {
        logger.item(`Command: ${result.verification.command}`);
      }
      if (result.verification.output) {
        logger.blank();
        logger.data(result.verification.output);
      }
      if (result.verification.error) {
        logger.error(`Verification error: ${result.verification.error}`);
      }
    }
    if (result.error) {
      logger.blank();
      logger.error(`Error: ${result.error}`);
    }
  }
  logger.blank();
}

async function main(): Promise<void> {
  try {
    const options = parseArgs();
    logger.section("Starting AIOps Remediation Runner");
    logger.item(`Mode: ${options.mode}`);
    logger.item(`Command: ${options.command}`);
    logger.item(`Risk: ${options.risk}`);
    logger.item(`Requires approval: ${options.requiresApproval}`);
    logger.item(`Verification: ${options.verify}`);
    const plan = buildRemediationPlan(options);
    const report = await executeRemediationPlan(plan, options.mode, {
      approvalIds: options.approvalIds,
      verify: options.verify,
    });
    printReport(report);
    const hasFailure =
      report.failedCount > 0 ||
      report.blockedCount > 0 ||
      report.verificationFailedCount > 0;
    if (hasFailure) {
      logger.error(
        "Remediation completed with failures, blocked actions, or failed verification.",
      );
      process.exitCode = 1;
      return;
    }
    if (report.awaitingApprovalCount > 0) {
      logger.warn("Remediation is awaiting human approval.");

      return;
    }
    logger.success("Remediation completed successfully.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error("Remediation runner failed.");

    logger.error(message);

    if (error instanceof Error) {
      logger.debug("Remediation runner error details", error);
    }
    process.exitCode = 1;
  }
}

void main();
