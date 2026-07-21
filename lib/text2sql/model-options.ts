// UI-selectable model options for the BYOK picker (PRD §4/§5). These are only
// the choices shown in the dialog — the model actually called is whatever the
// user picked, passed per-request to the Server Action (invariant #5: the call
// path never hardcodes a model). Provider is inferred from the id prefix
// server-side (see model.ts). Default = Gemini, since Google AI Studio hands out
// free keys, making the public demo usable by anyone.

export interface ModelOption {
  id: string;
  label: string;
  provider: "Google" | "Anthropic" | "OpenAI";
}

// Default = gemini-2.0-flash: GA, available to new keys, and less congested than
// the bleeding-edge `-latest` alias (which returned "high demand" on free tier).
// The `-latest` aliases stay as options for anyone whose key prefers them.
export const MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google" },
  { id: "gemini-flash-latest", label: "Gemini Flash (latest)", provider: "Google" },
  { id: "gemini-pro-latest", label: "Gemini Pro (latest)", provider: "Google" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "Anthropic" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic" },
  { id: "gpt-5", label: "GPT-5", provider: "OpenAI" },
];

export const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_MODEL ?? "gemini-2.0-flash";

const PROVIDER_KEY_URLS: Record<ModelOption["provider"], string> = {
  Google: "https://aistudio.google.com/apikey",
  Anthropic: "https://console.anthropic.com/settings/keys",
  OpenAI: "https://platform.openai.com/api-keys",
};

export function isKnownModel(modelId: string): boolean {
  return MODEL_OPTIONS.some((option) => option.id === modelId);
}

export function providerLabelOf(modelId: string): ModelOption["provider"] | null {
  return MODEL_OPTIONS.find((option) => option.id === modelId)?.provider ?? null;
}

export function keyUrlOf(modelId: string): string | null {
  const provider = providerLabelOf(modelId);
  return provider ? PROVIDER_KEY_URLS[provider] : null;
}
