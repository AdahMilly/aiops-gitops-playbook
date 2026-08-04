import { collectTelemetry } from "./collectors/telemetryCollector";
import { analyze } from "./analyzers/healthAnalyzer";
import { detectRootCause } from "./analyzers/rootCauseAnalyzer";
import { recommend } from "./engines/recommendationEngine";

async function main() {
  console.log("Collecting telemetry...");

  const telemetry = await collectTelemetry();

  console.log("\nTelemetry");
  console.dir(telemetry, { depth: null });

  console.log("\nAnalyzing health...");

  const health = analyze(telemetry);

  console.log("\nHealth");
  console.dir(health);

  const causes = detectRootCause(health, telemetry.logs, telemetry.traces);

  console.log("\nRoot Cause Analysis");
  console.dir(causes, { depth: null });

  console.log("\nRecommendations");
  console.dir(recommend(causes), { depth: null });
}

main();
