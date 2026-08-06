import { collectTelemetry } from "./collectors/telemetryCollector";
import { analyze } from "./analyzers/healthAnalyzer";
import { generateIncidentReport } from "./engines/generateIncidentReport";

async function main() {
  console.log("\n=====================================");
  console.log("      AIOps Incident Detection");
  console.log("=====================================\n");

  console.log("Collecting telemetry...\n");

  const telemetry = await collectTelemetry();

  console.log("Telemetry collected successfully.\n");

  const health = analyze({
    ...telemetry,
    events: telemetry.events,
  });

  console.log("Health analysis complete.\n");

const report = generateIncidentReport({
  health,
  telemetry,
});

  console.log("=====================================");
  console.log("INCIDENT SUMMARY");
  console.log("=====================================");

  console.table([
    {
      Score: report.summary.score,
      Level: report.summary.level,
      Healthy: report.summary.healthy,
    },
  ]);

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

    report.rootCause.evidence.forEach((e) => {
      console.log(` • ${e}`);
    });
  } else {
    console.log("No root cause detected.");
  }

  console.log("\n=====================================");
  console.log("CORRELATIONS");
  console.log("=====================================");

  console.table(
    report.correlations.map((finding) => ({
      Severity: finding.severity,
      Issue: finding.issue,
      Evidence: finding.evidence.join(", "),
    })),
  );

  console.log("\n=====================================");
  console.log("PREDICTIONS");
  console.log("=====================================");

  console.table(
    report.predictions.map((prediction) => ({
      Risk: prediction.risk,
      Probability: `${Math.round(prediction.probability * 100)}%`,
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
      console.log(`\n  Automation:`);
      console.log(`  ${recommendation.automation}`);
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
  console.log("FULL INCIDENT REPORT");
  console.log("=====================================\n");

  console.dir(report, {
    depth: null,
    colors: true,
  });

  console.log("\n=====================================");
  console.log("PIPELINE COMPLETED SUCCESSFULLY");
  console.log("=====================================\n");
}

main().catch((err) => {
  console.error("\nPipeline failed.\n");
  console.error(err);
  process.exit(1);
});
