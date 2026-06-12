import { describe, expect, it } from "vitest";
import { buildExerciseCacheKey, filterExercisesLocal, normalizeExerciseQuery } from "./normalizer";

describe("exercise query normalizer", () => {
  it("从中文自然语言推断器材和部位", () => {
    const result = normalizeExerciseQuery({ query: "在家用哑铃练胸", limit: 50 });
    expect(result.equipment).toBe("dumbbell");
    expect(result.bodyPart).toBe("chest");
    expect(result.limit).toBe(10);
  });

  it("支持细分肌群查询映射", () => {
    expect(normalizeExerciseQuery({ target: "上背" }).target).toBe("upper back");
    expect(normalizeExerciseQuery({ target: "前臂" }).target).toBe("forearms");
    expect(normalizeExerciseQuery({ target: "大腿内侧" }).target).toBe("adductors");
    expect(normalizeExerciseQuery({ target: "下背" }).target).toBe("spine");
  });

  it("生成稳定缓存 key", () => {
    const first = buildExerciseCacheKey(normalizeExerciseQuery({ query: "哑铃胸", offset: 0 }));
    const second = buildExerciseCacheKey(normalizeExerciseQuery({ query: "哑铃胸", offset: 0 }));
    expect(first).toBe(second);
  });

  it("支持 Free 模式本地多条件过滤", () => {
    const exercises = [
      { id: "1", name: "dumbbell bench press", bodyPart: "chest", target: "pectorals", equipment: "dumbbell" },
      { id: "2", name: "barbell bench press", bodyPart: "chest", target: "pectorals", equipment: "barbell" },
    ];
    const result = filterExercisesLocal(exercises, normalizeExerciseQuery({ bodyPart: "chest", equipment: "dumbbell" }));
    expect(result.map((exercise) => exercise.id)).toEqual(["1"]);
  });
});
