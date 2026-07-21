"use server";

// Server Action boundary (PRD §5). Reachable via direct POST, so every input is
// untrusted (Next 16 security guidance): trim, bound, and require the BYOK key
// here before handing off to the orchestrator. The user's key is used only for
// this request — never persisted or logged.

import { ask, type AskResult } from "@/lib/text2sql/ask";

const MAX_QUESTION_LENGTH = 500;

export interface AskInput {
  question: string;
  model: string;
  apiKey: string;
}

export async function askAction(input: AskInput): Promise<AskResult> {
  const question = (input.question ?? "").trim();
  const model = (input.model ?? "").trim();
  const apiKey = (input.apiKey ?? "").trim();

  if (!apiKey) return { kind: "error", message: "API 키를 먼저 설정해 주세요 (우측 상단 설정)." };
  if (!model) return { kind: "error", message: "모델이 설정되지 않았습니다." };
  if (!question) return { kind: "error", message: "질문을 입력해 주세요." };
  if (question.length > MAX_QUESTION_LENGTH) return { kind: "error", message: `질문이 너무 깁니다 (최대 ${MAX_QUESTION_LENGTH}자).` };

  return ask({ question, model, apiKey });
}
