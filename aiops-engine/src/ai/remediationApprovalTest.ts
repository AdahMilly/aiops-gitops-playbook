import {
  approveRemediation,
  clearApprovalRequests,
  getPendingApprovals,
  requestRemediationApproval,
} from "./remediationApproval";
import { executeRemediationPlan } from "./remediationExecutor";
import type {
  AIRemediationAction,
  AIRemediationPlan,
} from "./aiRemediationPlanner";
import { logger } from "../utils/logger";

async function main(): Promise<void> {
  logger.section("Phase 1 Remediation Approval Test");
  clearApprovalRequests();

  const action: AIRemediationAction = {
    id: "phase1-approval-test",
    title: "Phase 1 approval test",
    description:
      "Verify that a remediation action cannot execute before human approval.",
    reason: "Phase 1 approval workflow verification",
    risk: "high",
    requiresApproval: true,
    command: "kubectl get pods",
  };
  const plan: AIRemediationPlan = {
    available: true,
    priority: "Medium",
    actions: [action],
    blockedActions: [],
  };
  logger.subsection("Action");
  logger.item(`ID: ${action.id}`);
  logger.item(`Title: ${action.title}`);
  logger.item(`Risk: ${action.risk}`);
  logger.item(`Command: ${action.command}`);
  logger.blank();
  logger.step("1. Creating approval request...");
  const approval = requestRemediationApproval(action);
  logger.item(`Approval ID: ${approval.id}`);
  logger.item(`Status: ${approval.status}`);
  if (approval.status !== "PENDING") {
    throw new Error(`Expected approval status PENDING, got ${approval.status}`);
  }
  logger.success("PASS: approval request is PENDING");
  logger.blank();
  logger.step("2. Checking pending approvals...");
  const pending = getPendingApprovals();
  if (!pending.some((item) => item.id === approval.id)) {
    throw new Error(
      "Created approval request was not found in pending approvals.",
    );
  }
  logger.success("PASS: approval exists in pending store");
  logger.blank();
  logger.step("3. Attempting execution WITHOUT approval...");
  const beforeApproval = await executeRemediationPlan(plan, "execute");
  const beforeApprovalResult = beforeApproval.results[0];
  logger.item(`Status: ${beforeApprovalResult.status}`);
  logger.item(`Message: ${beforeApprovalResult.message}`);
  if (beforeApprovalResult.status !== "AwaitingApproval") {
    throw new Error(
      `Expected AwaitingApproval, got ${beforeApprovalResult.status}`,
    );
  }
  logger.success("PASS: execution blocked pending approval");
  logger.blank();
  logger.step("4. Approving remediation...");
  const approved = approveRemediation(approval.id, "phase1-test-reviewer");
  logger.item(`Approval ID: ${approved.id}`);
  logger.item(`Status: ${approved.status}`);
  logger.item(`Reviewed by: ${approved.reviewedBy}`);
  if (approved.status !== "APPROVED") {
    throw new Error(`Expected APPROVED, got ${approved.status}`);
  }
  logger.success("PASS: remediation approved");
  logger.blank();
  logger.step("5. Verifying approved execution path...");
  const afterApproval = await executeRemediationPlan(plan, "execute", {
    approvalIds: [approved.id],
  });
  const afterApprovalResult = afterApproval.results[0];
  logger.item(`Status: ${afterApprovalResult.status}`);
  if (afterApprovalResult.approvalId !== approved.id) {
    throw new Error("Approved execution did not use the supplied approval ID.");
  }
  if (afterApprovalResult.status === "AwaitingApproval") {
    throw new Error(
      "Execution is still waiting for approval after approval was granted.",
    );
  }
  logger.success("PASS: approval gate accepted the approved request");
  logger.blank();
  logger.section("Phase 1 Approval Test Passed");
  logger.item("Approval request created");
  logger.item("Approval persisted as PENDING");
  logger.item("Execution blocked without approval");
  logger.item("Human reviewer approved action");
  logger.item("Approved execution path accepted approval ID");
}
main().catch((error: unknown) => {
  logger.blank();
  logger.error("PHASE 1 APPROVAL TEST FAILED");
  if (error instanceof Error) {
    logger.error(error.message);
    logger.debug("Test failure details", error);
  } else {
    logger.error(String(error));
  }
  process.exit(1);
});
