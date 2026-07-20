// Provider selection for BYOK (PRD §4): the model string picks the provider,
// the user's per-request key builds the client. Default provider = Google
// (free Gemini keys); Anthropic and OpenAI are also supported.

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type Provider = "google" | "anthropic" | "openai";

const PROVIDER_BY_PREFIX: { prefix: string; provider: Provider }[] = [
  { prefix: "gemini", provider: "google" },
  { prefix: "claude", provider: "anthropic" },
  { prefix: "gpt", provider: "openai" },
  { prefix: "o1", provider: "openai" },
  { prefix: "o3", provider: "openai" },
];

export function providerForModel(model: string): Provider {
  const match = PROVIDER_BY_PREFIX.find((entry) => model.startsWith(entry.prefix));
  if (!match) throw new Error(`Unknown provider for model "${model}"`);
  return match.provider;
}

export function buildModel(model: string, apiKey: string): LanguageModel {
  const provider = providerForModel(model);
  if (provider === "google") return createGoogleGenerativeAI({ apiKey })(model);
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  return createOpenAI({ apiKey })(model);
}

// OpenAI reasoning models (o1, o3, …) reject `temperature`; everything else accepts it.
export function supportsTemperature(model: string): boolean {
  return !/^o\d/.test(model);
}
