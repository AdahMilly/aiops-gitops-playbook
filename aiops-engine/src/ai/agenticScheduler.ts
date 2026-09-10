import { logger } from "../utils/logger";

import { createDemoIncidentReport } from "./demoIncidentReport";
import { runAgenticRemediationLoop } from "./agenticRemediationLoop";

type SchedulerMode = "observe" | "dry-run";

const mode = (
  process.env.AIOPS_SCHEDULED_MODE || "observe"
) as SchedulerMode;

const intervalMinutes = Number(
  process.env.AIOPS_SCHEDULE_INTERVAL_MINUTES || 5,
);

const maxActions = Math.min(
  3,
  Math.max(
    1,
    Number(process.env.AIOPS_MAX_ACTIONS || 3),
  ),
);

const verify =
  process.env.AIOPS_VERIFY !== undefined
    ? process.env.AIOPS_VERIFY !== "false"
    : true;
const intervalMs = intervalMinutes * 60 * 1000;

let running = false;
let timer: NodeJS.Timeout | undefined;

async function runScheduledCheck(): Promise<void> {
  if (running) {
    logger.warn(
      "Previous AIOps cycle is still running. Skipping this cycle.",
    );
    return;
  }
  running = true;

  logger.section("AIOps Scheduled Run");
  logger.item(`Time: ${new Date().toISOString()}`);
  logger.item(`Mode: ${mode}`);
  logger.item(`Maximum actions: ${maxActions}`);
  logger.item(`Verification: ${verify}`);

  try {
    logger.info(
      "Creating deterministic incident report...",
    );
    const incidentReport = createDemoIncidentReport();
    logger.success(
      "Deterministic incident report created.",
    );
    logger.info(
      "Starting scheduled AIOps remediation cycle...",
    );
    const result = await runAgenticRemediationLoop(
      incidentReport,
      {
        mode,
        maxActions,
        verify,
      },
    );
    logger.section("Scheduled Result");
    logger.item(`State: ${result.state}`);
    logger.item(`Resolved: ${result.resolved}`);
    logger.item(`Stopped: ${result.stopped}`);
    logger.item(
      `Attempted actions: ${result.attemptedActions}`,
    );
    logger.item(`Reason: ${result.reason}`);
    if (result.resolved) {
      logger.success(
        "Scheduled AIOps cycle completed successfully.",
      );
    } else {
      logger.warn(
        "Scheduled AIOps cycle completed without resolving the incident.",
      );
    }
    logger.blank();
  } catch (error: unknown) {
    logger.error(
      "Scheduled AIOps cycle failed.",
    );
    if (error instanceof Error) {
      logger.error(error.message);
      if (error.stack) {
        logger.debug(error.stack);
      }
    } else {
      logger.error(
        "Unknown scheduler error.",
        error,
      );
    }
  } finally {
    running = false;
  }
}

function shutdown(signal: string): void {
  logger.blank();
  logger.info(
    `Received ${signal}. Stopping AIOps scheduler...`,
  );
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  logger.success("AIOps scheduler stopped.");
  process.exit(0);
}

async function startScheduler(): Promise<void> {
  logger.section("AIOps Agentic Scheduler");

  logger.item(`Mode: ${mode}`);
  logger.item(
    `Interval: every ${intervalMinutes} minute(s)`,
  );
  logger.item(`Maximum actions: ${maxActions}`);
  logger.item(`Verification: ${verify}`);

  logger.blank();

  logger.success("Scheduler started.");
  logger.info("Press Ctrl+C to stop.");

  logger.blank();

  await runScheduledCheck();

  timer = setInterval(() => {
    void runScheduledCheck();
  }, intervalMs);
  logger.info(
    `Next AIOps cycle scheduled in ${intervalMinutes} minute(s).`,
  );
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

void startScheduler();