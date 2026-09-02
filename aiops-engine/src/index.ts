import { collectTelemetry } from "./collectors/telemetryCollector";
import { analyze } from "./analyzers/healthAnalyzer";
import { generateIncidentReport } from "./engines/generateIncidentReport";
import {
  loadIncidentState,
  saveIncidentState,
} from "./state/incidentStateStore";
import { orchestrateAILayer } from "./ai/aiOrchestrator";
import { buildAIRemediationPlan } from "./ai/aiRemediationPlanner";
import {
  executeRemediationPlan,
  type RemediationExecutionReport,
} from "./ai/remediationExecutor";
import { getPendingApprovals } from "./ai/remediationApproval";
import { logger } from "./utils/logger";

async function main() {
  logger.section("AIOps Incident Detection");
  logger.info("Collecting telemetry...");
  const telemetry = await collectTelemetry();
  logger.success("Telemetry collected successfully.");
  const health = analyze(telemetry);
  logger.success("Health analysis complete.");
  const previousIncidents = loadIncidentState();
  logger.info(`Loaded ${previousIncidents.length} previous incidents.`);
  const report = generateIncidentReport({
    health,
    telemetry,
    previousIncidents,
  });
  saveIncidentState(report.incidentLifecycle.incidents);
  logger.success(
    `Incident state saved: ${report.incidentLifecycle.activeIncidents.length} active incidents.`,
  );
  logger.section("Incident Summary");
  logger.table({
    Score: report.summary.score,
    Level: report.summary.level,
    Healthy: report.summary.healthy,
  });
  logger.section("Root Cause");
  if (report.rootCause) {
    logger.table([
      {
        Category: report.rootCause.category,
        Subcategory: report.rootCause.subcategory,
        Confidence: `${report.rootCause.confidence}%`,
      },
    ]);
    logger.subsection("Evidence");
    report.rootCause.evidence.forEach((evidence) => {
      logger.item(evidence);
    });
  } else {
    logger.info("No root cause identified.");
  }
  logger.section("Incident Groups");
  report.incidentGroups.forEach((group, index) => {
    logger.subsection(`Incident ${index + 1}`);
    logger.table([
      {
        Title: group.title,
        Category: group.category,
        Severity: group.severity,
        Findings: group.findings.length,
        Pods: group.affectedPods.length,
      },
    ]);
    logger.subsection("Findings");
    group.findings.forEach((finding) => {
      logger.item(`${finding.issue} (${finding.severity})`);
    });
    logger.subsection("Evidence");
    group.evidence.forEach((evidence) => {
      logger.item(evidence);
    });
    if (group.affectedPods.length > 0) {
      logger.subsection("Affected Pods");

      group.affectedPods.forEach((pod) => {
        logger.item(pod);
      });
    }
  });
  logger.section("Correlations");
  logger.table(
    report.correlations.map((finding) => ({
      Severity: finding.severity,
      Issue: finding.issue,
      Status: finding.status,
      Source: finding.source,
      Evidence: finding.evidence.join(", "),
    })),
  );
  logger.section("Predictions");
  logger.table(
    report.predictions.map((prediction) => ({
      Metric: prediction.metric,
      Risk: prediction.risk,
      Probability: `${Math.round(prediction.probability * 100)}%`,
      Horizon: prediction.horizon,
      Message: prediction.message,
    })),
  );
  logger.section("Recommendations");
  report.recommendations.forEach((recommendation) => {
    logger.subsection(`[${recommendation.priority}] ${recommendation.issue}`);
    recommendation.actions.forEach((action, index) => {
      logger.item(`${index + 1}. ${action}`);
    });
    if (recommendation.automation) {
      logger.step(`Automation: ${recommendation.automation}`);
    }
  });
  logger.section("Incident Timeline");
  logger.table(
    report.timeline.map((entry) => ({
      Time: entry.timestamp,
      Source: entry.source,
      Severity: entry.severity,
      Title: entry.title,
    })),
  );
  logger.section("Incident Lifecycle");
  logger.table(
    report.incidentLifecycle.incidents.map((incident) => ({
      Issue: incident.issue,
      Category: incident.category,
      Severity: incident.severity,
      Status: incident.status,
      Occurrences: incident.occurrences,
      FirstSeen: incident.firstSeen,
      LastSeen: incident.lastSeen,
    })),
  );
  logger.section("AI Incident Intelligence");
  logger.info("Passing incident report to AI orchestrator...");
  let aiResult;
  try {
    aiResult = await orchestrateAILayer(report);
    if (aiResult.available) {
      logger.success("AI analysis completed successfully.");
      logger.info(`Provider: ${aiResult.provider}`);
      if (aiResult.error) {
        logger.warn(`AI fallback reason: ${aiResult.error}`);
      }
    } else {
      logger.warn(
        "AI analysis unavailable. Continuing with deterministic intelligence.",
      );
      if (aiResult.error) {
        logger.warn(`AI reason: ${aiResult.error}`);
      }
    }
  } catch (error) {
    logger.error("AI orchestration failed.", error);
    aiResult = {
      available: false,
      provider: "unavailable",
      error: "AI orchestration failed",
      analysis: null,
    };
  }
  logger.section("AI Remediation Planner");
  const remediationPlan = aiResult.analysis
    ? buildAIRemediationPlan(aiResult.analysis)
    : null;
  let remediationExecution: RemediationExecutionReport | null = null;
  if (remediationPlan) {
    logger.section("AI Remediation Plan");
    logger.info(`Priority: ${remediationPlan.priority}`);
    logger.info(`Problem: ${remediationPlan.problem}`);
    logger.info(`Diagnosis: ${remediationPlan.diagnosis}`);
    if (remediationPlan.actions.length === 0) {
      logger.warn("No remediation actions were generated.");
    }
    remediationPlan.actions.forEach((action, index) => {
      logger.subsection(`Action ${index + 1}`);
      logger.info(`Title: ${action.title}`);
      logger.info(`Risk: ${action.risk}`);
      logger.info(`Requires Approval: ${action.requiresApproval}`);
      if (action.command) {
        logger.info(`Command: ${action.command}`);
      }
      logger.info(`Reason: ${action.reason}`);
    });
    if (remediationPlan.blockedActions?.length) {
      logger.section("Blocked Remediation Actions");
      remediationPlan.blockedActions.forEach((action) => {
        logger.item(action);
      });
    }
    logger.section("Remediation Execution");
    logger.info("Running remediation planner in OBSERVE mode.");
    logger.info("No infrastructure changes will be performed.");
    try {
      remediationExecution = await executeRemediationPlan(
        remediationPlan,
        "observe",
      );
      logger.success("Remediation plan execution completed.");
      logger.table({
        Executed: remediationExecution.executedCount,
        Validated: remediationExecution.validatedCount,
        Skipped: remediationExecution.skippedCount,
        Blocked: remediationExecution.blockedCount,
        Failed: remediationExecution.failedCount,
        "Awaiting Approval": remediationExecution.awaitingApprovalCount,
      });
      if (remediationExecution.results.length > 0) {
        logger.subsection("Execution Results");
        logger.table(
          remediationExecution.results.map((result) => ({
            Action: result.title,
            Risk: result.risk,
            Status: result.status,
            Approval: result.approvalId ?? "-",
            Command: result.command ?? "-",
            Message: result.message,
          })),
        );
      }
    } catch (error) {
      logger.error("Remediation execution layer failed.", error);
    }
    logger.section("Remediation Approval Status");
    try {
      const pendingApprovals = getPendingApprovals();
      if (pendingApprovals.length === 0) {
        logger.success("No pending remediation approvals.");
      } else {
        logger.table(
          pendingApprovals.map((approval) => ({
            ApprovalId: approval.id,
            Action: approval.actionTitle,
            Risk: approval.risk,
            Status: approval.status,
            RequestedAt: approval.requestedAt,
          })),
        );
      }
    } catch (error) {
      logger.error("Failed to load remediation approvals.", error);
    }
  } else {
    logger.warn(
      "No AI remediation plan was generated because AI analysis is unavailable.",
    );
  }
  logger.section("Full Incident Report");
  const finalReport = {
    ...report,
    aiAnalysis: aiResult,
    aiRemediation: remediationPlan,
    remediationExecution,
  };
  logger.data(finalReport);
  logger.section("Pipeline Completed Successfully");
}
main().catch((error) => {
  logger.error("Pipeline failed.", error);
  process.exit(1);
});
