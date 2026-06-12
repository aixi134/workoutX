import type { WorkoutXExercise, WorkoutXResponse, WorkoutXUsage } from "./types";

export class WorkoutXApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly usage: WorkoutXUsage,
  ) {
    super(message);
    this.name = "WorkoutXApiError";
  }
}

export type WorkoutXClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = "https://api.workoutxapp.com/v1";

export class WorkoutXClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WorkoutXClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.WORKOUTX_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.WORKOUTX_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listExercises(params: { limit?: number; offset?: number } = {}) {
    return this.request<WorkoutXExercise[]>("/exercises", withLimit(params));
  }

  async getExercise(id: string) {
    return this.request<WorkoutXExercise>(`/exercises/exercise/${encodeURIComponent(id)}`);
  }

  async byEquipment(equipment: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<WorkoutXExercise[]>(`/exercises/equipment/${encodeURIComponent(equipment)}`, withLimit(params));
  }

  async byBodyPart(bodyPart: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<WorkoutXExercise[]>(`/exercises/bodyPart/${encodeURIComponent(bodyPart)}`, withLimit(params));
  }

  async byTarget(target: string, params: { limit?: number; offset?: number } = {}) {
    return this.request<WorkoutXExercise[]>(`/exercises/target/${encodeURIComponent(target)}`, withLimit(params));
  }

  async byName(name: string) {
    return this.request<WorkoutXExercise[]>(`/exercises/name/${encodeURIComponent(name)}`);
  }

  async equipmentList() {
    return this.request<string[]>("/exercises/equipmentList");
  }

  private async request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<WorkoutXResponse<T>> {
    if (!this.apiKey) {
      throw new WorkoutXApiError(401, "缺少 WORKOUTX_API_KEY，请在 .env 中配置。", {});
    }

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }

    const response = await this.fetchImpl(url, {
      headers: {
        "X-WorkoutX-Key": this.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const usage = readUsageHeaders(response.headers);
    const bodyText = await response.text();
    const body = bodyText ? safeJson(bodyText) : null;

    if (!response.ok) {
      const message =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : `WorkoutX 请求失败：HTTP ${response.status}`;
      throw new WorkoutXApiError(response.status, message, usage);
    }

    return { data: unwrapWorkoutXData<T>(body), usage };
  }
}

export function readUsageHeaders(headers: Headers): WorkoutXUsage {
  return {
    plan: headers.get("x-workoutx-plan"),
    rateLimitLimit: headers.get("x-ratelimit-limit"),
    rateLimitRemaining: headers.get("x-ratelimit-remaining"),
    quotaLimit: headers.get("x-quota-limit"),
    quotaRemaining: headers.get("x-quota-remaining"),
    quotaReset: headers.get("x-quota-reset"),
  };
}

export function unwrapWorkoutXData<T>(body: unknown): T {
  if (body && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function withLimit(params: { limit?: number; offset?: number }) {
  return {
    limit: Math.min(Math.max(params.limit ?? 10, 1), 10),
    offset: Math.max(params.offset ?? 0, 0),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
