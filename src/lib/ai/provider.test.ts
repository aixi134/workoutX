import { describe, expect, it } from "vitest";
import { OpenAIEquipmentProvider, normalizeCandidates, resolveOpenAIBaseURL } from "./provider";

describe("AI equipment provider helpers", () => {
  it("将模型输出映射到 WorkoutX equipment vocabulary", () => {
    const candidates = normalizeCandidates(
      [
        { equipment: "哑铃", confidence: 0.88, reason: "visible dumbbells" },
        { equipment: "unknown", confidence: 0.7, reason: "not allowed" },
        { equipment: "dumbbells", confidence: 0.5, reason: "duplicate" },
      ],
      ["dumbbell", "barbell", "body weight"],
    );
    expect(candidates).toEqual([{ equipment: "dumbbell", confidence: 0.88, reason: "visible dumbbells" }]);
  });

  it("支持通过环境变量配置 OpenAI baseURL", () => {
    const previousBaseUrl = process.env.OPENAI_BASE_URL;
    const previousBaseurl = process.env.OPENAI_BASEURL;
    process.env.OPENAI_BASE_URL = "https://llm-gateway.example.test/v1";
    delete process.env.OPENAI_BASEURL;

    try {
      expect(resolveOpenAIBaseURL()).toBe("https://llm-gateway.example.test/v1");
      const provider = new OpenAIEquipmentProvider({ apiKey: "sk-test" });
      expect(provider.baseURL).toBe("https://llm-gateway.example.test/v1");
    } finally {
      if (previousBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
      else process.env.OPENAI_BASE_URL = previousBaseUrl;
      if (previousBaseurl === undefined) delete process.env.OPENAI_BASEURL;
      else process.env.OPENAI_BASEURL = previousBaseurl;
    }
  });

  it("支持 OPENAI_BASEURL 兼容别名", () => {
    const previousBaseUrl = process.env.OPENAI_BASE_URL;
    const previousBaseurl = process.env.OPENAI_BASEURL;
    delete process.env.OPENAI_BASE_URL;
    process.env.OPENAI_BASEURL = "https://compat.example.test/v1";

    try {
      expect(resolveOpenAIBaseURL()).toBe("https://compat.example.test/v1");
    } finally {
      if (previousBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
      else process.env.OPENAI_BASE_URL = previousBaseUrl;
      if (previousBaseurl === undefined) delete process.env.OPENAI_BASEURL;
      else process.env.OPENAI_BASEURL = previousBaseurl;
    }
  });
});
