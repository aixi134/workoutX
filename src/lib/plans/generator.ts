import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { searchExercises } from "@/lib/exercises/service";
import { normalizeEquipmentLabel, normalizeExerciseQuery } from "@/lib/exercises/normalizer";
import type { WorkoutXExercise } from "@/lib/workoutx/types";
import { addChineseDetails, addChineseLabels } from "@/lib/i18n/exercise";

export const planInputSchema = z.object({
  goal: z.enum(["muscle_gain", "strength", "fat_loss", "endurance", "mobility"]).default("muscle_gain"),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  daysPerWeek: z.number().int().min(2).max(6).default(4),
  sessionDuration: z.number().int().min(20).max(120).default(45),
  need: z.string().max(240).optional().default(""),
  equipment: z.array(z.string()).default(["body weight"]),
  bodyFocus: z.array(z.string()).default([]),
  targetFocus: z.array(z.string()).default([]),
});

export type PlanInput = z.infer<typeof planInputSchema>;

export type GeneratedPlan = {
  slug: "current";
  goal: PlanInput["goal"];
  level: PlanInput["level"];
  daysPerWeek: number;
  sessionDuration: number;
  equipment: string[];
  days: GeneratedPlanDay[];
};

export type GeneratedPlanDay = {
  dayIndex: number;
  label: string;
  focus: string;
  items: GeneratedPlanItem[];
};

export type GeneratedPlanItem = {
  order: number;
  sets: number;
  reps: string;
  restSeconds: number;
  note?: string;
  exerciseId?: string;
  exerciseSnapshot?: Pick<WorkoutXExercise, "id" | "name" | "bodyPart" | "target" | "equipment" | "gifUrl"> | Record<string, unknown>;
};

const TARGET_TO_BODY_PART: Record<string, string> = {
  abductors: "upper legs",
  abs: "waist",
  adductors: "upper legs",
  biceps: "upper arms",
  calves: "lower legs",
  "cardiovascular system": "cardio",
  delts: "shoulders",
  forearms: "lower arms",
  glutes: "upper legs",
  hamstrings: "upper legs",
  lats: "back",
  pectorals: "chest",
  quads: "upper legs",
  spine: "back",
  traps: "back",
  triceps: "upper arms",
  "upper back": "back",
};

const FOCUS_ZH: Record<string, string> = {
  chest: "胸部",
  back: "背部",
  shoulders: "肩部",
  "upper arms": "上臂",
  "lower arms": "前臂",
  "upper legs": "臀腿",
  "lower legs": "小腿",
  waist: "核心",
  cardio: "心肺",
  abductors: "髋外展肌",
  abs: "腹肌",
  adductors: "大腿内侧",
  biceps: "肱二头肌",
  triceps: "肱三头肌",
  pectorals: "胸肌",
  delts: "三角肌",
  lats: "背阔肌",
  glutes: "臀肌",
  quads: "股四头肌",
  hamstrings: "腘绳肌",
  calves: "小腿肌群",
  "upper back": "上背",
  forearms: "前臂",
  traps: "斜方肌",
  spine: "下背",
};

const BODY_PARTS_BY_FOCUS: Record<string, string[]> = {
  full_body: ["chest", "back", "shoulders", "upper legs", "waist"],
  upper: ["chest", "back", "shoulders", "upper arms"],
  lower: ["upper legs", "lower legs", "waist"],
  push: ["chest", "shoulders", "upper arms"],
  pull: ["back", "upper arms", "lower arms"],
  legs: ["upper legs", "lower legs", "waist"],
  core: ["waist"],
};

const FOCUS_LABEL: Record<string, string> = {
  full_body: "全身",
  upper: "上肢",
  lower: "下肢",
  push: "推类",
  pull: "拉类",
  legs: "腿部",
  core: "核心",
};

export function buildWeeklySplit(daysPerWeek: number) {
  if (daysPerWeek <= 3) return Array.from({ length: daysPerWeek }, () => "full_body");
  if (daysPerWeek === 4) return ["upper", "lower", "upper", "lower"];
  if (daysPerWeek === 5) return ["push", "pull", "legs", "upper", "lower"];
  return ["push", "pull", "legs", "push", "pull", "legs"];
}

export function getGoalTemplate(goal: PlanInput["goal"], level: PlanInput["level"]) {
  const levelBonus = level === "advanced" ? 1 : 0;
  const beginnerPenalty = level === "beginner" ? -1 : 0;
  const adjustSets = (sets: number) => Math.max(2, sets + levelBonus + beginnerPenalty);

  switch (goal) {
    case "strength":
      return { sets: adjustSets(4), reps: "4-6", restSeconds: 120, note: "力量主项，优先动作质量和充分休息。" };
    case "fat_loss":
      return { sets: adjustSets(3), reps: "12-15", restSeconds: 45, note: "控制节奏，组间休息较短。" };
    case "endurance":
      return { sets: adjustSets(2), reps: "15-20", restSeconds: 30, note: "耐力导向，保持稳定呼吸。" };
    case "mobility":
      return { sets: 2, reps: "30-45秒", restSeconds: 30, note: "灵活性导向，动作范围优先。" };
    case "muscle_gain":
    default:
      return { sets: adjustSets(3), reps: "8-12", restSeconds: 75, note: "增肌导向，保留 1-3 次余力。" };
  }
}

export async function generateAndSaveWeeklyPlan(rawInput: unknown) {
  const input = normalizePlanInput(rawInput);
  const generated = await generateWeeklyPlan(input);
  return saveCurrentPlan(generated);
}

export async function generateWeeklyPlan(input: PlanInput): Promise<GeneratedPlan> {
  const customBodyFocus = normalizeFocusList(input.bodyFocus);
  const customTargetFocus = normalizeFocusList(input.targetFocus);
  const hasCustomFocus = customBodyFocus.length > 0 || customTargetFocus.length > 0;
  const split = hasCustomFocus ? Array.from({ length: input.daysPerWeek }, () => "custom_focus") : buildWeeklySplit(input.daysPerWeek);
  const equipment = normalizeEquipment(input.equipment);
  const used = new Set<string>();
  const days: GeneratedPlanDay[] = [];

  for (let dayIndex = 0; dayIndex < split.length; dayIndex += 1) {
    const focus = split[dayIndex];
    const bodyParts = hasCustomFocus
      ? customBodyFocus.length
        ? rotateFocus(customBodyFocus, dayIndex)
        : Array.from(new Set(customTargetFocus.map((target) => TARGET_TO_BODY_PART[target]).filter(Boolean)))
      : BODY_PARTS_BY_FOCUS[focus] ?? BODY_PARTS_BY_FOCUS.full_body;
    const targetFocus = hasCustomFocus ? rotateFocus(customTargetFocus, dayIndex) : [];
    const targetCount = estimateExerciseCount(input.sessionDuration);
    const exercises = await collectExercisesForDay(bodyParts, equipment, targetCount, used, targetFocus);
    const template = getGoalTemplate(input.goal, input.level);
    const focusLabel = hasCustomFocus ? customFocusLabel(bodyParts, targetFocus) : FOCUS_LABEL[focus] ?? focus;

    days.push({
      dayIndex,
      label: `第 ${dayIndex + 1} 天 · ${focusLabel}`,
      focus: hasCustomFocus ? "custom_focus" : focus,
      items: exercises.map((exercise, index) => {
        used.add(exercise.id);
        return {
          order: index + 1,
          sets: template.sets,
          reps: template.reps,
          restSeconds: template.restSeconds,
          note: index === 0 ? `${template.note} 首个动作作为当天主项。` : template.note,
          exerciseId: exercise.id,
          exerciseSnapshot: snapshotExercise(exercise),
        };
      }),
    });
  }

  return {
    slug: "current",
    goal: input.goal,
    level: input.level,
    daysPerWeek: input.daysPerWeek,
    sessionDuration: input.sessionDuration,
    equipment,
    days,
  };
}

export async function saveCurrentPlan(plan: GeneratedPlan) {
  await prisma.weeklyPlan.deleteMany({ where: { slug: "current" } });

  const saved = await prisma.weeklyPlan.create({
    data: {
      slug: "current",
      goal: plan.goal,
      level: plan.level,
      daysPerWeek: plan.daysPerWeek,
      sessionDuration: plan.sessionDuration,
      equipment: plan.equipment,
      days: {
        create: plan.days.map((day) => ({
          dayIndex: day.dayIndex,
          label: day.label,
          focus: day.focus,
          items: {
            create: day.items.map((item) => ({
              order: item.order,
              sets: item.sets,
              reps: item.reps,
              restSeconds: item.restSeconds,
              note: item.note,
              exerciseSnapshot: (item.exerciseSnapshot ?? {}) as Prisma.InputJsonValue,
              exercise: item.exerciseId ? { connect: { id: item.exerciseId } } : undefined,
            })),
          },
        })),
      },
    },
    include: includePlanTree,
  });

  return localizePlanForDisplay(saved);
}

export async function getCurrentPlan() {
  const plan = await prisma.weeklyPlan.findUnique({ where: { slug: "current" }, include: includePlanTree });
  return localizePlanForDisplay(plan);
}

export async function replaceCurrentPlanFromPayload(rawPayload: unknown) {
  const payload = persistedPlanSchema.parse(rawPayload);
  return saveCurrentPlan({ slug: "current", ...payload });
}

async function collectExercisesForDay(bodyParts: string[], equipment: string[], targetCount: number, used: Set<string>, targetFocus: string[] = []) {
  const pool: WorkoutXExercise[] = [];

  for (const target of targetFocus) {
    const perEquipment = equipment.length ? equipment : [undefined];
    for (const item of perEquipment) {
      const found = await safeSearchExercises({ target, equipment: item, limit: 10 });
      pool.push(...found);
      if (pool.length >= targetCount * 2) break;
    }
    if (pool.length >= targetCount * 2) break;
  }

  for (const bodyPart of bodyParts) {
    const perEquipment = equipment.length ? equipment : [undefined];
    for (const item of perEquipment) {
      const found = await safeSearchExercises({ bodyPart, equipment: item, limit: 10 });
      pool.push(...found);
      if (pool.length >= targetCount * 2) break;
    }
    if (pool.length >= targetCount * 2) break;
  }

  const unique = dedupe(pool).filter((exercise) => !used.has(exercise.id));
  const selected = unique.slice(0, targetCount);
  if (selected.length >= Math.min(3, targetCount)) return selected;

  const fallback = await prisma.exercise.findMany({ take: targetCount * 2, orderBy: { cachedAt: "desc" } });
  return dedupe([...selected, ...fallback.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    equipment: exercise.equipment,
    gifUrl: exercise.gifUrl,
    instructions: Array.isArray(exercise.instructions) ? (exercise.instructions as string[]) : [],
    secondaryMuscles: exercise.secondaryMuscles,
  }))]).filter((exercise) => !used.has(exercise.id)).slice(0, targetCount);
}

async function safeSearchExercises(input: { bodyPart?: string; target?: string; equipment?: string; limit: number }) {
  try {
    const result = await searchExercises(input);
    return result.exercises;
  } catch {
    const cached = await prisma.exercise.findMany({
      where: {
        ...(input.bodyPart ? { bodyPart: input.bodyPart } : {}),
        ...(input.target ? { target: input.target } : {}),
        ...(input.equipment ? { equipment: input.equipment } : {}),
      },
      take: input.limit,
      orderBy: { cachedAt: "desc" },
    });
    return cached.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      target: exercise.target,
      equipment: exercise.equipment,
      gifUrl: exercise.gifUrl,
      instructions: Array.isArray(exercise.instructions) ? (exercise.instructions as string[]) : [],
      secondaryMuscles: exercise.secondaryMuscles,
    }));
  }
}

function normalizePlanInput(rawInput: unknown): PlanInput {
  const parsed = planInputSchema.parse(rawInput);
  const inferred = parsed.need ? normalizeExerciseQuery({ query: parsed.need }) : undefined;
  const explicitBodyFocus = normalizeFocusList(parsed.bodyFocus);
  const explicitTargetFocus = normalizeFocusList(parsed.targetFocus);
  return {
    ...parsed,
    equipment: normalizeEquipment([...parsed.equipment, inferred?.equipment].filter(Boolean) as string[]),
    bodyFocus: explicitBodyFocus.length ? explicitBodyFocus : normalizeFocusList([inferred?.bodyPart].filter(Boolean) as string[]),
    targetFocus: explicitTargetFocus.length ? explicitTargetFocus : normalizeFocusList([inferred?.target].filter(Boolean) as string[]),
  };
}

function normalizeFocusList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim().toLowerCase().replace(/[\s_-]+/g, " ")).filter(Boolean))).slice(0, 8);
}

function rotateFocus(values: string[], dayIndex: number) {
  if (values.length <= 1) return values;
  const start = dayIndex % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

function customFocusLabel(bodyParts: string[], targets: string[]) {
  const labels = [...targets, ...bodyParts].map((item) => FOCUS_ZH[item] ?? item).filter(Boolean);
  return `重点：${Array.from(new Set(labels)).slice(0, 3).join(" / ") || "自选部位"}`;
}

function normalizeEquipment(equipment: string[]) {
  const normalized = equipment.map((item) => normalizeEquipmentLabel(item)).filter(Boolean) as string[];
  return Array.from(new Set(normalized.length ? normalized : ["body weight"])).slice(0, 5);
}

function estimateExerciseCount(duration: number) {
  return Math.min(Math.max(Math.floor(duration / 10), 3), 7);
}

function snapshotExercise(exercise: WorkoutXExercise) {
  return addChineseLabels({
    ...exercise,
    id: exercise.id,
    name: exercise.name,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    equipment: exercise.equipment,
    gifUrl: exercise.gifUrl ?? null,
  });
}

function dedupe(exercises: WorkoutXExercise[]) {
  const seen = new Set<string>();
  const output: WorkoutXExercise[] = [];
  for (const exercise of exercises) {
    if (seen.has(exercise.id)) continue;
    seen.add(exercise.id);
    output.push(exercise);
  }
  return output;
}


async function localizePlanForDisplay(plan: PersistedPlan | null) {
  if (!plan) return null;
  const localizedDays = await Promise.all(
    plan.days.map(async (day) => ({
      ...day,
      items: await Promise.all(
        day.items.map(async (item) => {
          const baseExercise = item.exercise ? prismaExerciseToWorkoutX(item.exercise) : snapshotToWorkoutX(item.exerciseSnapshot);
          const localized = baseExercise ? await addChineseDetails(baseExercise) : null;
          return {
            ...item,
            exercise: item.exercise && localized ? localized : item.exercise,
            exerciseSnapshot: localized ?? item.exerciseSnapshot,
          };
        }),
      ),
    })),
  );
  return { ...plan, days: localizedDays };
}

function prismaExerciseToWorkoutX(exercise: NonNullable<PersistedPlan["days"][number]["items"][number]["exercise"]>): WorkoutXExercise {
  const raw = typeof exercise.raw === "object" && exercise.raw !== null && !Array.isArray(exercise.raw) ? exercise.raw : {};
  return {
    ...(raw as Record<string, unknown>),
    id: exercise.id,
    name: exercise.name,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    equipment: exercise.equipment,
    gifUrl: exercise.gifUrl,
    instructions: Array.isArray(exercise.instructions) ? (exercise.instructions as string[]) : [],
    secondaryMuscles: exercise.secondaryMuscles,
  } as WorkoutXExercise;
}

function snapshotToWorkoutX(snapshot: Prisma.JsonValue | null): WorkoutXExercise | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = snapshot as Record<string, unknown>;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  return {
    ...value,
    id: value.id,
    name: value.name,
    bodyPart: typeof value.bodyPart === "string" ? value.bodyPart : "",
    target: typeof value.target === "string" ? value.target : "",
    equipment: typeof value.equipment === "string" ? value.equipment : "",
    gifUrl: typeof value.gifUrl === "string" ? value.gifUrl : null,
    instructions: Array.isArray(value.instructions) ? (value.instructions as string[]) : [],
    secondaryMuscles: Array.isArray(value.secondaryMuscles) ? (value.secondaryMuscles as string[]) : [],
  } as WorkoutXExercise;
}

const includePlanTree = {
  days: {
    orderBy: { dayIndex: "asc" as const },
    include: {
      items: {
        orderBy: { order: "asc" as const },
        include: { exercise: true },
      },
    },
  },
};

type PersistedPlan = Prisma.WeeklyPlanGetPayload<{ include: typeof includePlanTree }>;

const persistedPlanItemSchema = z.object({
  order: z.number().int().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1).max(40),
  restSeconds: z.number().int().min(0).max(600),
  note: z.string().max(300).optional(),
  exerciseId: z.string().optional(),
  exerciseSnapshot: z.record(z.string(), z.unknown()).optional(),
});

const persistedPlanSchema = planInputSchema.extend({
  days: z.array(
    z.object({
      dayIndex: z.number().int().min(0).max(6),
      label: z.string().min(1).max(80),
      focus: z.string().min(1).max(40),
      items: z.array(persistedPlanItemSchema).min(1),
    }),
  ),
});
