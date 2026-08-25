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

async function main() {
  console.log("\n=====================================");
  console.log("      AIOps Incident Detection");
  console.log("=====================================\n");
  console.log("Collecting telemetry...\n");
  const telemetry = await collectTelemetry();
  console.log("Telemetry collected successfully.\n");
  const health = analyze(telemetry);
  console.log("Health analysis complete.\n");
  const previousIncidents = loadIncidentState();
  console.log(`Loaded ${previousIncidents.length} previous incidents.\n`);
  const report = generateIncidentReport({
    health,
    telemetry,
    previousIncidents,
  });

  saveIncidentState(report.incidentLifecycle.incidents);

  console.log(
    `Incident state saved: ${report.incidentLifecycle.activeIncidents.length} active incidents.\n`,
  );
  console.log("=====================================");
  console.log("INCIDENT SUMMARY");
  console.log("=====================================");
  console.table({
    Score: report.summary.score,
    Level: report.summary.level,
    Healthy: report.summary.healthy,
  });
  console.log("\n=====================================");
  console.log("ROOT CAUSE");
  console.log("=====================================");
  if (report.rootCause) {
    console.table([
      {
        Category: report.rootCause.category,
        Subcategory: report.rootCause.subcategory,
        Confidence: `${report.rootCause.confidence}%`,
      },
    ]);
    console.log("\nEvidence:");
    report.rootCause.evidence.forEach((evidence) => {
      console.log(` • ${evidence}`);
    });
  } else {
    console.log("No root cause identified.");
  }
  console.log("\n=====================================");
  console.log("INCIDENT GROUPS");
  console.log("=====================================");
  report.incidentGroups.forEach((group, index) => {
    console.log(`\nIncident ${index + 1}`);
    console.table([
      {
        Title: group.title,
        Category: group.category,
        Severity: group.severity,
        Findings: group.findings.length,
        Pods: group.affectedPods.length,
      },
    ]);
    console.log("\nFindings:");
    group.findings.forEach((finding) => {
      console.log(` • ${finding.issue} (${finding.severity})`);
    });
    console.log("\nEvidence:");
    group.evidence.forEach((evidence) => {
      console.log(` • ${evidence}`);
    });
    if (group.affectedPods.length > 0) {
      console.log("\nAffected Pods:");
      group.affectedPods.forEach((pod) => {
        console.log(` • ${pod}`);
      });
    }
    console.log("");
  });
  console.log("=====================================");
  console.log("CORRELATIONS");
  console.log("=====================================");
  console.table(
    report.correlations.map((finding) => ({
      Severity: finding.severity,
      Issue: finding.issue,
      Status: finding.status,
      Source: finding.source,
      Evidence: finding.evidence.join(", "),
    })),
  );
  console.log("\n=====================================");
  console.log("PREDICTIONS");
  console.log("=====================================");
  console.table(
    report.predictions.map((prediction) => ({
      Metric: prediction.metric,
      Risk: prediction.risk,
      Probability: `${Math.round(prediction.probability * 100)}%`,
      Horizon: prediction.horizon,
      Message: prediction.message,
    })),
  );
  console.log("\n=====================================");
  console.log("RECOMMENDATIONS");
  console.log("=====================================");
  report.recommendations.forEach((recommendation) => {
    console.log(`\n[${recommendation.priority}] ${recommendation.issue}`);
    recommendation.actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action}`);
    });
    if (recommendation.automation) {
      console.log(`\n  Automation:\n  ${recommendation.automation}`);
    }
  });
  console.log("\n=====================================");
  console.log("INCIDENT TIMELINE");
  console.log("=====================================");
  console.table(
    report.timeline.map((entry) => ({
      Time: entry.timestamp,
      Source: entry.source,
      Severity: entry.severity,
      Title: entry.title,
    })),
  );
  console.log("\n=====================================");
  console.log("INCIDENT LIFECYCLE");
  console.log("=====================================");
  console.table(
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
  console.log("\n=====================================");
  console.log("AI INCIDENT INTELLIGENCE");
  console.log("=====================================\n");
  console.log("Passing incident report to AI orchestrator...\n");
  let aiResult;
  try {
    aiResult = await orchestrateAILayer(report);
    if (aiResult.available) {
      console.log("AI analysis completed successfully.\n");
    } else {
      console.log(
        "AI analysis unavailable. Continuing with deterministic intelligence.\n",
      );
      if (aiResult.error) {
        console.log(`AI reason: ${aiResult.error}\n`);
      }
    }
  } catch (error) {
    console.error("\nAI orchestration failed.");
    console.error(error);
    aiResult = {
      available: false,
      provider: "openai" as const,
      error: "AI orchestration failed",
      analysis: null,
    };
  }
  console.log("=====================================");
  console.log("AI REMEDIATION PLANNER");
  console.log("=====================================\n");
  const remediationPlan = aiResult.analysis
    ? buildAIRemediationPlan(aiResult.analysis)
    : null;
  let remediationExecution: RemediationExecutionReport | null = null;
  if (remediationPlan) {
    console.log("\n=====================================");
    console.log("AI REMEDIATION PLAN");
    console.log("=====================================\n");
    console.log(`Priority: ${remediationPlan.priority}`);
    console.log(`Problem: ${remediationPlan.problem}`);
    console.log(`Diagnosis: ${remediationPlan.diagnosis}\n`);
    remediationPlan.actions.forEach((action, index) => {
      console.log(`Action ${index + 1}`);
      console.log(`  Title: ${action.title}`);
      console.log(`  Risk: ${action.risk}`);
      console.log(`  Requires Approval: ${action.requiresApproval}`);
      if (action.command) {
        console.log(`  Command: ${action.command}`);
      }
      console.log(`  Reason: ${action.reason}`);
      console.log("");
    });
    console.log("=====================================");
    console.log("REMEDIATION EXECUTION");
    console.log("=====================================\n");
    console.log("Running remediation planner in OBSERVE mode.\n");
    try {
      remediationExecution = await executeRemediationPlan(
        remediationPlan,
        "observe",
      );
      console.log(`Executed: ${remediationExecution.executedCount}`);
      console.log(`Validated: ${remediationExecution.validatedCount}`);
      console.log(`Skipped: ${remediationExecution.skippedCount}`);
      console.log(`Blocked: ${remediationExecution.blockedCount}`);
      console.log(`Failed: ${remediationExecution.failedCount}`);
      console.log(
        `Awaiting Approval: ${remediationExecution.awaitingApprovalCount}`,
      );
      console.log("");
      if (remediationExecution.results.length > 0) {
        console.table(
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
      console.error("\nRemediation execution layer failed.");
      console.error(error);
    }
    console.log("\n=====================================");
    console.log("REMEDIATION APPROVAL STATUS");
    console.log("=====================================\n");
    try {
      const pendingApprovals = getPendingApprovals();
      if (pendingApprovals.length === 0) {
        console.log("No pending remediation approvals.");
      } else {
        console.table(
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
      console.error("Failed to load remediation approvals.");
      console.error(error);
    }
  } else {
    console.log(
      "No AI remediation plan was generated because AI analysis is unavailable.",
    );
  }
  console.log("\n=====================================");
  console.log("FULL INCIDENT REPORT");
  console.log("=====================================\n");
  const finalReport = {
    ...report,
    aiAnalysis: aiResult,
    aiRemediation: remediationPlan,
    remediationExecution,
  };
  console.dir(finalReport, {
    depth: null,
  });
  console.log("\n=====================================");
  console.log("PIPELINE COMPLETED SUCCESSFULLY");
  console.log("=====================================\n");
}
main().catch((error) => {
  console.error("\nPipeline failed.\n");
  console.error(error);
  process.exit(1);
});
