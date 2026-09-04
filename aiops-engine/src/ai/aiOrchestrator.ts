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
            typeof action === "string" && action.trim().length > 0,
        )
      : [],
    evidenceUsed: Array.isArray(analysis.evidenceUsed)
      ? analysis.evidenceUsed.filter(
          (evidence): evidence is string =>
            typeof evidence === "string" && evidence.trim().length > 0,
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
  if (!isAIEnabled()) {
    console.log(
      "AI provider disabled. Running deterministic AIOps intelligence.",
    );
    try {
      const fallbackAnalysis = buildDeterministicAIAnalysis(
        incidentReport,
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
      return {
        available: false,
        provider: "unavailable",
        analysis: null,
        error: `AI layer is disabled and deterministic analysis failed: ${message}`,
        mode: "unavailable",
      };
    }
  }
  console.log("\n=====================================");
  console.log("AI INCIDENT INTELLIGENCE");
  console.log("=====================================\n");
  console.log("Analyzing incident report...\n");
  try {
    const analysis = await runAILayer(incidentReport);
    const normalizedAnalysis = normalizeAIAnalysis(
      analysis,
      "ai",
    );
    return {
      available: true,
      provider,
      analysis: normalizedAnalysis,
      error: null,
      mode: "ai",
    };
  } catch (error) {
    const classifiedError = classifyAIError(error);
    console.warn("AI provider unavailable.");
    console.warn(`Reason: ${classifiedError}`);
    console.warn(
      "Falling back to deterministic AIOps intelligence.\n",
    );
    try {
      const fallbackAnalysis =
        buildDeterministicAIAnalysis(incidentReport);
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
      console.error(
        "Deterministic AI fallback also failed.",
      );
      console.error(fallbackErrorMessage);
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