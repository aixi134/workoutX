import { describe, expect, it } from "vitest";
import { buildWeeklySplit, getGoalTemplate } from "./generator";

describe("plan generator rules", () => {
  it("按周训练天数选择 split", () => {
    expect(buildWeeklySplit(3)).toEqual(["full_body", "full_body", "full_body"]);
    expect(buildWeeklySplit(4)).toEqual(["upper", "lower", "upper", "lower"]);
    expect(buildWeeklySplit(5)).toEqual(["push", "pull", "legs", "upper", "lower"]);
  });

  it("根据目标生成组次数模板", () => {
    expect(getGoalTemplate("strength", "intermediate")).toMatchObject({ sets: 4, reps: "4-6", restSeconds: 120 });
    expect(getGoalTemplate("fat_loss", "beginner")).toMatchObject({ reps: "12-15", restSeconds: 45 });
    expect(getGoalTemplate("mobility", "advanced")).toMatchObject({ sets: 2, reps: "30-45秒" });
  });
});
