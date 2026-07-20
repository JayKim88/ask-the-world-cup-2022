import { describe, expect, it } from "vitest";

import { providerForModel } from "./model";

describe("providerForModel", () => {
  it("maps model prefixes to providers", () => {
    expect(providerForModel("gemini-2.5-flash")).toBe("google");
    expect(providerForModel("claude-sonnet-5")).toBe("anthropic");
    expect(providerForModel("gpt-4.1")).toBe("openai");
    expect(providerForModel("o3-mini")).toBe("openai");
  });

  it("throws on an unknown model", () => {
    expect(() => providerForModel("llama-3")).toThrow(/Unknown provider/);
  });
});
