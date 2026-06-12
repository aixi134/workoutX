import OpenAI from "openai";
import { matchEquipmentVocabulary } from "@/lib/exercises/normalizer";

export type EquipmentCandidate = {
  equipment: string;
  confidence: number;
  reason?: string;
};

export type EquipmentRecognitionResult = {
  provider: string;
  model: string;
  candidates: EquipmentCandidate[];
  rawOutput?: unknown;
  fallback?: boolean;
  fallbackReason?: string;
};

export type RecognizeEquipmentInput = {
  imageBuffer: Buffer;
  mimeType: string;
  equipmentVocabulary: string[];
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  recognizeEquipment(input: RecognizeEquipmentInput): Promise<EquipmentRecognitionResult>;
}

export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  if (provider === "mock" || !process.env.OPENAI_API_KEY) return new MockEquipmentProvider();
  return new OpenAIEquipmentProvider();
}

export class MockEquipmentProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock-equipment-v1";

  async recognizeEquipment(input: RecognizeEquipmentInput): Promise<EquipmentRecognitionResult> {
    const preferred = ["dumbbell", "body weight", "barbell"];
    const candidates = preferred
      .map((item) => matchEquipmentVocabulary(item, input.equipmentVocabulary) ?? item)
      .filter((item, index, array) => array.indexOf(item) === index)
      .slice(0, 3)
      .map((equipment, index) => ({
        equipment,
        confidence: Math.max(0.55, 0.9 - index * 0.15),
        reason: "Mock provider fallback，用于本地无 OPENAI_API_KEY 或上游不可用时调试。",
      }));

    return { provider: this.name, model: this.model, candidates, rawOutput: { mocked: true } };
  }
}

export class OpenAIEquipmentProvider implements AIProvider {
  readonly name = "openai";
  readonly model: string;
  readonly baseURL?: string;
  private readonly client: OpenAI;

  constructor(options: { apiKey?: string; model?: string; baseURL?: string } = {}) {
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
    this.baseURL = options.baseURL ?? resolveOpenAIBaseURL();
    this.client = new OpenAI({
      apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });
  }

  async recognizeEquipment(input: RecognizeEquipmentInput): Promise<EquipmentRecognitionResult> {
    const dataUrl = `data:${input.mimeType};base64,${input.imageBuffer.toString("base64")}`;
    const prompt = buildEquipmentPrompt(input.equipmentVocabulary);
    const failures: string[] = [];

    try {
      return await this.recognizeWithResponses(input, dataUrl, prompt);
    } catch (error) {
      failures.push(`responses: ${formatProviderError(error)}`);
    }

    try {
      return await this.recognizeWithChatCompletions(input, dataUrl, prompt);
    } catch (error) {
      failures.push(`chat.completions: ${formatProviderError(error)}`);
    }

    if (process.env.AI_FALLBACK_TO_MOCK !== "false") {
      const fallback = await new MockEquipmentProvider().recognizeEquipment(input);
      return {
        ...fallback,
        fallback: true,
        fallbackReason: failures.join("; "),
        rawOutput: { mocked: true, upstreamFailures: failures },
      };
    }

    throw new Error(failures.join("; "));
  }

  private async recognizeWithResponses(
    input: RecognizeEquipmentInput,
    dataUrl: string,
    prompt: string,
  ): Promise<EquipmentRecognitionResult> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: dataUrl,
              detail: "low",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "equipment_recognition",
          strict: true,
          schema: equipmentJsonSchema,
        },
      },
    } as never);

    const outputText = response.output_text ?? "{}";
    const parsed = safeParseOutput(outputText);
    return {
      provider: this.name,
      model: this.model,
      candidates: normalizeCandidates(parsed.candidates ?? [], input.equipmentVocabulary),
      rawOutput: { api: "responses", id: response.id, outputText },
    };
  }

  private async recognizeWithChatCompletions(
    input: RecognizeEquipmentInput,
    dataUrl: string,
    prompt: string,
  ): Promise<EquipmentRecognitionResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    } as never);

    const outputText = response.choices[0]?.message?.content ?? "{}";
    const parsed = safeParseOutput(outputText);
    return {
      provider: this.name,
      model: this.model,
      candidates: normalizeCandidates(parsed.candidates ?? [], input.equipmentVocabulary),
      rawOutput: { api: "chat.completions", id: response.id, outputText },
    };
  }
}

export function normalizeCandidates(rawCandidates: unknown[], vocabulary: string[]): EquipmentCandidate[] {
  const seen = new Set<string>();
  const candidates: EquipmentCandidate[] = [];

  for (const raw of rawCandidates) {
    if (!raw || typeof raw !== "object") continue;
    const value = "equipment" in raw ? String(raw.equipment) : "";
    const matched = matchEquipmentVocabulary(value, vocabulary);
    if (!matched || seen.has(matched)) continue;
    seen.add(matched);
    const confidence = "confidence" in raw ? Number(raw.confidence) : 0.5;
    candidates.push({
      equipment: matched,
      confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.5,
      reason: "reason" in raw && typeof raw.reason === "string" ? raw.reason : undefined,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

export function resolveOpenAIBaseURL() {
  const value = process.env.OPENAI_BASE_URL ?? process.env.OPENAI_BASEURL;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const equipmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          equipment: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
        required: ["equipment", "confidence", "reason"],
      },
    },
  },
  required: ["candidates"],
};

function buildEquipmentPrompt(equipmentVocabulary: string[]) {
  const vocabulary = equipmentVocabulary.join(", ");
  return (
    "识别图片里可用于健身训练的器材。只从给定 WorkoutX equipment vocabulary 中选择最匹配的值。" +
    `\nVocabulary: ${vocabulary}\n` +
    '只返回 JSON，不要 Markdown：{"candidates":[{"equipment":string,"confidence":0-1,"reason":string}]}。最多 5 个候选。'
  );
}

function safeParseOutput(outputText: string): { candidates?: unknown[] } {
  try {
    const parsed = JSON.parse(outputText);
    return parsed && typeof parsed === "object" ? (parsed as { candidates?: unknown[] }) : {};
  } catch {
    return { candidates: [] };
  }
}

function formatProviderError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}
