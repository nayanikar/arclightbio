import Anthropic from "@anthropic-ai/sdk";
import { ApiError, requireEnv } from "@/lib/http";
import {
  withJsonFieldBrevity,
  withScientificWritingRules,
} from "@/lib/scientificLanguage";
import {
  getActiveAbortSignal,
  PipelineAbortedError,
} from "@/lib/pipelineRunControl";

const MODEL = "claude-sonnet-4-20250514";

export interface CallAgentOptions {
  temperature?: number;
  maxTokens?: number;
  /** When true, systemPrompt is sent as-is (caller already applied writing rules). */
  skipWritingRules?: boolean;
}

function throwIfPipelineAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new PipelineAbortedError();
  }
}

export async function callAgent(
  systemPrompt: string,
  userPrompt: string,
  options: CallAgentOptions = {}
): Promise<string> {
  const signal = getActiveAbortSignal();
  throwIfPipelineAborted(signal);

  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey });

  let message;
  try {
    message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature,
        system: options.skipWritingRules
          ? systemPrompt
          : withScientificWritingRules(systemPrompt),
        messages: [{ role: "user", content: userPrompt }],
      },
      signal ? { signal } : undefined
    );
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      throw new PipelineAbortedError();
    }
    throw err;
  }

  const block = message.content[0];
  if (block.type !== "text") {
    throw new ApiError("Unexpected response type from Anthropic", "PARSE_ERROR");
  }

  return block.text;
}

export async function callAgentJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: CallAgentOptions = {}
): Promise<T> {
  const text = await callAgent(
    `${withJsonFieldBrevity(systemPrompt)}\n\nRespond with valid JSON only, no markdown fences.`,
    userPrompt,
    { ...options, skipWritingRules: true }
  );
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new ApiError("Failed to parse Claude JSON response", "PARSE_ERROR");
  }
}

export { MODEL };
