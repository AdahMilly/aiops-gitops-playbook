import { createDemoIncidentReport } from "./demoIncidentReport";

import {
  runAgenticRemediationLoop,
  type AgenticRemediationResult,
} from "./agenticRemediationLoop";

import type { RemediationExecutionMode } from "./remediationExecutor";
import { logger } from "../utils/logger";

interface RunnerOptions {
  mode: RemediationExecutionMode;
  maxActions: number;
  verify: boolean;
}

function parseMode(value?: string): RemediationExecutionMode {
  if (value === "observe" || value === "dry-run" || value === "execute") {
    return value;
  }

  return "observe";
}

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === "true";
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);

  const modeArgument = args.find((arg) => arg.startsWith("--mode="));

  const maxActionsArgument = args.find((arg) =>
    arg.startsWith("--max-actions="),
  );

  const verifyArgument = args.find((arg) => arg.startsWith("--verify="));

  const mode = parseMode(modeArgument?.split("=")[1]);

  const parsedMaxActions = Number(maxActionsArgument?.split("=")[1]);

  const maxActions = Number.isFinite(parsedMaxActions)
    ? Math.min(Math.max(Math.floor(parsedMaxActions), 1), 3)
    : 3;

  const verify = parseBoolean(verifyArgument?.split("=")[1], true);

  return {
    mode,
    maxActions,
    verify,
  };
}

function printHeader(options: RunnerOptions): void {
  logger.section("AIOPS Agentic Remediation Demo");

  logger.item(`Execution mode: ${options.mode}`);
  logger.item(`Maximum actions: ${options.maxActions}`);
  logger.item(`Verification enabled: ${options.verify}`);

  logger.blank();
}

function printIncidentSummary(result: AgenticRemediationResult): void {
  logger.subsection("Deterministic Incident");

  logger.item(`Score: ${result.score ?? "N/A"}`);
  logger.item(`Level: ${result.level ?? "N/A"}`);
  logger.item(`Active incident: ${result.level === "Healthy" ? "NO" : "YES"}`);

  logger.blank();
}

function printAIAnalysis(result: AgenticRemediationResult): void {
  logger.subsection("AI Interpretation");

  logger.item(`Provider: ${result.ai.provider}`);
  logger.item(`Mode: ${result.ai.mode}`);
  logger.item(`Available: ${result.ai.available}`);

  if (result.ai.analysis) {
    logger.item(`Confidence: ${result.ai.analysis.confidence}`);
    logger.item(`Summary: ${result.ai.analysis.summary}`);
    logger.item(`Diagnosis: ${result.ai.analysis.diagnosis}`);
    logger.item(
      `Root cause explanation: ${result.ai.analysis.rootCauseExplanation}`,
    );

    logger.blank();

    logger.info("Proposed next actions:");

    result.ai.analysis.nextActions.forEach((action, index) => {
      logger.step(`${index + 1}. ${action}`);
    });
  } else {
    logger.error(
      `AI analysis failed: ${result.ai.error ?? "Unknown AI error"}`,
    );
  }

  logger.blank();
}

function printPlan(result: AgenticRemediationResult): void {
  logger.subsection("Deterministic Remediation Plan");

  if (!result.plan) {
    logger.warn("No remediation plan generated.");
    logger.blank();
    return;
  }

  logger.item(`Priority: ${result.plan.priority ?? "N/A"}`);
  logger.item(`Problem: ${result.plan.problem ?? "N/A"}`);
  logger.item(`Diagnosis: ${result.plan.diagnosis ?? "N/A"}`);

  logger.blank();

  if (result.plan.actions.length === 0) {
    logger.item("Executable actions: 0");
  } else {
    logger.item(`Executable actions: ${result.plan.actions.length}`);

    result.plan.actions.forEach((action, index) => {
      logger.blank();

      logger.info(`${index + 1}. ${action.title}`);

      logger.item(`Command: ${action.command ?? "N/A"}`);
      logger.item(`Risk: ${action.risk}`);
      logger.item(
        `Approval: ${action.requiresApproval ? "REQUIRED" : "NOT REQUIRED"}`,
      );
      logger.item(`Reason: ${action.reason}`);
    });
  }

  if (result.plan.blockedActions?.length) {
    logger.blank();

    logger.warn(`Blocked candidates: ${result.plan.blockedActions.length}`);

    result.plan.blockedActions.forEach((action, index) => {
      logger.step(`${index + 1}. ${action}`);
    });
  }

  logger.blank();
}

function printExecution(result: AgenticRemediationResult): void {
  logger.subsection("Execution");

  if (!result.execution) {
    logger.warn("Execution was not started.");
    logger.blank();
    return;
  }

  const execution = result.execution;

  logger.item(`Mode: ${execution.mode}`);
  logger.item(`Available: ${execution.available}`);
  logger.item(`Executed: ${execution.executedCount}`);
  logger.item(`Validated: ${execution.validatedCount}`);
  logger.item(`Skipped: ${execution.skippedCount}`);
  logger.item(`Blocked: ${execution.blockedCount}`);
  logger.item(`Awaiting approval: ${execution.awaitingApprovalCount}`);
  logger.item(`Failed: ${execution.failedCount}`);
  logger.item(`Verified: ${execution.verifiedCount}`);
  logger.item(`Verification failed: ${execution.verificationFailedCount}`);

  logger.blank();
}

function printLifecycle(result: AgenticRemediationResult): void {
  logger.subsection("Agentic Lifecycle");

  result.steps.forEach((step, index) => {
    logger.step(
      `${String(index + 1).padStart(2, "0")}. ${step.state} — ${step.message}`,
    );
  });

  logger.blank();
}

function printFinalResult(result: AgenticRemediationResult): void {
  logger.subsection("Final Result");

  logger.item(`State: ${result.state}`);
  logger.item(`Resolved: ${result.resolved}`);
  logger.item(`Stopped: ${result.stopped}`);
  logger.item(`Attempted actions: ${result.attemptedActions}`);
  logger.item(`Reason: ${result.reason}`);

  logger.blank();
}

async function main(): Promise<void> {
  const options = parseArgs();

  printHeader(options);

  logger.section("1. Deterministic Incident");

  const incidentReport = createDemoIncidentReport();

  logger.success("Demo incident report created.");

  logger.section("2. Agentic Loop");

  logger.info("Starting agentic remediation lifecycle...");
  logger.item(`Mode: ${options.mode}`);
  logger.item(`Maximum actions: ${options.maxActions}`);
  logger.item(`Verification: ${options.verify}`);

  const result = await runAgenticRemediationLoop(incidentReport, {
    mode: options.mode,
    maxActions: options.maxActions,
    verify: options.verify,
  });

  printIncidentSummary(result);
  printAIAnalysis(result);
  printPlan(result);
  printExecution(result);
  printLifecycle(result);
  printFinalResult(result);

  logger.section("End AIOPS Agentic Demo");

  if (result.resolved) {
    logger.success("AIOPS agentic remediation completed successfully.");
  } else {
    logger.warn("AIOPS agentic remediation completed without resolution.");
  }
}

main().catch((error: unknown) => {
  logger.blank();
  logger.error("AIOPS AGENTIC REMEDIATION DEMO FAILED");

  if (error instanceof Error) {
    logger.error(error.message);

    if (error.stack) {
      logger.debug(error.stack);
    }
  } else {
    logger.error("Unknown error occurred.", error);
  }

  process.exitCode = 1;
});
