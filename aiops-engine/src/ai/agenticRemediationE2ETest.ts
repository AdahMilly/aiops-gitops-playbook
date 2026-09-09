import { chmodSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { delimiter, join } from "path";
import { tmpdir } from "os";
import { approveRemediation, requestRemediationApproval } from "./remediationApproval";
import { executeRemediationPlan } from "./remediationExecutor";
import {
  getRemediationAuditForAction,
} from "./remediationAuditStore";
import type { AIRemediationAction, AIRemediationPlan } from "./aiRemediationPlanner";
import { logger } from "../utils/logger";

function createFakeKubectl(): { directory: string; cleanup: () => void } {
  const directory = join(tmpdir(), `aiops-kubectl-${Date.now()}`);
  mkdirSync(directory, { recursive: true });

  if (process.platform === "win32") {
    writeFileSync(
      join(directory, "kubectl.cmd"),
      [
        "@echo off",
        'echo %* | findstr /I "rollout status" >nul',
        'if %errorlevel%==0 (echo deployment "aiops-engine" successfully rolled out & exit /b 0)',
        'echo deployment.apps/aiops-engine restarted',
      ].join("\r\n"),
      "utf8",
    );
  } else {
    const script = join(directory, "kubectl");
    writeFileSync(
      script,
      [
        "#!/bin/sh",
        'case "$*" in',
        '  *"rollout status"*) echo \'deployment "aiops-engine" successfully rolled out\' ;;',
        '  *) echo \'deployment.apps/aiops-engine restarted\' ;;',
        "esac",
      ].join("\n"),
      "utf8",
    );
    chmodSync(script, 0o755);
  }

  const originalPath = process.env.PATH ?? "";
  const originalKubectlBinary = process.env.AIOPS_KUBECTL_BINARY;
  process.env.PATH = `${directory}${delimiter}${originalPath}`;
  process.env.AIOPS_KUBECTL_BINARY = process.platform === "win32"
    ? join(directory, "kubectl.cmd")
    : join(directory, "kubectl");

  return {
    directory,
    cleanup: () => {
      process.env.PATH = originalPath;
      if (originalKubectlBinary === undefined) {
        delete process.env.AIOPS_KUBECTL_BINARY;
      } else {
        process.env.AIOPS_KUBECTL_BINARY = originalKubectlBinary;
      }
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function main(): Promise<void> {
  logger.section("Agentic Remediation End-to-End Test");

  const originalEnabled = process.env.AIOPS_REMEDIATION_ENABLED;
  process.env.AIOPS_REMEDIATION_ENABLED = "true";

  const fakeKubectl = createFakeKubectl();
  const actionId = `e2e-restart-${Date.now()}`;

  const action: AIRemediationAction = {
    id: actionId,
    title: "Restart affected deployment",
    description: "E2E verification of approval, execution, verification and audit.",
    command: "kubectl rollout restart deployment/aiops-engine -n default",
    risk: "high",
    requiresApproval: true,
    reason: "Controlled E2E remediation test.",
  };

  const plan: AIRemediationPlan = {
    available: true,
    priority: "Critical",
    actions: [action],
    blockedActions: [],
  };

  try {
    logger.step("1. Creating approval request...");
    const approval = requestRemediationApproval(action);
    if (approval.status !== "PENDING") {
      throw new Error(`Expected PENDING, got ${approval.status}`);
    }
    logger.success(`PASS: approval persisted as PENDING (${approval.id})`);

    logger.step("2. Attempting execute without approval...");
    const pendingExecution = await executeRemediationPlan(plan, "execute", {
      verify: true,
    });
    const pendingResult = pendingExecution.results[0];
    if (pendingResult.status !== "AwaitingApproval") {
      throw new Error(`Expected AwaitingApproval, got ${pendingResult.status}`);
    }
    logger.success("PASS: execution stopped at approval gate");

    logger.step("3. Approving remediation...");
    const approved = approveRemediation(approval.id, "demo-reviewer");
    if (approved.status !== "APPROVED") {
      throw new Error(`Expected APPROVED, got ${approved.status}`);
    }
    logger.success("PASS: human approval persisted");

    logger.step("4. Executing approved remediation...");
    const execution = await executeRemediationPlan(plan, "execute", {
      approvalIds: [approved.id],
      verify: true,
    });
    const result = execution.results[0];

    logger.item(`Status: ${result.status}`);
    logger.item(`Verification: ${result.verification?.status ?? "N/A"}`);

    if (result.status !== "Executed") {
      throw new Error(`Expected Executed, got ${result.status}: ${result.message}`);
    }
    if (result.verification?.status !== "Verified") {
      throw new Error(
        `Expected Verified, got ${result.verification?.status ?? "N/A"}`,
      );
    }
    logger.success("PASS: approved remediation executed and was deterministically verified");

    logger.step("5. Checking persistent audit...");
    const auditEntries = getRemediationAuditForAction(actionId);
    const executedAudit = auditEntries.find((entry) => entry.status === "Executed");
    if (!executedAudit) {
      throw new Error("Executed remediation was not persisted to the audit store.");
    }
    if (executedAudit.verificationStatus !== "Verified") {
      throw new Error(
        `Audit verification status mismatch: ${executedAudit.verificationStatus ?? "missing"}`,
      );
    }
    logger.success(
      `PASS: audit persisted (${auditEntries.length} entries; final verification=${executedAudit.verificationStatus})`,
    );

    logger.step("6. Final agentic result...");
    logger.item("State: RESOLVED");
    logger.item("Resolved: true");
    logger.item("Approval: APPROVED");
    logger.item("Execution: EXECUTED");
    logger.item("Verification: VERIFIED");
    logger.item("Audit: PERSISTED");
    logger.success("PASS: final controlled remediation result is RESOLVED");

    logger.blank();
    logger.section("Agentic Remediation E2E Test Passed");
    logger.item("Approval gate: PASS");
    logger.item("Controlled execute: PASS");
    logger.item("Deterministic verification: PASS");
    logger.item("Persistent audit: PASS");
  } finally {
    fakeKubectl.cleanup();
    if (originalEnabled === undefined) {
      delete process.env.AIOPS_REMEDIATION_ENABLED;
    } else {
      process.env.AIOPS_REMEDIATION_ENABLED = originalEnabled;
    }
  }
}

main().catch((error: unknown) => {
  logger.blank();
  logger.error("AGENTIC REMEDIATION E2E TEST FAILED");
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
