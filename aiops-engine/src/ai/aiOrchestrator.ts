import { runAILayer } from "./aiEngine";

import type { AIAnalysisInput, AIAnalysisResult } from "./aiTypes";

export interface AIOrchestrationResult {
  available: boolean;

  provider: string;

  analysis: AIAnalysisResult | null;

  error: string | null;
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

export async function orchestrateAILayer(
  incidentReport: AIAnalysisInput["incidentReport"],
): Promise<AIOrchestrationResult> {
  const provider = getProvider();

  if (!isAIEnabled()) {
    console.log(
      "AI layer disabled. Continuing with deterministic AIOps intelligence.",
    );

    return {
      available: false,
      provider,
      analysis: null,
      error: "AI layer is disabled.",
    };
  }

  console.log("\n=====================================");
  console.log("AI INCIDENT INTELLIGENCE");
  console.log("=====================================\n");

  console.log("Analyzing incident report with AI...\n");

  try {
    const analysis = await runAILayer(incidentReport);

    console.log("AI incident analysis completed successfully.\n");

    return {
      available: true,
      provider,
      analysis,
      error: null,
    };
  } catch (error) {
    const classifiedError = classifyAIError(error);

    console.warn("\nAI analysis unavailable.");
    console.warn(classifiedError);
    console.warn("Continuing with deterministic AIOps intelligence.\n");

    return {
      available: false,
      provider,
      analysis: null,
      error: classifiedError,
    };
  }
}
