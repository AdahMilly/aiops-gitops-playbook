import OpenAI from "openai";

import type { AIAnalysisInput, AIAnalysisResult } from "./aiTypes";

import { buildAIPrompt, buildAISystemInstructions } from "./aiPromptBuilder";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      [
        "OPENAI_API_KEY is missing.",
        "Make sure aiops-engine/.env contains:",
        "",
        "OPENAI_API_KEY=sk-...",
        "OPENAI_MODEL=gpt-5.5",
      ].join("\n"),
    );
  }

  return new OpenAI({
    apiKey,
  });
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
}

const AI_ANALYSIS_SCHEMA = {
  type: "object",

  additionalProperties: false,

  properties: {
    summary: {
      type: "string",
    },

    diagnosis: {
      type: "string",
    },

    rootCauseExplanation: {
      type: "string",
    },

    impact: {
      type: "string",
    },

    riskExplanation: {
      type: "string",
    },

    nextActions: {
      type: "array",
      items: {
        type: "string",
      },
    },

    confidence: {
      type: "number",
    },

    evidenceUsed: {
      type: "array",
      items: {
        type: "string",
      },
    },

    limitations: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },

  required: [
    "summary",
    "diagnosis",
    "rootCauseExplanation",
    "impact",
    "riskExplanation",
    "nextActions",
    "confidence",
    "evidenceUsed",
    "limitations",
  ],
};

export async function runAILayer(
  report: AIAnalysisInput["incidentReport"],
): Promise<AIAnalysisResult> {
  const openai = getOpenAIClient();
  const model = getModel();

  const prompt = buildAIPrompt({
    incidentReport: report,
  });

  try {
    const response = await openai.responses.create({
      model,
      instructions: buildAISystemInstructions(),
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "ai_incident_analysis",
          strict: true,
          schema: AI_ANALYSIS_SCHEMA,
        },
      },
    });

    if (!response.output_text) {
      throw new Error("AI returned an empty response.");
    }

    let parsed: Omit<AIAnalysisResult, "generatedAt">;

    try {
      parsed = JSON.parse(response.output_text) as Omit<
        AIAnalysisResult,
        "generatedAt"
      >;
    } catch (error) {
      console.error("Failed to parse AI response:");
      console.error(response.output_text);

      throw new Error("AI returned invalid structured output.", {
        cause: error,
      });
    }

    validateAIResult(parsed);

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    if (error?.status === 429) {
      throw new Error("AI provider quota or rate limit exceeded.", {
        cause: error,
      });
    }
    if (error?.status === 401) {
      throw new Error(
        "AI provider authentication failed. Check OPENAI_API_KEY.",
        {
          cause: error,
        },
      );
    }
    if (error?.status >= 500) {
      throw new Error("AI provider temporarily unavailable.", {
        cause: error,
      });
    }

    throw error;
  }
}

function validateAIResult(result: Omit<AIAnalysisResult, "generatedAt">): void {
  if (!result.summary?.trim()) {
    throw new Error("AI response is missing summary.");
  }
  if (!result.diagnosis?.trim()) {
    throw new Error("AI response is missing diagnosis.");
  }
  if (!result.rootCauseExplanation?.trim()) {
    throw new Error("AI response is missing root cause explanation.");
  }
  if (!result.impact?.trim()) {
    throw new Error("AI response is missing impact analysis.");
  }
  if (!result.riskExplanation?.trim()) {
    throw new Error("AI response is missing risk explanation.");
  }
  if (!Array.isArray(result.nextActions)) {
    throw new Error("AI response contains invalid nextActions.");
  }
  if (!Array.isArray(result.evidenceUsed)) {
    throw new Error("AI response contains invalid evidenceUsed.");
  }
  if (!Array.isArray(result.limitations)) {
    throw new Error("AI response contains invalid limitations.");
  }
  if (
    typeof result.confidence !== "number" ||
    !Number.isFinite(result.confidence)
  ) {
    throw new Error("AI response contains invalid confidence.");
  }
  if (result.confidence < 0 || result.confidence > 1) {
    throw new Error("AI confidence must be between 0 and 1.");
  }
}
