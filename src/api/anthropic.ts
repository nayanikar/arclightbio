import Anthropic from "@anthropic-ai/sdk";
import { ApiError, requireEnv } from "@/lib/http";

const MODEL = "claude-sonnet-4-20250514";

export async function callAgent(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new ApiError("Unexpected response type from Anthropic", "PARSE_ERROR");
  }

  return block.text;
}

export async function callAgentJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const text = await callAgent(
    systemPrompt + "\n\nRespond with valid JSON only, no markdown fences.",
    userPrompt
  );
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new ApiError("Failed to parse Claude JSON response", "PARSE_ERROR");
  }
}

export { MODEL };
