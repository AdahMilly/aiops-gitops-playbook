import { logger } from "../utils/logger";
import { runAILayer } from "./aiEngine";

import { buildDeterministicAIAnalysis } from "./aiFallback";

import type {
  AIAnalysisInput,
  AIAnalysisResult,
} from "./aiTypes";

export interface AIOrchestrationResult {
  available: boolean;
  provider: string;
  analysis: AIAnalysisResult | null;
  error: string | null;
  mode: "ai" | "deterministic" | "unavailable";
}

function getProvider(): string {
  return process.env.AI_PROVIDER?.trim() || "openai";
}

function isAIEnabled(): boolean {
  const value = process.env.AI_ENABLED?.trim().toLowerCase();

  if (value === "false") {
    return false;
  }

  return true;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function classifyAIError(error: unknown): string {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("429")
  ) {
    return "AI provider quota or rate limit exceeded.";
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("authentication") ||
    normalized.includes("401")
  ) {
    return "AI provider authentication failed.";
  }

  if (
    normalized.includes("temporarily unavailable") ||
    normalized.includes("500") ||
    normalized.includes("502") ||
    normalized.includes("503")
  ) {
    return "AI provider is temporarily unavailable.";
  }

  return message;
}

function normalizeAIAnalysis(
  analysis: AIAnalysisResult,
  mode: "ai" | "deterministic",
): AIAnalysisResult {
  return {
    ...analysis,
    analysisMode: mode,

    nextActions: Array.isArray(analysis.nextActions)
      ? analysis.nextActions.filter(
          (action): action is string =>
            typeof action === "string" &&
            action.trim().length > 0,
        )
      : [],

    evidenceUsed: Array.isArray(analysis.evidenceUsed)
      ? analysis.evidenceUsed.filter(
          (evidence): evidence is string =>
            typeof evidence === "string" &&
            evidence.trim().length > 0,
        )
      : [],

    limitations: Array.isArray(analysis.limitations)
      ? analysis.limitations.filter(
          (limitation): limitation is string =>
            typeof limitation === "string" &&
            limitation.trim().length > 0,
        )
      : [],
  };
}

export async function orchestrateAILayer(
  incidentReport: AIAnalysisInput["incidentReport"],
): Promise<AIOrchestrationResult> {
  const provider = getProvider();

  logger.section("AI Incident Intelligence");

  logger.item(`Provider: ${provider}`);
  logger.item(`AI enabled: ${isAIEnabled()}`);

  if (!isAIEnabled()) {
    logger.warn(
      "AI provider disabled. Running deterministic AIOps intelligence.",
    );

    try {
      logger.info("Generating deterministic fallback analysis...");

      const fallbackAnalysis =
        buildDeterministicAIAnalysis(incidentReport);

      logger.success(
        "Deterministic fallback analysis generated successfully.",
      );

      return {
        available: true,
        provider: "deterministic-fallback",
        analysis: normalizeAIAnalysis(
          fallbackAnalysis,
          "deterministic",
        ),
        error: "AI layer is disabled.",
        mode: "deterministic",
      };
    } catch (error) {
      const message = getErrorMessage(error);

      logger.error(
        "Deterministic analysis failed while AI layer was disabled.",
      );
      logger.debug(message);

      return {
        available: false,
        provider: "unavailable",
        analysis: null,
        error:
          `AI layer is disabled and deterministic analysis failed: ${message}`,
        mode: "unavailable",
      };
    }
  }

  logger.info("Analyzing incident report with AI provider...");

  try {
    const analysis = await runAILayer(incidentReport);

    const normalizedAnalysis = normalizeAIAnalysis(
      analysis,
      "ai",
    );

    logger.success("AI incident analysis completed successfully.");

    return {
      available: true,
      provider,
      analysis: normalizedAnalysis,
      error: null,
      mode: "ai",
    };
  } catch (error) {
    const classifiedError = classifyAIError(error);

    logger.warn("AI provider unavailable.");
    logger.warn(`Reason: ${classifiedError}`);
    logger.info(
      "Falling back to deterministic AIOps intelligence...",
    );

    try {
      const fallbackAnalysis =
        buildDeterministicAIAnalysis(incidentReport);

      logger.success(
        "Deterministic fallback analysis completed successfully.",
      );

      return {
        available: true,
        provider: "deterministic-fallback",
        analysis: normalizeAIAnalysis(
          fallbackAnalysis,
          "deterministic",
        ),
        error: classifiedError,
        mode: "deterministic",
      };
    } catch (fallbackError) {
      const fallbackErrorMessage =
        getErrorMessage(fallbackError);

      logger.error(
        "Deterministic AI fallback also failed.",
      );
      logger.debug(fallbackErrorMessage);

      return {
        available: false,
        provider: "unavailable",
        analysis: null,
        error:
          `${classifiedError} ` +
          `Fallback failed: ${fallbackErrorMessage}`,
        mode: "unavailable",
      };
    }
  }
}