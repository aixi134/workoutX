import { describe, expect, it } from "vitest";
import { WorkoutXClient, WorkoutXApiError } from "./client";

describe("WorkoutXClient", () => {
  it("限制 Free 请求 limit 最大为 10 并读取额度头", async () => {
    const calls: string[] = [];
    const client = new WorkoutXClient({
      apiKey: "wx_test",
      baseUrl: "https://example.test/v1",
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ total: 1, count: 1, data: [{ id: "1" }] }), {
          headers: {
            "x-workoutx-plan": "free",
            "x-ratelimit-limit": "30",
            "x-ratelimit-remaining": "29",
            "x-quota-limit": "500",
            "x-quota-remaining": "499",
          },
        });
      }) as typeof fetch,
    });

    const response = await client.byEquipment("dumbbell", { limit: 99 });
    expect(calls[0]).toContain("limit=10");
    expect(response.data).toEqual([{ id: "1" }]);
    expect(response.usage.plan).toBe("free");
    expect(response.usage.quotaRemaining).toBe("499");
  });

  it("把 WorkoutX 错误转换为结构化异常", async () => {
    const client = new WorkoutXClient({
      apiKey: "wx_test",
      baseUrl: "https://example.test/v1",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
        })) as typeof fetch,
    });

    await expect(client.byName("squat")).rejects.toBeInstanceOf(WorkoutXApiError);
  });
});
