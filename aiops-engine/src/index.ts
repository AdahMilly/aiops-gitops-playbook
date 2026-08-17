import { collectTelemetry } from "./collectors/telemetryCollector";
import { analyze } from "./analyzers/healthAnalyzer";
import { generateIncidentReport } from "./engines/generateIncidentReport";
import {
  loadIncidentState,
  saveIncidentState,
} from "./state/incidentStateStore";
import { runAILayer } from "./ai/aiEngine";
import { orchestrateAILayer } from "./ai/aiOrchestrator";
import { buildAIRemediationPlan } from "./ai/aiRemediationPlanner";

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

  console.log(
    `Incident state saved: ${report.incidentLifecycle.activeIncidents.length} active incidents.\n`,
  );

  console.log("=====================================");
  console.log("AI INCIDENT INTELLIGENCE");
  console.log("=====================================\n");

  console.log("Analyzing incident report with AI...\n");

  let aiAnalysis;

  try {
    console.log("\n=====================================");
    console.log("AI INCIDENT INTELLIGENCE");
    console.log("=====================================\n");

    console.log("Analyzing incident report with AI...\n");

    aiAnalysis = await runAILayer(report);

    console.log("AI analysis completed successfully.\n");
  } catch (error: any) {
    console.error("\nAI analysis unavailable.");

    if (error?.code === "insufficient_quota") {
      console.error(
        "OpenAI API quota is exhausted. Continuing with deterministic AIOps intelligence.",
      );
    } else {
      console.error(error);
    }

    aiAnalysis = {
      available: false,
      provider: "openai",
      error:
        error?.code === "insufficient_quota"
          ? "API quota exhausted"
          : "AI analysis failed",
      analysis: null,
    };
  }

  const aiResult = await orchestrateAILayer(report);

  const remediationPlan = aiResult.analysis
    ? buildAIRemediationPlan(aiResult.analysis)
    : null;

  console.log("\n=====================================");
  console.log("FULL INCIDENT REPORT");
  console.log("=====================================\n");

  const finalReport = {
    ...report,

    aiAnalysis: aiResult,

    aiRemediation: remediationPlan,
  };

  console.dir(finalReport, { depth: null });

  console.log("\n=====================================");
  console.log("PIPELINE COMPLETED SUCCESSFULLY");
  console.log("=====================================\n");
}

main().catch((error) => {
  console.error("\nPipeline failed.\n");
  console.error(error);

  process.exit(1);
});
